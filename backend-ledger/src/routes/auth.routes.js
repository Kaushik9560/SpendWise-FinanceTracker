const express = require("express")
const authController = require("../controllers/auth.controller")
const { requireAuthentication } = require("../middleware/auth.middleware")

const router = express.Router()

router.post("/register", authController.registerUser)
router.post("/verify-email", authController.verifyEmail)
router.post("/resend-verification", authController.resendVerification)
router.post("/login", authController.loginUser)
router.post("/forgot-password", authController.forgotPassword)
router.post("/reset-password", authController.resetPassword)
router.post("/logout", authController.logoutUser)
router.get("/session", requireAuthentication, authController.getCurrentUser)
router.delete("/account", requireAuthentication, authController.deleteUserAccount)

module.exports = router
