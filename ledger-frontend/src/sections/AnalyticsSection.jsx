import { CATEGORY_DETAILS } from "../categories"
import { formatCurrency } from "../lib/formatters"
import { Icon } from "../icons"

/*
 * Displays summary cards, six-month trends, and category spending breakdown.
 * App prepares all totals/chart arrays and passes them as props, so this section
 * focuses only on converting those values into visual cards and proportional bars.
 */
export default function AnalyticsSection(props) {
    const summary = props.summary
    const monthlyData = props.monthlyData
    const maxMonthlyVal = props.maxMonthlyVal
    const topExpenseCategories = props.topExpenseCategories
    const totalExpense = props.totalExpense

    // Start with zero because the API data may still be loading.
    let totalIncome = 0
    let totalExpenseValue = 0
    let netBalance = 0
    let incomeCount = 0
    let expenseCount = 0

    if (summary && summary.summary) {
        totalIncome = summary.summary.totalIncome
        totalExpenseValue = summary.summary.totalExpense
        netBalance = summary.summary.netBalance
        incomeCount = summary.summary.incomeCount
        expenseCount = summary.summary.expenseCount
    }

    // Savings rate compares net savings with income and is shown on the net card.
    let savingsRate = "No income recorded"
    if (totalIncome > 0) {
        const savingsPercentage = Math.round((netBalance / totalIncome) * 100)
        savingsRate = `${savingsPercentage}% savings rate`
    }

    let netCardClass = "analytics-card net-card positive"
    if (netBalance < 0) {
        netCardClass = "analytics-card net-card negative"
    }

    return (
        <div className="page-enter">
            <div className="analytics-summary">
                <div className="analytics-card income-card">
                    <div className="ac-icon">{Icon.income}</div>
                    <div className="ac-label">Total income</div>
                    <div className="ac-val">{formatCurrency(totalIncome)}</div>
                    <div className="ac-sub">{incomeCount} transactions</div>
                </div>
                <div className="analytics-card expense-card">
                    <div className="ac-icon">{Icon.expense}</div>
                    <div className="ac-label">Total expenses</div>
                    <div className="ac-val">{formatCurrency(totalExpenseValue)}</div>
                    <div className="ac-sub">{expenseCount} transactions</div>
                </div>
                <div className={netCardClass}>
                    <div className="ac-icon">{Icon.wallet}</div>
                    <div className="ac-label">Net savings</div>
                    <div className="ac-val">{formatCurrency(netBalance)}</div>
                    <div className="ac-sub">{savingsRate}</div>
                </div>
            </div>

            <div className="two-col">
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Monthly trend</span>
                    </div>
                    <div className="card-body">
                        {monthlyData.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-icon">{Icon.analytics}</div>
                                <div className="empty-title">No data yet</div>
                                <div className="empty-sub">Add transactions to see your monthly trend.</div>
                            </div>
                        )}

                        {monthlyData.length > 0 && (
                            <div className="bar-chart">
                                {monthlyData.map((month) => (
                                    <div key={`${month.label}-${month.year}`} className="bar-col">
                                        <div className="bar-pair">
                                            {/* 140px is the maximum visual height of a chart bar. */}
                                            <div
                                                className="bar bar-income"
                                                style={{ height: `${(month.income / maxMonthlyVal) * 140}px` }}
                                                title={`Income: ${formatCurrency(month.income)}`}
                                            />
                                            <div
                                                className="bar bar-expense"
                                                style={{ height: `${(month.expense / maxMonthlyVal) * 140}px` }}
                                                title={`Expense: ${formatCurrency(month.expense)}`}
                                            />
                                        </div>
                                        <div className="bar-label">{month.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="chart-legend">
                            <div className="legend-item"><span className="legend-dot income" />Income</div>
                            <div className="legend-item"><span className="legend-dot expense" />Expenses</div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Spending by category</span>
                    </div>
                    <div className="card-body">
                        {topExpenseCategories.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-icon">{Icon.expenses}</div>
                                <div className="empty-title">No spending data</div>
                                <div className="empty-sub">Add expenses to see category breakdown.</div>
                            </div>
                        )}

                        {topExpenseCategories.length > 0 && (
                            <div className="cat-breakdown">
                                {topExpenseCategories.map((categoryItem) => {
                                    const category = categoryItem.cat
                                    const total = categoryItem.total
                                    const meta = CATEGORY_DETAILS[category] || { icon: "OT", color: "var(--text-2)" }
                                    // Guard totalExpense to avoid division by zero.
                                    let percent = 0
                                    if (totalExpense > 0) {
                                        percent = Math.round((total / totalExpense) * 100)
                                    }

                                    return (
                                        <div key={category} className="cat-breakdown-row">
                                            <div className="cbr-icon" style={{ background: `${meta.color}20`, color: meta.color }}>
                                                {meta.icon}
                                            </div>
                                            <div className="cbr-info">
                                                <div className="cbr-name">{category}</div>
                                                <div className="cbr-bar-track">
                                                    <div className="cbr-bar-fill" style={{ width: `${percent}%`, background: meta.color }} />
                                                </div>
                                            </div>
                                            <div className="cbr-right">
                                                <div className="cbr-val">{formatCurrency(total)}</div>
                                                <div className="cbr-pct">{percent}%</div>
                                            </div>
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
