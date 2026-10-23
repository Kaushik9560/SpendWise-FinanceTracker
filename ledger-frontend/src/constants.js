/*
 * SHARED CONSTANTS
 * Values used by multiple components live here so labels/colors stay consistent.
 */

// Each transaction category gets a short text icon and one CSS color variable.
export const CATEGORY_META = {
    "Food & Dining": { icon: "FD", color: "var(--cat-food)" },
    Transport: { icon: "TR", color: "var(--cat-transport)" },
    Shopping: { icon: "SH", color: "var(--cat-shopping)" },
    "Bills & Utilities": { icon: "BU", color: "var(--cat-bills)" },
    Entertainment: { icon: "EN", color: "var(--cat-entertainment)" },
    "Health & Medical": { icon: "HM", color: "var(--cat-health)" },
    Education: { icon: "ED", color: "var(--cat-education)" },
    Travel: { icon: "TV", color: "var(--cat-travel)" },
    "Salary & Income": { icon: "IN", color: "var(--cat-salary)" },
    Investments: { icon: "IV", color: "var(--cat-investments)" },
    "Rent & Housing": { icon: "RH", color: "var(--cat-rent)" },
    Others: { icon: "OT", color: "var(--cat-others)" }
}

// MongoDB sends month numbers; charts use this array to show readable labels.
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// activeTab is a short id; the top bar uses this object to find its heading.
export const PAGE_TITLES = {
    dashboard: "Dashboard",
    expenses: "Expenses",
    analytics: "Analytics",
    accounts: "Accounts",
    transfer: "Transfer",
    budget: "Budget"
}

export function getPageSubtitle(activeTab, user) {
    // split(" ")[0] keeps only the first part of a full name.
    const firstName = user.name.split(" ")[0]
    const subtitles = {
        dashboard: `Good to see you, ${firstName}`,
        expenses: "Review income and spending in one place",
        analytics: "Understand where your money goes",
        accounts: "Manage your linked accounts",
        transfer: "Move money between your accounts",
        budget: "Plan monthly spending by category"
    }

    return subtitles[activeTab]
}
