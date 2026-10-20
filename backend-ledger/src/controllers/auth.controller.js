const crypto = require("crypto")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")
const userModel = require("../models/user.model")
const tokenBlackListModel = require("../models/blackList.model")
const accountModel = require("../models/account.model")
const { transactionModel } = require("../models/transaction.model")
const ledgerModel = require("../models/ledger.model")
const budgetModel = require("../models/budget.model")
const emailService = require("../services/email.service")

const TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000
const RESET_TTL_MS = 60 * 60 * 1000
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function createSessionToken(user) {
    return jwt.sign(
        { userId: user._id.toString(), authVersion: user.authVersion || 0 },
        process.env.JWT_SECRET,
        { expiresIn: "3d" }
    )
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex")
}

function createOpaqueToken() {
    const token = crypto.randomBytes(32).toString("hex")
    return { token, hash: hashToken(token) }
}

function getCookieOptions(includeMaxAge = true) {
    const configuredSameSite = String(process.env.COOKIE_SAME_SITE || "lax").toLowerCase()
    const sameSite = ["lax", "strict", "none"].includes(configuredSameSite) ? configuredSameSite : "lax"
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite,
        path: "/"
    }
    if (includeMaxAge) options.maxAge = TOKEN_TTL_MS
    return options
}

function isValidPassword(password) {
    return typeof password === "string" && password.length >= 8 && password.length <= 128
}

function buildUser(user) {
    return user.toSafeObject ? user.toSafeObject() : {
        _id: user._id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified
    }
}

async function registerUser(req, res) {
    const { email, password, name } = req.body || {}
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""

    if (!EMAIL_PATTERN.test(normalizedEmail) || !isValidPassword(password)
        || typeof name !== "string" || !name.trim() || name.trim().length > 100) {
        return res.status(400).json({
            message: "A valid name, email and password (8-128 characters) are required"
        })
    }

    if (await userModel.exists({ email: normalizedEmail })) {
        return res.status(422).json({ message: "An account already exists with this email" })
    }

    const verification = createOpaqueToken()
    const user = await userModel.create({
        email: normalizedEmail,
        password,
        name: name.trim(),
        emailVerified: false,
        emailVerificationTokenHash: verification.hash,
        emailVerificationExpiresAt: new Date(Date.now() + VERIFICATION_TTL_MS)
    })

    try {
        const delivery = await emailService.sendVerificationEmail(user, verification.token)
        return res.status(201).json({
            message: "Account created. Check your email to verify it before signing in.",
            email: user.email,
            ...(delivery.previewUrl ? { previewUrl: delivery.previewUrl } : {})
        })
    } catch (error) {
        await userModel.deleteOne({ _id: user._id })
        console.error("verification email error:", error.message)
        return res.status(503).json({ message: "We could not send the verification email. Please try again." })
    }
}

async function verifyEmail(req, res) {
    const token = req.body?.token
    if (typeof token !== "string" || token.length !== 64) {
        return res.status(400).json({ message: "Invalid or expired verification link" })
    }

    const user = await userModel.findOne({
        emailVerificationTokenHash: hashToken(token),
        emailVerificationExpiresAt: { $gt: new Date() }
    }).select("+emailVerificationTokenHash +emailVerificationExpiresAt")

    if (!user) return res.status(400).json({ message: "Invalid or expired verification link" })

    user.emailVerified = true
    user.emailVerificationTokenHash = undefined
    user.emailVerificationExpiresAt = undefined
    await user.save()
    return res.status(200).json({ message: "Email verified. You can now sign in." })
}

async function resendVerification(req, res) {
    const normalizedEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : ""
    const genericMessage = "If an unverified account exists, a new verification email has been sent."
    if (!EMAIL_PATTERN.test(normalizedEmail)) return res.status(200).json({ message: genericMessage })

    const user = await userModel.findOne({ email: normalizedEmail, emailVerified: { $ne: true } })
        .select("+emailVerificationTokenHash +emailVerificationExpiresAt")
    if (!user) return res.status(200).json({ message: genericMessage })

    const verification = createOpaqueToken()
    user.emailVerificationTokenHash = verification.hash
    user.emailVerificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS)
    await user.save()

    try {
        const delivery = await emailService.sendVerificationEmail(user, verification.token)
        return res.status(200).json({
            message: genericMessage,
            ...(delivery.previewUrl ? { previewUrl: delivery.previewUrl } : {})
        })
    } catch (error) {
        console.error("resend verification error:", error.message)
        return res.status(503).json({ message: "Email service is temporarily unavailable. Please try again." })
    }
}

async function loginUser(req, res) {
    const { email, password } = req.body || {}
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
    if (!EMAIL_PATTERN.test(normalizedEmail) || typeof password !== "string" || !password) {
        return res.status(400).json({ message: "Email and password are required" })
    }

    const user = await userModel.findOne({ email: normalizedEmail }).select("+password +authVersion")
    if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: "Email or password is invalid" })
    }
    if (!user.emailVerified) {
        return res.status(403).json({ message: "Verify your email before signing in", code: "EMAIL_NOT_VERIFIED" })
    }

    res.cookie("token", createSessionToken(user), getCookieOptions())
    return res.status(200).json({ user: buildUser(user) })
}

async function forgotPassword(req, res) {
    const normalizedEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : ""
    const genericMessage = "If an account exists for this email, a password reset link has been sent."
    if (!EMAIL_PATTERN.test(normalizedEmail)) return res.status(200).json({ message: genericMessage })

    const user = await userModel.findOne({ email: normalizedEmail, emailVerified: true })
        .select("+passwordResetTokenHash +passwordResetExpiresAt")
    if (!user) return res.status(200).json({ message: genericMessage })

    const reset = createOpaqueToken()
    user.passwordResetTokenHash = reset.hash
    user.passwordResetExpiresAt = new Date(Date.now() + RESET_TTL_MS)
    await user.save()

    try {
        const delivery = await emailService.sendPasswordResetEmail(user, reset.token)
        return res.status(200).json({
            message: genericMessage,
            ...(delivery.previewUrl ? { previewUrl: delivery.previewUrl } : {})
        })
    } catch (error) {
        console.error("password reset email error:", error.message)
        return res.status(503).json({ message: "Email service is temporarily unavailable. Please try again." })
    }
}

async function resetPassword(req, res) {
    const { token, password } = req.body || {}
    if (typeof token !== "string" || token.length !== 64 || !isValidPassword(password)) {
        return res.status(400).json({ message: "A valid reset link and password (8-128 characters) are required" })
    }

    const user = await userModel.findOne({
        passwordResetTokenHash: hashToken(token),
        passwordResetExpiresAt: { $gt: new Date() }
    }).select("+passwordResetTokenHash +passwordResetExpiresAt +authVersion")
    if (!user) return res.status(400).json({ message: "Invalid or expired password reset link" })

    user.password = password
    user.passwordResetTokenHash = undefined
    user.passwordResetExpiresAt = undefined
    user.authVersion += 1
    await user.save()

    res.clearCookie("token", getCookieOptions(false))
    return res.status(200).json({ message: "Password reset successfully. Sign in with your new password." })
}

async function logoutUser(req, res) {
    const token = req.cookies.token
    if (token && token.length <= 4096) {
        await tokenBlackListModel.updateOne({ token }, { $setOnInsert: { token } }, { upsert: true })
    }
    res.clearCookie("token", getCookieOptions(false))
    return res.status(200).json({ message: "User logged out successfully" })
}

function getCurrentUser(req, res) {
    return res.status(200).json({ user: buildUser(req.user) })
}

async function deleteUserAccount(req, res) {
    const { password, confirmation } = req.body || {}
    if (confirmation !== "DELETE" || typeof password !== "string" || !password) {
        return res.status(400).json({ message: "Enter your password and type DELETE to confirm" })
    }

    const user = await userModel.findById(req.user._id).select("+password")
    if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: "Password is incorrect" })
    }

    const session = await mongoose.startSession()
    try {
        session.startTransaction()
        const accounts = await accountModel.find({ user: user._id }).select("_id").session(session)
        const accountIds = accounts.map((account) => account._id)

        // Raw collection access is intentional for a full privacy deletion.
        await ledgerModel.collection.deleteMany({ account: { $in: accountIds } }, { session })
        await transactionModel.deleteMany({ user: user._id }, { session })
        await budgetModel.deleteMany({ user: user._id }, { session })
        await accountModel.deleteMany({ user: user._id }, { session })
        await tokenBlackListModel.deleteMany({ token: req.cookies.token }, { session })
        await userModel.deleteOne({ _id: user._id }, { session })
        await session.commitTransaction()

        res.clearCookie("token", getCookieOptions(false))
        return res.status(200).json({ message: "User account and financial data deleted successfully" })
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction()
        console.error("deleteUserAccount error:", error)
        return res.status(500).json({ message: "Failed to delete user account" })
    } finally {
        await session.endSession()
    }
}

module.exports = {
    registerUser,
    verifyEmail,
    resendVerification,
    loginUser,
    forgotPassword,
    resetPassword,
    logoutUser,
    getCurrentUser,
    deleteUserAccount
}
