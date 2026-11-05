/*
 * The same transaction categories appear on several screens.
 * Keeping one list prevents a category name or color from changing on only one screen.
 */
export const CATEGORY_DETAILS = {
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
