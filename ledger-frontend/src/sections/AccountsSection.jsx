import { Icon } from "../icons"
import { formatCurrency, formatDate } from "../lib/formatters"

export default function AccountsSection(props) {
    const accounts = props.accounts
    const balances = props.balances
    const busyAction = props.busyAction
    const onRefreshAccounts = props.onRefreshAccounts
    const onCreateAccount = props.onCreateAccount
    const onDeleteAccount = props.onDeleteAccount
    const onDeleteUserAccount = props.onDeleteUserAccount

    const isRefreshing = busyAction === "refreshAccounts"
    const isCreatingAccount = busyAction === "createAccount"
    const isDeletingUser = busyAction === "deleteUserAccount"

    function getAccountName(account) {
        if (account.name) return account.name
        return `Account ...${account._id.slice(-8)}`
    }

    function getBalanceText(accountId) {
        if (balances[accountId] === undefined) return "—"
        return formatCurrency(balances[accountId])
    }

    // Accounts and balances arrive separately because balance comes from ledger entries.
    return (
        <div className="page-enter">
            <div className="accounts-actions">
                <button
                    id="accounts-refresh-btn"
                    className="btn btn-secondary"
                    onClick={() => void onRefreshAccounts()}
                    disabled={isRefreshing}
                >
                    {isRefreshing && <span className="spinner" />}
                    {!isRefreshing && Icon.refresh}
                    Refresh
                </button>
                <button
                    id="accounts-create-btn"
                    className="btn btn-primary"
                    onClick={() => void onCreateAccount()}
                    disabled={isCreatingAccount}
                >
                    {isCreatingAccount && <span className="spinner" />}
                    {!isCreatingAccount && Icon.plus}
                    New account
                </button>
            </div>

            {accounts.length === 0 && (
                <div className="card">
                    <div className="empty-state" style={{ padding: "4rem" }}>
                        <div className="empty-icon">{Icon.accounts}</div>
                        <div className="empty-title">No accounts yet</div>
                        <div className="empty-sub">Create an account to start tracking.</div>
                        <button id="accounts-create-first-btn" className="btn btn-primary" onClick={() => void onCreateAccount()}>
                            {Icon.plus} Create first account
                        </button>
                    </div>
                </div>
            )}

            {accounts.length > 0 && (
                <div className="accounts-grid">
                    {/* key lets React track each account card between renders. */}
                    {accounts.map((account, index) => (
                        <div
                            key={account._id}
                            className={`account-card fade-up delay-${Math.min(index + 1, 4)}`}
                            id={`account-${account._id}`}
                        >
                            <div className="acc-header">
                                <div className="acc-icon">{Icon.accounts}</div>
                                <div className="acc-card-actions">
                                    <span className="acc-status badge-active">ACTIVE</span>
                                    <button
                                        className="icon-btn delete-btn"
                                        type="button"
                                        title="Delete account"
                                        aria-label="Delete account"
                                        disabled={busyAction === "deleteAccount"}
                                        onClick={() => void onDeleteAccount(account)}
                                    >
                                        {Icon.trash}
                                    </button>
                                </div>
                            </div>
                            <div className="acc-name">
                                {getAccountName(account)}
                            </div>
                            <div className="acc-balance">
                                {getBalanceText(account._id)}
                            </div>
                            <div className="acc-label">Current balance</div>
                            <div className="acc-meta">
                                <span>INR</span>
                                <span>Opened {formatDate(account.createdAt)}</span>
                            </div>
                            <div className="acc-id">ID: ...{account._id.slice(-12)}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="card" style={{ marginTop: "1.5rem" }}>
                <div className="card-header">
                    <span className="card-title">Session security</span>
                </div>
                <div className="card-body">
                    <div className="token-row">
                        <span className="token-label">Authentication</span>
                        <span className="token-val">Secure HttpOnly cookie</span>
                    </div>
                    <div className="danger-row">
                        <div>
                            <div className="danger-title">Delete SpendWise account</div>
                            <div className="danger-text">Permanently removes your accounts, transactions, ledger entries and budgets.</div>
                        </div>
                        <button
                            className="btn btn-danger"
                            type="button"
                            disabled={isDeletingUser}
                            onClick={() => void onDeleteUserAccount()}
                        >
                            {isDeletingUser && <span className="spinner" />}
                            {isDeletingUser && "Deleting..."}
                            {!isDeletingUser && "Delete my account"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
