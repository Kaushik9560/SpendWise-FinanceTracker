// Intl uses the browser's built-in locale rules, so we do not manually add ₹ or commas.
export function formatCurrency(amount, currency = "INR") {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 0
    }).format(amount)
}

export function formatDate(dateStr) {
    // Convert backend ISO text into a JavaScript Date, then show an Indian-style date.
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date)
}

export function formatRelativeDate(dateStr) {
    const date = new Date(dateStr)
    const now = new Date()
    // 86,400,000 is the number of milliseconds in one day.
    const diff = Math.floor((now.getTime() - date.getTime()) / 86400000)

    if (diff === 0) return "Today"
    if (diff === 1) return "Yesterday"
    if (diff < 7) return `${diff} days ago`
    return formatDate(dateStr)
}

export function generateIdempotencyKey() {
    // A timestamp plus random text is enough for a unique key in this client app.
    return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
