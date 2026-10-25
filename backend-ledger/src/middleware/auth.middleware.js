const jwt = require("jsonwebtoken")
const userModel = require("../models/user.model")
const tokenBlackListModel = require("../models/blackList.model")

async function requireAuthentication(req, res, next) {
    // The browser sends the login cookie automatically with every API request.
    const token = req.cookies.token

    if (!token) {
        return res.status(401).json({ message: "Unauthorized access, token is missing" })
    }

    try {
        // A blacklisted token belongs to a user who already logged out.
        const loggedOutToken = await tokenBlackListModel.exists({ token })
        if (loggedOutToken) return res.status(401).json({ message: "Unauthorized access, token is invalid" })

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await userModel.findById(decoded.userId).select("+authVersion")

        if (!user) return res.status(401).json({ message: "Unauthorized access, user no longer exists" })

        // authVersion changes after password reset, making old JWTs invalid.
        if (!user.emailVerified || decoded.authVersion !== user.authVersion) {
            return res.status(401).json({ message: "Your session is no longer valid. Please sign in again." })
        }

        // Controllers can now access the authenticated user as req.user.
        req.user = user
        return next()
    } catch {
        return res.status(401).json({ message: "Unauthorized access, token is invalid" })
    }
}

module.exports = {
    requireAuthentication
}
