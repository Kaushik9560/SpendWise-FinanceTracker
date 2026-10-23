import { MONTHS } from "../constants"

/* Convert a flat transaction list into totals grouped by category.
 * Example result: { Food: { expense: 500, income: 0 } }
 */
export function buildCategoryTotals(expenses) {
    const categoryTotals = {}

    expenses.forEach((expense) => {
        // The first transaction creates an empty bucket for its category.
        if (!categoryTotals[expense.category]) {
            categoryTotals[expense.category] = { expense: 0, income: 0 }
        }

        // expense.type is either "income" or "expense", so it selects the right total.
        categoryTotals[expense.category][expense.type] += expense.amount
    })

    return categoryTotals
}

export function buildTopExpenseCategories(categoryTotals) {
    // Object.entries changes an object into [key, value] pairs that map can process.
    return Object.entries(categoryTotals)
        .map(([category, totals]) => ({ cat: category, total: totals.expense })) // Keep expense amount only.
        .filter((item) => item.total > 0) // Remove categories with no spending.
        .sort((left, right) => right.total - left.total) // Highest spending first.
        .slice(0, 6) // Dashboard only needs six bars.
}

// The backend returns separate income/expense rows; this joins them month-wise for the chart.
export function buildMonthlyData(monthlyTrend = []) {
    const monthlyMap = {}

    monthlyTrend.forEach((monthEntry) => {
        // 2026-02 sorts correctly as text; padStart turns month 2 into "02".
        const key = `${monthEntry._id.year}-${String(monthEntry._id.month).padStart(2, "0")}`

        if (!monthlyMap[key]) {
            monthlyMap[key] = { income: 0, expense: 0 }
        }

        monthlyMap[key][monthEntry._id.type] += monthEntry.total
    })

    return Object.entries(monthlyMap)
        .sort(([left], [right]) => left.localeCompare(right)) // Oldest to newest.
        .slice(-6) // Keep the latest six months.
        .map(([key, values]) => {
            const [, month] = key.split("-")
            return {
                label: MONTHS[Number.parseInt(month, 10) - 1],
                year: key.split("-")[0],
                ...values
            }
        })
}
