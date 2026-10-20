function getFrontendUrl() {
    return String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "")
}

function buildEmail({ title, greeting, body, action, actionUrl, expiry }) {
    return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033">
        <h1 style="font-size:24px">${title}</h1><p>${greeting}</p><p>${body}</p>
        <p style="margin:28px 0"><a href="${actionUrl}" style="background:#5d8dff;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">${action}</a></p>
        <p style="font-size:13px;color:#667085">This link expires in ${expiry}. If you did not request this, you can ignore this email.</p>
    </div>`
}

async function deliver({ to, subject, html, previewUrl }) {
    const apiKey = process.env.BREVO_API_KEY
    const senderEmail = process.env.EMAIL_FROM_ADDRESS

    if (!apiKey || !senderEmail) {
        if (process.env.NODE_ENV === "production") throw new Error("Email service is not configured")
        console.info(`[email preview] ${subject}: ${previewUrl}`)
        return { previewUrl }
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": apiKey,
            "content-type": "application/json",
            accept: "application/json"
        },
        body: JSON.stringify({
            sender: {
                name: process.env.EMAIL_FROM_NAME || "SpendWise",
                email: senderEmail
            },
            to: [{ email: to }],
            subject,
            htmlContent: html
        }),
        signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || "Brevo could not send the email")
    }

    return {}
}

async function sendVerificationEmail(user, token) {
    const actionUrl = `${getFrontendUrl()}/?verify=${encodeURIComponent(token)}`
    return deliver({
        to: user.email,
        subject: "Verify your SpendWise email",
        previewUrl: actionUrl,
        html: buildEmail({
            title: "Verify your email", greeting: `Hi ${user.name},`,
            body: "Confirm your email address to activate your SpendWise account.",
            action: "Verify email", actionUrl, expiry: "24 hours"
        })
    })
}

async function sendPasswordResetEmail(user, token) {
    const actionUrl = `${getFrontendUrl()}/?reset=${encodeURIComponent(token)}`
    return deliver({
        to: user.email,
        subject: "Reset your SpendWise password",
        previewUrl: actionUrl,
        html: buildEmail({
            title: "Reset your password", greeting: `Hi ${user.name},`,
            body: "We received a request to reset your SpendWise password.",
            action: "Reset password", actionUrl, expiry: "1 hour"
        })
    })
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail }
