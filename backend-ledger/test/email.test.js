const assert = require("node:assert/strict")
const test = require("node:test")

const emailService = require("../src/services/email.service")

test("verification email uses the Brevo HTTPS API", async () => {
    const originalFetch = global.fetch
    process.env.BREVO_API_KEY = "test-key"
    process.env.EMAIL_FROM_ADDRESS = "verified@example.com"
    process.env.FRONTEND_URL = "https://spendwise.example.com"

    let request
    global.fetch = async (url, options) => {
        request = { url, options }
        return { ok: true }
    }

    try {
        await emailService.sendVerificationEmail({
            name: "Student",
            email: "student@example.com"
        }, "verification-token")

        const body = JSON.parse(request.options.body)
        assert.equal(request.url, "https://api.brevo.com/v3/smtp/email")
        assert.equal(request.options.headers["api-key"], "test-key")
        assert.equal(body.sender.email, "verified@example.com")
        assert.equal(body.to[0].email, "student@example.com")
        assert.match(body.htmlContent, /verification-token/)
    } finally {
        global.fetch = originalFetch
        delete process.env.BREVO_API_KEY
        delete process.env.EMAIL_FROM_ADDRESS
    }
})
