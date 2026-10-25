const mongoose = require("mongoose")
const accountModel = require("../models/account.model")
const ledgerModel = require("../models/ledger.model")
const { transactionModel } = require("../models/transaction.model")

function sameTransfer(transaction, fromAccount, toAccount, amount) {
    return transaction.fromAccount.toString() === fromAccount.toString()
        && transaction.toAccount.toString() === toAccount.toString()
        && transaction.amount === amount
}

// The frontend only needs these fields after a transfer.
function transferResponse(transaction) {
    return {
        _id: transaction._id,
        fromAccount: transaction.fromAccount,
        toAccount: transaction.toAccount,
        amount: transaction.amount,
        status: transaction.status,
        idempotencyKey: transaction.idempotencyKey,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt
    }
}

// POST /api/transactions
async function createTransaction(req, res) {
    const fromAccount = req.body?.fromAccount
    const toAccount = req.body?.toAccount
    const amount = Number(req.body?.amount)
    const idempotencyKey = typeof req.body?.idempotencyKey === "string"
        ? req.body.idempotencyKey.trim()
        : ""

    // Step 1: validate the request.
    if (!fromAccount || !toAccount || !idempotencyKey) {
        return res.status(400).json({
            message: "FromAccount, toAccount, amount and idempotencyKey are required"
        })
    }

    if (!mongoose.isObjectIdOrHexString(fromAccount) || !mongoose.isObjectIdOrHexString(toAccount)) {
        return res.status(400).json({ message: "Invalid fromAccount or toAccount" })
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
        return res.status(400).json({ message: "Amount must be a positive number" })
    }

    if (idempotencyKey.length > 128) {
        return res.status(400).json({ message: "Idempotency key cannot exceed 128 characters" })
    }

    if (fromAccount.toString() === toAccount.toString()) {
        return res.status(400).json({ message: "Source and destination accounts must be different" })
    }

    // Step 2: both accounts must belong to the logged-in user.
    const sourceAccount = await accountModel.findOne({
        _id: fromAccount,
        user: req.user._id,
        isArchived: false
    })

    if (!sourceAccount) {
        return res.status(403).json({ message: "You can only transfer from your own account" })
    }

    const destinationAccount = await accountModel.findOne({
        _id: toAccount,
        user: req.user._id,
        isArchived: false
    })

    if (!destinationAccount) {
        return res.status(400).json({ message: "You can only transfer to your own account" })
    }

    // Step 3: the same key means the browser is retrying the same request.
    const oldTransaction = await transactionModel.findOne({ idempotencyKey })

    if (oldTransaction) {
        if (!sameTransfer(oldTransaction, fromAccount, toAccount, amount)) {
            return res.status(409).json({
                message: "Idempotency key has already been used for a different transaction"
            })
        }

        if (oldTransaction.status === "COMPLETED") {
            return res.status(200).json({
                message: "Transaction already processed",
                transaction: transferResponse(oldTransaction)
            })
        }

        return res.status(200).json({ message: "Transaction is still processing" })
    }

    // Step 4: save the transaction and both ledger entries as one unit.
    const session = await mongoose.startSession()
    let transaction

    try {
        session.startTransaction()

        // Touching the account makes simultaneous withdrawals conflict safely.
        await accountModel.updateOne(
            { _id: sourceAccount._id, user: req.user._id, isArchived: false },
            { $set: { lastTransactionAt: new Date() } },
            { session }
        )

        const balance = await sourceAccount.getBalance({ session })
        if (balance < amount) {
            await session.abortTransaction()
            return res.status(400).json({
                message: `Insufficient balance. Current balance is ${balance}. Requested amount is ${amount}`
            })
        }

        const createdTransactions = await transactionModel.create([{
            user: req.user._id,
            type: "TRANSFER",
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        }], { session })

        transaction = createdTransactions[0]

        // Money leaves one account and enters the other account.
        await ledgerModel.create([
            { account: fromAccount, amount, transaction: transaction._id, type: "DEBIT" },
            { account: toAccount, amount, transaction: transaction._id, type: "CREDIT" }
        ], { session, ordered: true })

        transaction.status = "COMPLETED"
        await transaction.save({ session })
        await session.commitTransaction()
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction()
        console.error("createTransaction error:", error.message)

        const duplicateKey = error.code === 11000
        return res.status(duplicateKey ? 409 : 503).json({
            message: duplicateKey
                ? "This idempotency key is already being processed"
                : "Transaction could not be completed safely. Please retry with the same idempotency key."
        })
    } finally {
        await session.endSession()
    }

    return res.status(201).json({
        message: "Transaction completed successfully",
        transaction: transferResponse(transaction)
    })
}

module.exports = { createTransaction }
