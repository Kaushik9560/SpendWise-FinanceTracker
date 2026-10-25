const crypto = require("crypto")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")

const userModel = require("../models/user.model")
const accountModel = require("../models/account.model")
const ledgerModel = require("../models/ledger.model")
const budgetModel = require("../models/budget.model")
const tokenBlackListModel = require("../models/blackList.model")
const { transactionModel } = require("../models/transaction.model")
const emailService = require("../services/email.service")

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000
const ONE_DAY = 24 * 60 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

// Small helpers keep the controller functions easy to read.
function cleanEmail(email) {
    if (typeof email !== "string") return ""
    return email.trim().toLowerCase()
}

function validPassword(password) {
    return typeof password === "string" && password.length >= 8 && password.length <= 128
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex")
}

function makeOneTimeToken() {
    const token = crypto.randomBytes(32).toString("hex")
    return { token, tokenHash: hashToken(token) }
}

function makeLoginToken(user) {
    const payload = {
        userId: user._id.toString(),
        authVersion: user.authVersion || 0
    }

    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "3d" })
}

function cookieOptions(addExpiry = true) {
    let sameSite = String(process.env.COOKIE_SAME_SITE || "lax").toLowerCase()
    if (!["lax", "strict", "none"].includes(sameSite)) sameSite = "lax"

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite,
        path: "/"
    }

    if (addExpiry) options.maxAge = THREE_DAYS
    return options
}

// POST /api/auth/register
async function registerUser(req, res) {
    const email = cleanEmail(req.body?.email)
    const password = req.body?.password
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : ""

    if (!EMAIL_PATTERN.test(email) || !validPassword(password) || !name || name.length > 100) {
        return res.status(400).json({
            message: "A valid name, email and password (8-128 characters) are required"
        })
    }

    const emailAlreadyUsed = await userModel.exists({ email })
    if (emailAlreadyUsed) {
        return res.status(422).json({ message: "An account already exists with this email" })
    }

    // Only the hash is stored. The original token is sent by email.
    const verification = makeOneTimeToken()
    const user = await userModel.create({
        name,
        email,
        password,
        emailVerified: false,
        emailVerificationTokenHash: verification.tokenHash,
        emailVerificationExpiresAt: new Date(Date.now() + ONE_DAY)
    })

    try {
        const emailResult = await emailService.sendVerificationEmail(user, verification.token)
        const response = {
            message: "Account created. Check your email to verify it before signing in.",
            email: user.email
        }

        // Local development returns the link because there may be no email provider.
        if (emailResult.previewUrl) response.previewUrl = emailResult.previewUrl
        return res.status(201).json(response)
    } catch (error) {
        // Do not keep an unusable account when its first verification email fails.
        await userModel.deleteOne({ _id: user._id })
        console.error("verification email error:", error.message)
        return res.status(503).json({ message: "We could not send the verification email. Please try again." })
    }
}

// POST /api/auth/verify-email
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

// POST /api/auth/resend-verification
async function resendVerification(req, res) {
    const email = cleanEmail(req.body?.email)
    const message = "If an unverified account exists, a new verification email has been sent."

    // The same response hides whether an email is registered.
    if (!EMAIL_PATTERN.test(email)) return res.status(200).json({ message })

    const user = await userModel.findOne({ email, emailVerified: false })
        .select("+emailVerificationTokenHash +emailVerificationExpiresAt")

    if (!user) return res.status(200).json({ message })

    const verification = makeOneTimeToken()
    user.emailVerificationTokenHash = verification.tokenHash
    user.emailVerificationExpiresAt = new Date(Date.now() + ONE_DAY)
    await user.save()

    try {
        const emailResult = await emailService.sendVerificationEmail(user, verification.token)
        const response = { message }
        if (emailResult.previewUrl) response.previewUrl = emailResult.previewUrl
        return res.status(200).json(response)
    } catch (error) {
        console.error("resend verification error:", error.message)
        return res.status(503).json({ message: "Email service is temporarily unavailable. Please try again." })
    }
}

// POST /api/auth/login
async function loginUser(req, res) {
    const email = cleanEmail(req.body?.email)
    const password = req.body?.password

    if (!EMAIL_PATTERN.test(email) || typeof password !== "string" || !password) {
        return res.status(400).json({ message: "Email and password are required" })
    }

    const user = await userModel.findOne({ email }).select("+password +authVersion")
    const passwordIsCorrect = user && await user.comparePassword(password)

    if (!passwordIsCorrect) {
        return res.status(401).json({ message: "Email or password is invalid" })
    }

    if (!user.emailVerified) {
        return res.status(403).json({
            message: "Verify your email before signing in",
            code: "EMAIL_NOT_VERIFIED"
        })
    }

    res.cookie("token", makeLoginToken(user), cookieOptions())
    return res.status(200).json({ user: user.toSafeObject() })
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
    const email = cleanEmail(req.body?.email)
    const message = "If an account exists for this email, a password reset link has been sent."

    if (!EMAIL_PATTERN.test(email)) return res.status(200).json({ message })

    const user = await userModel.findOne({ email, emailVerified: true })
        .select("+passwordResetTokenHash +passwordResetExpiresAt")

    if (!user) return res.status(200).json({ message })

    const reset = makeOneTimeToken()
    user.passwordResetTokenHash = reset.tokenHash
    user.passwordResetExpiresAt = new Date(Date.now() + ONE_HOUR)
    await user.save()

    try {
        const emailResult = await emailService.sendPasswordResetEmail(user, reset.token)
        const response = { message }
        if (emailResult.previewUrl) response.previewUrl = emailResult.previewUrl
        return res.status(200).json(response)
    } catch (error) {
        console.error("password reset email error:", error.message)
        return res.status(503).json({ message: "Email service is temporarily unavailable. Please try again." })
    }
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
    const token = req.body?.token
    const password = req.body?.password

    if (typeof token !== "string" || token.length !== 64 || !validPassword(password)) {
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
    user.authVersion += 1 // This invalidates JWTs created before the reset.
    await user.save()

    res.clearCookie("token", cookieOptions(false))
    return res.status(200).json({ message: "Password reset successfully. Sign in with your new password." })
}

// POST /api/auth/logout
async function logoutUser(req, res) {
    const token = req.cookies.token

    if (token && token.length <= 4096) {
        await tokenBlackListModel.updateOne(
            { token },
            { $setOnInsert: { token } },
            { upsert: true }
        )
    }

    res.clearCookie("token", cookieOptions(false))
    return res.status(200).json({ message: "User logged out successfully" })
}

// GET /api/auth/session
function getCurrentUser(req, res) {
    return res.status(200).json({ user: req.user.toSafeObject() })
}

// DELETE /api/auth/account
async function deleteUserAccount(req, res) {
    const password = req.body?.password
    const confirmation = req.body?.confirmation

    if (confirmation !== "DELETE" || typeof password !== "string" || !password) {
        return res.status(400).json({ message: "Enter your password and type DELETE to confirm" })
    }

    const user = await userModel.findById(req.user._id).select("+password")
    const passwordIsCorrect = user && await user.comparePassword(password)
    if (!passwordIsCorrect) return res.status(401).json({ message: "Password is incorrect" })

    // All collections must be deleted together, or none of them should change.
    const session = await mongoose.startSession()

    try {
        session.startTransaction()

        const accounts = await accountModel.find({ user: user._id }).select("_id").session(session)
        const accountIds = accounts.map((account) => account._id)

        // Raw access bypasses ledger immutability only for full privacy deletion.
        await ledgerModel.collection.deleteMany({ account: { $in: accountIds } }, { session })
        await transactionModel.deleteMany({ user: user._id }, { session })
        await budgetModel.deleteMany({ user: user._id }, { session })
        await accountModel.deleteMany({ user: user._id }, { session })
        await tokenBlackListModel.deleteMany({ token: req.cookies.token }, { session })
        await userModel.deleteOne({ _id: user._id }, { session })

        await session.commitTransaction()
        res.clearCookie("token", cookieOptions(false))
        return res.status(200).json({ message: "User account and financial data deleted successfully" })
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction()
        console.error("deleteUserAccount error:", error.message)
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
