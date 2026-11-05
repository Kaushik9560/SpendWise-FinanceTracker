import { CATEGORY_DETAILS } from "../categories"
import { formatCurrency, formatDate } from "../lib/formatters"
import { Icon } from "../icons"

const FILTERS = ["all", "expense", "income"]

function getFilterLabel(filter) {
    if (filter === "all") return "All"
    if (filter === "expense") return "Expenses"
    return "Income"
}

export default function ExpensesSection(props) {
    const expenseFilter = props.expenseFilter
    const filteredExpenses = props.filteredExpenses
    const onSetExpenseFilter = props.onSetExpenseFilter
    const onShowModal = props.onShowModal
    const onReverseMoneyEvent = props.onReverseMoneyEvent

    let transactionWord = "transactions"
    if (filteredExpenses.length === 1) {
        transactionWord = "transaction"
    }

    let emptyMessage = `No ${expenseFilter} entries yet.`
    if (expenseFilter === "all") {
        emptyMessage = "Add your first transaction to get started."
    }

    // Parent performs filtering; this section only renders tabs and rows.
    return (
        <div className="page-enter">
            <div className="filter-bar">
                <div className="filter-tabs">
                    {/* One array + map is simpler than three copied buttons. */}
                    {FILTERS.map((filter) => {
                        let buttonClass = "filter-tab"
                        if (expenseFilter === filter) {
                            buttonClass += " active"
                        }

                        return (
                            <button
                                key={filter}
                                id={`filter-${filter}`}
                                className={buttonClass}
                                onClick={() => onSetExpenseFilter(filter)}
                            >
                                {getFilterLabel(filter)}
                            </button>
                        )
                    })}
                </div>
                <div className="filter-count">
                    {filteredExpenses.length} {transactionWord}
                </div>
            </div>

            {filteredExpenses.length === 0 && (
                <div className="card">
                    <div className="empty-state" style={{ padding: "4rem" }}>
                        <div className="empty-icon">{Icon.expenses}</div>
                        <div className="empty-title">No transactions found</div>
                        <div className="empty-sub">{emptyMessage}</div>
                        <button className="btn btn-primary" onClick={onShowModal} id="expenses-add-btn">
                            {Icon.plus} Add transaction
                        </button>
                    </div>
                </div>
            )}

            {filteredExpenses.length > 0 && (
                <div className="card">
                    <div className="tx-list tx-list-full">
                        {filteredExpenses.map((expense) => {
                            // Fallback protects the UI if an old row has an unknown category.
                            const meta = CATEGORY_DETAILS[expense.category] || { icon: "OT", color: "var(--text-2)" }
                            let amountSign = "−"
                            if (expense.type === "income") amountSign = "+"

                            return (
                                <div key={expense._id} className="tx-item tx-item-full" id={`tx-${expense._id}`}>
                                    <div className="tx-cat-icon lg" style={{ background: `${meta.color}20`, color: meta.color }}>
                                        {meta.icon}
                                    </div>
                                    <div className="tx-info">
                                        <div className="tx-title">{expense.description || expense.category}</div>
                                        <div className="tx-sub">
                                            <span className="cat-tag" style={{ color: meta.color }}>{expense.category}</span>
                                            <span>·</span>
                                            <span>{formatDate(expense.date)}</span>
                                        </div>
                                    </div>
                                    <div className={`tx-amount ${expense.type}`}>
                                        {amountSign}{formatCurrency(expense.amount)}
                                    </div>
                                    <span className={`type-badge badge-${expense.type}`}>{expense.type}</span>
                                    <button
                                        className="icon-btn delete-btn"
                                        onClick={() => void onReverseMoneyEvent(expense._id)}
                                        title="Delete"
                                        id={`delete-${expense._id}`}
                                    >
                                        {Icon.trash}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
