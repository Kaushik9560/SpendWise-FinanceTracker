import { formatCurrency } from "../lib/formatters"
import { Icon } from "../icons"

const TRANSFER_STEPS = [
    { icon: "01", title: "Immediate", desc: "Balances update as soon as a transfer completes" },
    { icon: "02", title: "Duplicate-safe", desc: "A unique request key prevents repeated transfers" },
    { icon: "03", title: "All or nothing", desc: "A failed transfer leaves both accounts unchanged" },
    { icon: "04", title: "Ledger-backed", desc: "Every debit has a matching credit record" }
]

/*
 * Displays the controlled form for moving money between two user accounts.
 * App owns the form object and submit logic; this section updates fields through
 * setTransfer and sends form submission back through onSubmit.
 */
export default function TransferSection(props) {
    const accounts = props.accounts
    const balances = props.balances
    const transfer = props.transfer
    const setTransfer = props.setTransfer
    const busyAction = props.busyAction
    const onSubmit = props.onSubmit
    const onGoToAccounts = props.onGoToAccounts

    // This component owns no state; values and setTransfer come from App.
    const canTransfer = accounts.length >= 2
    const transferIsBusy = busyAction === "transfer"
    const destinationAccounts = accounts.filter((account) => account._id !== transfer.fromAccount)

    function handleFromAccountChange(event) {
        setTransfer({ ...transfer, fromAccount: event.target.value })
    }

    function handleToAccountChange(event) {
        setTransfer({ ...transfer, toAccount: event.target.value })
    }

    function handleAmountChange(event) {
        setTransfer({ ...transfer, amount: event.target.value })
    }

    function getAccountName(account) {
        if (account.name) return account.name
        return `Account ...${account._id.slice(-8)}`
    }

    function getAccountBalance(accountId) {
        if (balances[accountId] === undefined) return "?"
        return formatCurrency(balances[accountId])
    }

    return (
        <div className="page-enter">
            <div className="transfer-layout">
                <div className="card transfer-card">
                    <div className="card-header">
                        <span className="card-title">Transfer funds</span>
                    </div>
                    <div className="card-body">
                        {!canTransfer && (
                            <div className="empty-state">
                                <div className="empty-icon">{Icon.transfer}</div>
                                <div className="empty-title">Need at least 2 accounts</div>
                                <div className="empty-sub">Create more accounts to transfer between them.</div>
                                <button className="btn btn-primary" onClick={onGoToAccounts}>
                                    Go to Accounts →
                                </button>
                            </div>
                        )}

                        {canTransfer && (
                            <form onSubmit={onSubmit} className="transfer-form">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="from-account">From account</label>
                                    {/* Spread keeps the other fields while replacing fromAccount. */}
                                    <select
                                        id="from-account"
                                        className="form-input form-select"
                                        value={transfer.fromAccount}
                                        onChange={handleFromAccountChange}
                                        required
                                    >
                                        <option value="">Select source account...</option>
                                        {accounts.map((account) => (
                                            <option key={account._id} value={account._id}>
                                                {getAccountName(account)} — {getAccountBalance(account._id)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="to-account">To account</label>
                                    <select
                                        id="to-account"
                                        className="form-input form-select"
                                        value={transfer.toAccount}
                                        onChange={handleToAccountChange}
                                        required
                                    >
                                        <option value="">Select destination account...</option>
                                        {/* Source is filtered out so both accounts cannot be the same. */}
                                        {destinationAccounts.map((account) => (
                                            <option key={account._id} value={account._id}>
                                                {getAccountName(account)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="transfer-amount">Amount (₹)</label>
                                    <div className="amount-input-wrap">
                                        <span className="amount-prefix">₹</span>
                                        <input
                                            id="transfer-amount"
                                            className="form-control form-input amount-input"
                                            type="number"
                                            placeholder="0.00"
                                            min="0.01"
                                            step="0.01"
                                            value={transfer.amount}
                                            onChange={handleAmountChange}
                                            required
                                        />
                                    </div>
                                </div>
                                <button
                                    id="transfer-submit-btn"
                                    className="btn btn-primary w-100 btn-lg"
                                    type="submit"
                                    disabled={transferIsBusy}
                                    style={{ marginTop: "0.5rem" }}
                                >
                                    {transferIsBusy && <span className="spinner" />}
                                    {!transferIsBusy && Icon.transfer}
                                    {transferIsBusy && "Processing..."}
                                    {!transferIsBusy && "Transfer now"}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                <div className="transfer-info">
                    <div className="card">
                        <div className="card-header"><span className="card-title">How transfers work</span></div>
                        <div className="card-body">
                            <div className="info-list">
                                {TRANSFER_STEPS.map((item) => (
                                    <div key={item.title} className="info-item">
                                        <span className="info-icon">{item.icon}</span>
                                        <div>
                                            <div className="info-title">{item.title}</div>
                                            <div className="info-desc">{item.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
