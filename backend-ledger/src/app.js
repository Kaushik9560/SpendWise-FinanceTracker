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
app.set("trust proxy", 1)
app.disable("x-powered-by")
app.use(helmet({ crossOriginResourcePolicy: false }))

const allowedOrigins = [
    process.env.FRONTEND_URL,
    "https://spendwise-0d92.onrender.com",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:4173"
].filter(Boolean)

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
            callback(null, true)
            return
        }

        callback(new Error("Not allowed by CORS"))
    },
    credentials: true
}))
app.use(express.json({ limit: "20kb" }))
app.use(cookieParser())

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === "test" ? 1000 : 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many authentication attempts. Please try again later." }
})

app.get("/api/health", (req, res) => {
    const databaseConnected = mongoose.connection.readyState === 1
    res.status(databaseConnected ? 200 : 503).json({
        status: databaseConnected ? "ok" : "degraded",
        service: "backend-ledger",
        database: databaseConnected ? "connected" : "disconnected"
    })
})

app.use("/api/auth", authLimiter, authRouter)
app.use("/api/accounts", accountRouter)
app.use("/api/transactions", transactionRouter)
app.use("/api/expenses", expenseRouter)
app.use("/api/budgets", budgetRouter)

app.use("/api", (req, res) => res.status(404).json({ message: "API route not found" }))

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    console.error(error)
    return res.status(500).json({ message: "Something went wrong. Please try again." })
})

module.exports = app
