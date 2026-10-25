const mongoose = require("mongoose")
const accountModel = require("../models/account.model")
const ledgerModel = require("../models/ledger.model")
const { transactionModel, CATEGORIES } = require("../models/transaction.model")

const MONEY_TYPES = ["INCOME", "EXPENSE"]

// MongoDB stores uppercase types. The frontend uses lowercase types.
function moneyEventResponse(transaction) {
    const event = transaction.toObject ? transaction.toObject() : transaction

    return {
        ...event,
        type: event.type.toLowerCase()
    }
}

// A reversed transaction stays in history but is hidden from active totals/lists.
async function getReversedIds(userId, session) {
    const query = transactionModel.find({ user: userId, type: "REVERSAL" })
        .select("reversesTransaction")
        .lean()

    if (session) query.session(session)

    const reversals = await query
    return reversals.map((item) => item.reversesTransaction).filter(Boolean)
}

// POST /api/expenses
async function createMoneyEvent(req, res) {
    const accountId = req.body?.accountId
    const amount = Number(req.body?.amount)
    const type = req.body?.type
    const category = req.body?.category
    const description = req.body?.description || ""
    const date = req.body?.date ? new Date(req.body.date) : new Date()

    // Step 1: validate the form values.
    if (!accountId || !type || !category) {
        return res.status(400).json({ message: "accountId, amount, type and category are required" })
    }

    if (!mongoose.isObjectIdOrHexString(accountId)) {
        return res.status(400).json({ message: "Invalid accountId" })
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
        return res.status(400).json({ message: "Amount must be a positive number" })
    }

    if (!["income", "expense"].includes(type)) {
        return res.status(400).json({ message: "Type must be either income or expense" })
    }

    if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ message: "Invalid category" })
    }

    if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: "Date must be a valid date" })
    }

    // Step 2: users may only change their own active accounts.
    const account = await accountModel.findOne({
        _id: accountId,
        user: req.user._id,
        isArchived: false
    })

    if (!account) return res.status(404).json({ message: "Account not found" })

    // Step 3: transaction record and ledger row must succeed together.
    const session = await mongoose.startSession()

    try {
        session.startTransaction()

        // This makes simultaneous withdrawals from one account conflict safely.
        await accountModel.updateOne(
            { _id: accountId, user: req.user._id, isArchived: false },
            { $set: { lastTransactionAt: new Date() } },
            { session }
        )

        if (type === "expense") {
            const balance = await account.getBalance({ session })
            if (balance < amount) {
                await session.abortTransaction()
                return res.status(400).json({
                    message: `Insufficient balance. Available: ₹${balance.toFixed(2)}, Required: ₹${amount.toFixed(2)}`
                })
            }
        }

        const created = await transactionModel.create([{
            user: req.user._id,
            account: accountId,
            amount,
            type: type.toUpperCase(),
            category,
            description,
            date,
            status: "COMPLETED"
        }], { session })

        const transaction = created[0]
        const ledgerType = type === "income" ? "CREDIT" : "DEBIT"

        await ledgerModel.create([{
            account: accountId,
            amount,
            transaction: transaction._id,
            type: ledgerType
        }], { session })

        await session.commitTransaction()

        return res.status(201).json({
            message: type === "income" ? "Income recorded successfully" : "Expense recorded successfully",
            expense: moneyEventResponse(transaction)
        })
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction()
        console.error("createMoneyEvent error:", error.message)
        return res.status(500).json({ message: "Failed to record transaction. Please try again." })
    } finally {
        await session.endSession()
    }
}

// GET /api/expenses
async function listMoneyEvents(req, res) {
    const reversedIds = await getReversedIds(req.user._id)

    const transactions = await transactionModel.find({
        user: req.user._id,
        type: { $in: MONEY_TYPES },
        _id: { $nin: reversedIds }
    })
        .sort({ date: -1, createdAt: -1 })
        .limit(100)
        .lean()

    return res.status(200).json({
        expenses: transactions.map(moneyEventResponse)
    })
}

// GET /api/expenses/summary
async function getMoneyEventSummary(req, res) {
    const reversedIds = await getReversedIds(req.user._id)

    // Every chart starts with the same set of active income/expense records.
    const activeMoneyEvents = {
        user: new mongoose.Types.ObjectId(req.user._id),
        type: { $in: MONEY_TYPES },
        _id: { $nin: reversedIds }
    }

    const overallPipeline = [
        { $match: activeMoneyEvents },
        {
            $group: {
                _id: { $toLower: "$type" },
                total: { $sum: "$amount" },
                count: { $sum: 1 }
            }
        }
    ]

    const categoryPipeline = [
        { $match: activeMoneyEvents },
        {
            $group: {
                _id: { category: "$category", type: { $toLower: "$type" } },
                total: { $sum: "$amount" },
                count: { $sum: 1 }
            }
        },
        { $sort: { total: -1 } }
    ]

    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
    const monthlyPipeline = [
        { $match: { ...activeMoneyEvents, date: { $gte: sixMonthsAgo } } },
        {
            $group: {
                _id: {
                    year: { $year: "$date" },
                    month: { $month: "$date" },
                    type: { $toLower: "$type" }
                },
                total: { $sum: "$amount" }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]

    // These queries do not depend on each other, so run them together.
    const [overall, categoryBreakdown, monthlyTrend] = await Promise.all([
        transactionModel.aggregate(overallPipeline),
        transactionModel.aggregate(categoryPipeline),
        transactionModel.aggregate(monthlyPipeline)
    ])

    const income = overall.find((item) => item._id === "income") || { total: 0, count: 0 }
    const expense = overall.find((item) => item._id === "expense") || { total: 0, count: 0 }

    return res.status(200).json({
        summary: {
            totalIncome: income.total,
            totalExpense: expense.total,
            netBalance: income.total - expense.total,
            incomeCount: income.count,
            expenseCount: expense.count
        },
        categoryBreakdown,
        monthlyTrend
    })
}

// DELETE /api/expenses/:id
async function reverseMoneyEvent(req, res) {
    const transactionId = req.params.id

    if (!mongoose.isObjectIdOrHexString(transactionId)) {
        return res.status(400).json({ message: "Invalid transaction id" })
    }

    const session = await mongoose.startSession()

    try {
        session.startTransaction()

        const transaction = await transactionModel.findOne({
            _id: transactionId,
            user: req.user._id,
            type: { $in: MONEY_TYPES }
        }).session(session)

        if (!transaction) {
            await session.abortTransaction()
            return res.status(404).json({ message: "Transaction not found" })
        }

        const alreadyReversed = await transactionModel.exists({
            user: req.user._id,
            type: "REVERSAL",
            reversesTransaction: transaction._id
        }).session(session)

        if (alreadyReversed) {
            await session.abortTransaction()
            return res.status(404).json({ message: "Transaction not found" })
        }

        const account = await accountModel.findOne({
            _id: transaction.account,
            user: req.user._id,
            isArchived: false
        }).session(session)

        if (!account) {
            await session.abortTransaction()
            return res.status(400).json({ message: "Deleted accounts cannot be changed" })
        }

        await accountModel.updateOne(
            { _id: account._id },
            { $set: { lastTransactionAt: new Date() } },
            { session }
        )

        const created = await transactionModel.create([{
            user: req.user._id,
            type: "REVERSAL",
            account: transaction.account,
            amount: transaction.amount,
            reversesTransaction: transaction._id,
            status: "COMPLETED"
        }], { session })

        const reversal = created[0]
        const oppositeType = transaction.type === "INCOME" ? "DEBIT" : "CREDIT"

        await ledgerModel.create([{
            account: transaction.account,
            amount: transaction.amount,
            transaction: reversal._id,
            type: oppositeType
        }], { session })

        await session.commitTransaction()
        return res.status(200).json({ message: "Transaction reversed successfully" })
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction()
        console.error("reverseMoneyEvent error:", error.message)

        const alreadyReversed = error.code === 11000
        return res.status(alreadyReversed ? 404 : 500).json({
            message: alreadyReversed ? "Transaction not found" : "Failed to reverse transaction"
        })
    } finally {
        await session.endSession()
    }
}

module.exports = {
    createMoneyEvent,
    listMoneyEvents,
    getMoneyEventSummary,
    reverseMoneyEvent
}
