require("dotenv").config({ quiet: true })

const path = require("path")
const express = require("express")
const app = require("./src/app")
const connectToDB = require("./src/config/db")

const PORT = process.env.PORT || 3000

function validateProductionConfig() {
    if (process.env.NODE_ENV !== "production") return

    const required = ["MONGO_URI", "JWT_SECRET", "FRONTEND_URL", "BREVO_API_KEY", "EMAIL_FROM_ADDRESS"]
    const missing = required.filter((name) => !process.env[name])
    if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`)
}

function serveFrontendInProduction() {
    if (process.env.NODE_ENV !== "production") {
        return
    }

    const frontendFolder = path.join(__dirname, "../ledger-frontend/dist")

    app.use(express.static(frontendFolder))
    app.use((req, res, next) => {
        if (req.method !== "GET" || req.path.startsWith("/api")) {
            return next()
        }

        return res.sendFile(path.join(frontendFolder, "index.html"))
    })
}

async function startServer() {
    validateProductionConfig()
    await connectToDB()
    serveFrontendInProduction()

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`)
    })
}

startServer().catch((error) => {
    console.error("Unable to start server:", error.message)
    process.exit(1)
})
