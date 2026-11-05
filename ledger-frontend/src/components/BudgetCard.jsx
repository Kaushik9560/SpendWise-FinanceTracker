import { Icon } from "../icons"
import { formatCurrency } from "../lib/formatters"

/*
 * BudgetCard displays one category.
 * BudgetSection passes its data and click functions through props.
 */
export default function BudgetCard(props) {
    // BudgetSection gives this card all of these values through props.
    const category = props.category
    const categoryStyle = props.categoryStyle
    const budget = props.budget
    const spent = props.spent
    const budgetEdit = props.budgetEdit
    const setBudgetEdit = props.setBudgetEdit
    const busyAction = props.busyAction
    const onSaveBudget = props.onSaveBudget
    const onRemoveBudget = props.onRemoveBudget

    let isEditing = false
    if (budgetEdit && budgetEdit.category === category) {
        isEditing = true
    }
    const isOverBudget = Boolean(budget && spent > budget.limit)

    let progressPercent = 0
    let progressColor = categoryStyle.color
    let statusText = ""

    if (budget) {
        progressPercent = Math.min((spent / budget.limit) * 100, 100)

        if (isOverBudget) {
            progressColor = "var(--red)"
            statusText = `₹ Over by ${formatCurrency(spent - budget.limit)}`
        } else {
            statusText = `₹ ${formatCurrency(budget.limit - spent)} remaining`
        }
    }

    function toggleEditor() {
        if (isEditing) {
            setBudgetEdit(null)
            return
        }

        let currentLimit = ""
        if (budget) currentLimit = String(budget.limit)
        setBudgetEdit({ category, value: currentLimit })
    }

    function updateLimit(event) {
        setBudgetEdit({ category, value: event.target.value })
    }

    function handleLimitKeyDown(event) {
        if (event.key === "Enter") {
            void onSaveBudget(category, budgetEdit.value)
        }

        if (event.key === "Escape") {
            setBudgetEdit(null)
        }
    }

    let cardClassName = "budget-card"
    let limitClassName = "budget-limit"
    let statusClassName = "budget-status ok"
    let progressClassName = "budget-progress-fill"
    let editButtonTitle = "Set budget"
    let editButtonIcon = Icon.plus

    if (budget) {
        editButtonTitle = "Edit budget"
        editButtonIcon = Icon.edit
    }

    if (isOverBudget) {
        cardClassName += " over-budget"
        limitClassName += " over"
        statusClassName = "budget-status over"
        progressClassName += " over"
    }

    return (
        <div className={cardClassName} id={`budget-${category.replace(/\s+/g, "-").toLowerCase()}`}>
            <div className="budget-card-header">
                <div className="budget-cat-info">
                    <span
                        className="budget-cat-icon"
                        style={{ background: `${categoryStyle.color}20`, color: categoryStyle.color }}
                    >
                        {categoryStyle.icon}
                    </span>
                    <span className="budget-cat-name">{category}</span>
                </div>

                <div className="budget-actions">
                    {budget && (
                        <button
                            className="icon-btn"
                            onClick={() => void onRemoveBudget(category)}
                            title="Remove budget"
                            disabled={busyAction === "removeBudget"}
                        >
                            {Icon.trash}
                        </button>
                    )}

                    <button
                        className="icon-btn"
                        onClick={toggleEditor}
                        title={editButtonTitle}
                    >
                        {editButtonIcon}
                    </button>
                </div>
            </div>

            {isEditing && (
                <div className="budget-edit-row">
                    <div className="amount-input-wrap" style={{ flex: 1 }}>
                        <span className="amount-prefix">₹</span>
                        <input
                            className="form-control form-input amount-input"
                            type="number"
                            placeholder="Monthly limit"
                            value={budgetEdit.value}
                            onChange={updateLimit}
                            onKeyDown={handleLimitKeyDown}
                            autoFocus
                        />
                    </div>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => void onSaveBudget(category, budgetEdit.value)}
                        disabled={busyAction === "saveBudget"}
                    >
                        Save
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setBudgetEdit(null)}>
                        Cancel
                    </button>
                </div>
            )}

            <div className="budget-amounts">
                <div>
                    <div className="budget-spent">{formatCurrency(spent)}</div>
                    <div className="budget-spent-label">spent</div>
                </div>

                {budget && (
                    <div style={{ textAlign: "right" }}>
                        <div className={limitClassName}>{formatCurrency(budget.limit)}</div>
                        <div className="budget-spent-label">limit</div>
                    </div>
                )}

                {!budget && <div className="budget-no-limit">No limit set</div>}
            </div>

            {budget && (
                <div className="budget-progress-track">
                    <div
                        className={progressClassName}
                        style={{ width: `${progressPercent}%`, background: progressColor }}
                    />
                </div>
            )}

            {budget && <div className={statusClassName}>{statusText}</div>}
        </div>
    )
}
