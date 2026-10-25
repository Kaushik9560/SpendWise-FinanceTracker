const express = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const helmet = require("helmet")
const { rateLimit } = require("express-rate-limit")
const mongoose = require("mongoose")

const authRouter = require("./routes/auth.routes")
const accountRouter = require("./routes/account.routes")
const transactionRouter = require("./routes/transaction.routes")
const expenseRouter = require("./routes/expense.routes")
const budgetRouter = require("./routes/budget.routes")

const app = express()

// Render sits behind a proxy. This lets rate limiting read the real client IP.
app.set("trust proxy", 1)
app.use(helmet())

// Allow the React frontend to send cookies to this API.
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}))

// Parse small JSON requests and cookies sent by the browser.
app.use(express.json({ limit: "20kb" }))
app.use(cookieParser())

// Login-related routes get a separate rate limit to slow brute-force attempts.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    message: { message: "Too many authentication attempts. Please try again later." }
})

// Render uses this endpoint to check whether the API and database are alive.
app.get("/api/health", (req, res) => {
    const databaseConnected = mongoose.connection.readyState === 1

    if (databaseConnected) {
        return res.status(200).json({
            status: "ok",
            service: "backend-ledger",
            database: "connected"
        })
    }

    return res.status(503).json({
        status: "degraded",
        service: "backend-ledger",
        database: "disconnected"
    })
})

app.use("/api/auth", authLimiter, authRouter)
app.use("/api/accounts", accountRouter)
app.use("/api/transactions", transactionRouter)
app.use("/api/expenses", expenseRouter)
app.use("/api/budgets", budgetRouter)

// Friendly responses for unknown API routes and unexpected errors.
app.use("/api", (req, res) => res.status(404).json({ message: "API route not found" }))

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    console.error(error)
    return res.status(500).json({ message: "Something went wrong. Please try again." })
})

module.exports = app
