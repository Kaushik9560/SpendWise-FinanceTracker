const jwt = require("jsonwebtoken")
const userModel = require("../models/user.model")
const tokenBlackListModel = require("../models/blackList.model")

async function requireAuthentication(req, res, next) {
    const token = req.cookies.token

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized access, token is missing"
        })
    }

    try {
        const blacklistedToken = await tokenBlackListModel.findOne({ token })
        if (blacklistedToken) {
            return res.status(401).json({
                message: "Unauthorized access, token is invalid"
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await userModel.findById(decoded.userId).select("+authVersion")

        if (!user) {
            return res.status(401).json({
                message: "Unauthorized access, user no longer exists"
            })
        }

        if (!user.emailVerified || decoded.authVersion !== user.authVersion) {
            return res.status(401).json({
                message: "Your session is no longer valid. Please sign in again."
            })
        }

        req.user = user
        next()
    } catch {
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }
}

module.exports = {
    requireAuthentication
}

// read req.cookies.token
//        ↓
// token present?
//        ↓
// blacklisted?
//        ↓
// jwt.verify()
//        ↓
// extract userId
//        ↓
// find user
//        ↓
// req.user = user
//        ↓
// next()
