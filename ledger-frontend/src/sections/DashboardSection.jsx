import { CATEGORY_DETAILS } from "../categories"
import { formatCurrency, formatRelativeDate } from "../lib/formatters"
import { Icon } from "../icons"

export default function DashboardSection(props) {
    const summary = props.summary
    const accounts = props.accounts
    const balances = props.balances
    const totalBalance = props.totalBalance
    const expenses = props.expenses
    const topExpenseCategories = props.topExpenseCategories
    const maxCatTotal = props.maxCatTotal
    const onShowModal = props.onShowModal
    const onSetActiveTab = props.onSetActiveTab

    // Start with zero because the summary API request may still be loading.
    let netBalance = 0
    let totalIncome = 0
    let totalExpense = 0
    let incomeCount = 0
    let expenseCount = 0

    if (summary && summary.summary) {
        netBalance = summary.summary.netBalance
        totalIncome = summary.summary.totalIncome
        totalExpense = summary.summary.totalExpense
        incomeCount = summary.summary.incomeCount
        expenseCount = summary.summary.expenseCount
    }

    let balanceClass = "balance-amount positive"
    if (netBalance < 0) {
        balanceClass = "balance-amount negative"
    }

    let accountWord = "accounts"
    if (accounts.length === 1) {
        accountWord = "account"
    }

    function showExpensesPage() {
        onSetActiveTab("expenses")
    }

    function showAnalyticsPage() {
        onSetActiveTab("analytics")
    }

    // This component is presentational: all data and click actions arrive as props.
    return (
        <div className="page-enter">
            <div className="balance-hero">
                <div className="balance-hero-inner">
                    <div className="balance-label">Net balance</div>
                    <div className={balanceClass}>
                        {formatCurrency(netBalance)}
                    </div>
                    <div className="balance-sub">
                        Across {accounts.length} {accountWord}
                        {Object.keys(balances).length > 0 && ` · Ledger: ${formatCurrency(totalBalance)}`}
                    </div>
                </div>
                <div className="balance-hero-stats">
                    <div className="hero-stat income">
                        <span className="hs-icon">{Icon.income}</span>
                        <div>
                            <div className="hs-label">Income</div>
                            <div className="hs-val">{formatCurrency(totalIncome)}</div>
                        </div>
                    </div>
                    <div className="hs-divider" />
                    <div className="hero-stat expense">
                        <span className="hs-icon">{Icon.expense}</span>
                        <div>
                            <div className="hs-label">Expenses</div>
                            <div className="hs-val">{formatCurrency(totalExpense)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card" style={{ "--accent": "var(--green)" }}>
                    <div className="stat-icon">{Icon.income}</div>
                    <div className="stat-info">
                        <div className="stat-label">Total income</div>
                        <div className="stat-val">{formatCurrency(totalIncome)}</div>
                        <div className="stat-sub">{incomeCount} entries</div>
                    </div>
                </div>
                <div className="stat-card" style={{ "--accent": "var(--red)" }}>
                    <div className="stat-icon">{Icon.expense}</div>
                    <div className="stat-info">
                        <div className="stat-label">Total expenses</div>
                        <div className="stat-val">{formatCurrency(totalExpense)}</div>
                        <div className="stat-sub">{expenseCount} entries</div>
                    </div>
                </div>
                <div className="stat-card" style={{ "--accent": "var(--blue)" }}>
                    <div className="stat-icon">{Icon.accounts}</div>
                    <div className="stat-info">
                        <div className="stat-label">Accounts</div>
                        <div className="stat-val">{accounts.length}</div>
                        <div className="stat-sub">{accounts.length} active</div>
                    </div>
                </div>
                <div className="stat-card" style={{ "--accent": "var(--amber)" }}>
                    <div className="stat-icon">{Icon.analytics}</div>
                    <div className="stat-info">
                        <div className="stat-label">Transactions</div>
                        <div className="stat-val">{expenses.length}</div>
                        <div className="stat-sub">this period</div>
                    </div>
                </div>
            </div>

            <div className="two-col">
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Recent transactions</span>
                        <button className="btn btn-ghost btn-sm" onClick={showExpensesPage}>View all →</button>
                    </div>
                    <div className="card-body">
                        {expenses.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-icon">{Icon.expenses}</div>
                                <div className="empty-title">No transactions yet</div>
                                <div className="empty-sub">Add your first income or expense to get started.</div>
                                <button className="btn btn-primary" onClick={onShowModal} id="dash-add-first-btn">
                                    {Icon.plus} Add transaction
                                </button>
                            </div>
                        )}

                        {expenses.length > 0 && (
                            <div className="tx-list">
                                {/* slice limits this preview; the Expenses tab shows all rows. */}
                                {expenses.slice(0, 6).map((expense) => {
                                    const meta = CATEGORY_DETAILS[expense.category] || { icon: "OT", color: "var(--text-2)" }
                                    let amountSign = "−"
                                    if (expense.type === "income") amountSign = "+"

                                    return (
                                        <div key={expense._id} className="tx-item">
                                            <div className="tx-cat-icon" style={{ background: `${meta.color}20`, color: meta.color }}>
                                                {meta.icon}
                                            </div>
                                            <div className="tx-info">
                                                <div className="tx-title">{expense.description || expense.category}</div>
                                                <div className="tx-sub">{expense.category} · {formatRelativeDate(expense.date)}</div>
                                            </div>
                                            <div className={`tx-amount ${expense.type}`}>
                                                {amountSign}{formatCurrency(expense.amount)}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Top spending</span>
                        <button className="btn btn-ghost btn-sm" onClick={showAnalyticsPage}>Analytics →</button>
                    </div>
                    <div className="card-body">
                        {topExpenseCategories.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-icon">{Icon.analytics}</div>
                                <div className="empty-title">No spending data</div>
                                <div className="empty-sub">Add expenses to see your spending breakdown.</div>
                            </div>
                        )}

                        {topExpenseCategories.length > 0 && (
                            <div className="cat-bars">
                                {topExpenseCategories.map((categoryItem) => {
                                    const category = categoryItem.cat
                                    const total = categoryItem.total
                                    const meta = CATEGORY_DETAILS[category] || { icon: "OT", color: "var(--text-2)" }
                                    // The largest category is 100%; others are proportional to it.
                                    const width = (total / maxCatTotal) * 100

                                    return (
                                        <div key={category} className="cat-bar-row">
                                            <div className="cat-bar-label">
                                                <span>{category}</span>
                                            </div>
                                            <div className="cat-bar-track">
                                                <div className="cat-bar-fill" style={{ width: `${width}%`, background: meta.color }} />
                                            </div>
                                            <div className="cat-bar-val">{formatCurrency(total)}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
