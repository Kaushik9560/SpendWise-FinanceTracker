const accountModel = require("../models/account.model")
const mongoose = require("mongoose")

// POST /api/accounts
async function createAccount(req, res) {
    const { name } = req.body || {}

    if (typeof name !== "string" || !name.trim() || name.trim().length > 50) {
        return res.status(400).json({
            message: "Account name is required and cannot exceed 50 characters"
        })
    }

    const account = await accountModel.create({
        user: req.user._id,
        name: name.trim()
    })

    return res.status(201).json({ account })
}

// GET /api/accounts
async function listUserAccounts(req, res) {
    const accounts = await accountModel.find({
        user: req.user._id,
        isArchived: false
    })

    return res.status(200).json({ accounts })
}

// GET /api/accounts/balance/:accountId
async function getAccountBalance(req, res) {
    const { accountId } = req.params

    const account = await accountModel.findOne({
        _id: accountId,
        user: req.user._id,
        isArchived: false
    })

    if (!account) return res.status(404).json({ message: "Account not found" })

    // getBalance adds all credits and subtracts all debits in the ledger.
    const balance = await account.getBalance()

    return res.status(200).json({
        accountId: account._id,
        balance
    })
}

// DELETE /api/accounts/:accountId
async function archiveAccount(req, res) {
    const { accountId } = req.params

    if (!mongoose.isObjectIdOrHexString(accountId)) {
        return res.status(400).json({ message: "Invalid account id" })
    }

    const account = await accountModel.findOne({
        _id: accountId,
        user: req.user._id,
        isArchived: false
    })

    if (!account) return res.status(404).json({ message: "Account not found" })

    // A non-zero account cannot disappear while it still contains money.
    const balance = await account.getBalance()
    if (balance !== 0) {
        return res.status(400).json({
            message: "Transfer or spend the remaining balance before deleting this account"
        })
    }

    // Soft delete keeps old financial history but hides the account from the UI.
    account.isArchived = true
    await account.save()

    return res.status(200).json({ message: "Account deleted successfully" })
}

module.exports = {
    createAccount,
    listUserAccounts,
    getAccountBalance,
    archiveAccount
}
