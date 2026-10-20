const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
    || (import.meta.env.PROD ? window.location.origin : "http://localhost:3000")

async function request(path, options = {}) {
    let response
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method: options.method || "GET",
            headers: options.body ? { "Content-Type": "application/json" } : {},
            credentials: "include",
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: controller.signal
        })
    } catch (error) {
        throw new Error(error.name === "AbortError"
            ? "The server took too long to respond. Please try again."
            : "Unable to connect to the server. Check your connection and try again.")
    } finally {
        window.clearTimeout(timeout)
    }

    const contentType = response.headers.get("content-type") || ""
    const data = contentType.includes("application/json")
        ? await response.json()
        : { message: "The server returned an unexpected response" }

    if (!response.ok) {
        const message = data.message || "Request failed"

        if (response.status === 401) {
            window.dispatchEvent(new CustomEvent("ledger:unauthorized", {
                detail: { message }
            }))
        }

        const error = new Error(message)
        error.status = response.status
        error.code = data.code
        throw error
    }

    return data
}

export const ledgerApi = {
    baseUrl: API_BASE_URL,
    health: () => request("/api/health"),
    register: (body) => request("/api/auth/register", { method: "POST", body }),
    verifyEmail: (token) => request("/api/auth/verify-email", { method: "POST", body: { token } }),
    resendVerification: (email) => request("/api/auth/resend-verification", { method: "POST", body: { email } }),
    login: (body) => request("/api/auth/login", { method: "POST", body }),
    forgotPassword: (email) => request("/api/auth/forgot-password", { method: "POST", body: { email } }),
    resetPassword: (token, password) => request("/api/auth/reset-password", { method: "POST", body: { token, password } }),
    session: () => request("/api/auth/session"),
    logout: () => request("/api/auth/logout", { method: "POST" }),
    deleteUserAccount: (body) => request("/api/auth/account", { method: "DELETE", body }),
    listAccounts: () => request("/api/accounts"),
    createAccount: (body) => request("/api/accounts", { method: "POST", body }),
    deleteAccount: (accountId) => request(`/api/accounts/${accountId}`, { method: "DELETE" }),
    getBalance: (accountId) => request(`/api/accounts/balance/${accountId}`),
    transfer: (body) => request("/api/transactions", { method: "POST", body }),
    createMoneyEvent: (body) => request("/api/expenses", { method: "POST", body }),
    listMoneyEvents: () => request("/api/expenses"),
    getMoneyEventSummary: () => request("/api/expenses/summary"),
    reverseMoneyEvent: (id) => request(`/api/expenses/${id}`, { method: "DELETE" }),
    listBudgets: () => request("/api/budgets"),
    saveBudget: (body) => request("/api/budgets", { method: "POST", body }),
    removeBudget: (category) => request(`/api/budgets/${encodeURIComponent(category)}`, { method: "DELETE" })
}
