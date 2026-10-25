const mongoose = require("mongoose")

// A ledger row is one CREDIT or DEBIT applied to one account.
const ledgerSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: [ true, "Ledger must be associated with an account" ],
        index: true,
        immutable: true
    },
    amount: {
        type: Number,
        required: [ true, "Amount is required for creating a ledger entry" ],
        min: [ 0.01, "Ledger amount must be greater than zero" ],
        immutable: true
    },
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "transaction",
        required: [ true, "Ledger must be associated with a transaction" ],
        immutable: true
    },
    type: {
        type: String,
        enum: {
            values: [ "CREDIT", "DEBIT" ],
            message: "Type can be either CREDIT or DEBIT",
        },
        required: [ true, "Ledger type is required" ],
        immutable: true
    }
})

function preventLedgerModification() {
    throw new Error("Ledger entries are immutable and cannot be modified or deleted")
}

// Normal app code may only create ledger rows. Reversals create new opposite rows.
const blockedOperations = [
    "findOneAndUpdate", "updateOne", "deleteOne", "remove",
    "deleteMany", "updateMany", "findOneAndDelete", "findOneAndReplace"
]

for (const operation of blockedOperations) {
    ledgerSchema.pre(operation, preventLedgerModification)
}

const ledgerModel = mongoose.model("ledger", ledgerSchema)

module.exports = ledgerModel
