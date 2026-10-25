const mongoose = require("mongoose")
const ledgerModel = require("./ledger.model")

// An account is a wallet/bank account owned by one SpendWise user.
const accountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [ true, "Account must be associated with a user" ],
        index: true
    },
    name: {
        type: String,
        required: [ true, "Account name is required" ],
        trim: true,
        maxlength: [ 50, "Account name cannot exceed 50 characters" ]
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    lastTransactionAt: Date
}, {
    timestamps: true
})

accountSchema.methods.getBalance = async function (options = {}) {
    // Balance is calculated from the ledger; it is not stored separately.
    const aggregation = ledgerModel.aggregate([
        { $match: { account: this._id } },
        {
            $group: {
                _id: null,
                totalDebit: {
                    $sum: {
                        $cond: [
                            { $eq: [ "$type", "DEBIT" ] },
                            "$amount",
                            0
                        ]
                    }
                },
                totalCredit: {
                    $sum: {
                        $cond: [
                            { $eq: [ "$type", "CREDIT" ] },
                            "$amount",
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                balance: { $subtract: [ "$totalCredit", "$totalDebit" ] }
            }
        }
    ])

    // Reuse the caller's MongoDB transaction when one is provided.
    if (options.session) aggregation.session(options.session)

    const balanceRows = await aggregation
    return balanceRows.length === 0 ? 0 : balanceRows[0].balance
}

const accountModel = mongoose.model("account", accountSchema)

module.exports = accountModel
