// MongoDB sends month numbers. This array gives each number a readable label.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

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
    const expenseCategories = []

    // Convert the totals object into a simple array used by the chart.
    const categoryEntries = Object.entries(categoryTotals)

    categoryEntries.forEach((entry) => {
        const category = entry[0]
        const totals = entry[1]

        if (totals.expense > 0) {
            expenseCategories.push({ cat: category, total: totals.expense })
        }
    })

    expenseCategories.sort((left, right) => right.total - left.total)
    return expenseCategories.slice(0, 6)
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

    const sortedMonths = Object.entries(monthlyMap)

    sortedMonths.sort((leftEntry, rightEntry) => {
        const leftKey = leftEntry[0]
        const rightKey = rightEntry[0]
        return leftKey.localeCompare(rightKey)
    })

    const latestSixMonths = sortedMonths.slice(-6)

    return latestSixMonths.map((entry) => {
        const key = entry[0]
        const values = entry[1]
        const keyParts = key.split("-")
        const year = keyParts[0]
        const month = keyParts[1]
        const monthIndex = Number.parseInt(month, 10) - 1

        return {
            label: MONTHS[monthIndex],
            year,
            income: values.income,
            expense: values.expense
        }
    })
}
