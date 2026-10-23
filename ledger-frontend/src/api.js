/*
 * API LAYER
 * Components never call fetch directly. They call a named method from ledgerApi.
 * This keeps URL, cookies, timeout, JSON parsing, and errors in one place.
 */

// Production serves frontend and API from the same origin. Local React uses port 3000 for the API.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
    || (import.meta.env.PROD ? window.location.origin : "http://localhost:3000")

async function request(path, options = {}) {
    // AbortController lets us cancel a request that takes longer than 15 seconds.
    let response
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method: options.method || "GET", // Use GET unless the caller gives POST/DELETE.
            headers: options.body ? { "Content-Type": "application/json" } : {}, // Tell Express when body is JSON.
            credentials: "include", // Send the secure HttpOnly login cookie.
            body: options.body ? JSON.stringify(options.body) : undefined, // Objects must become JSON text.
            signal: controller.signal // Connect fetch to our timeout controller.
        })
    } catch (error) {
        // Network and timeout failures happen before an HTTP response exists.
        throw new Error(error.name === "AbortError"
            ? "The server took too long to respond. Please try again."
            : "Unable to connect to the server. Check your connection and try again.")
    } finally {
        // The request finished, so this timer is no longer needed.
        window.clearTimeout(timeout)
    }

    // Successful and failed API responses both use JSON; this guard handles unexpected HTML/text.
    const contentType = response.headers.get("content-type") || ""
    const data = contentType.includes("application/json")
        ? await response.json()
        : { message: "The server returned an unexpected response" }

    if (!response.ok) {
        const message = data.message || "Request failed"

        // App.jsx listens for this browser event and returns the user to login.
        if (response.status === 401) {
            window.dispatchEvent(new CustomEvent("ledger:unauthorized", {
                detail: { message }
            }))
        }

        // Attach backend metadata so auth code can detect cases like EMAIL_NOT_VERIFIED.
        const error = new Error(message)
        error.status = response.status
        error.code = data.code
        throw error
    }

    return data // Give parsed backend data back to the component that called us.
}

// Small named methods make component code read like: ledgerApi.login(details).
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
