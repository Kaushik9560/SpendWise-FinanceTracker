import BudgetCard from "../components/BudgetCard"
import { CATEGORY_DETAILS } from "../categories"
import { Icon } from "../icons"

// Income categories do not need a spending limit.
const EXPENSE_CATEGORIES = Object.entries(CATEGORY_DETAILS).filter((categoryEntry) => {
    const category = categoryEntry[0]
    return category !== "Salary & Income" && category !== "Investments"
})

export default function BudgetSection(props) {
    const budgets = props.budgets
    const budgetEdit = props.budgetEdit
    const setBudgetEdit = props.setBudgetEdit
    const categoryTotals = props.categoryTotals
    const busyAction = props.busyAction
    const onExportCSV = props.onExportCSV
    const onSaveBudget = props.onSaveBudget
    const onRemoveBudget = props.onRemoveBudget

    return (
        <div className="page-enter">
            <div className="budget-toolbar">
                <p className="budget-hint">
                    Set monthly spending limits per category. Progress is calculated from this month's expenses and your limits sync across devices.
                </p>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button id="export-csv-btn" className="btn btn-secondary" onClick={onExportCSV}>
                        {Icon.download} Export CSV
                    </button>
                </div>
            </div>

            <div className="budget-grid">
                {EXPENSE_CATEGORIES.map((categoryEntry) => {
                    const category = categoryEntry[0]
                    const categoryStyle = categoryEntry[1]
                    const budget = budgets.find((item) => item.category === category)
                    let spent = 0

                    if (categoryTotals[category]) {
                        spent = categoryTotals[category].expense
                    }

                    return (
                        <BudgetCard
                            key={category}
                            category={category}
                            categoryStyle={categoryStyle}
                            budget={budget}
                            spent={spent}
                            budgetEdit={budgetEdit}
                            setBudgetEdit={setBudgetEdit}
                            busyAction={busyAction}
                            onSaveBudget={onSaveBudget}
                            onRemoveBudget={onRemoveBudget}
                        />
                    )
                })}
            </div>
        </div>
    )
}
