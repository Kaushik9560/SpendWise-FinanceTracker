/*
 * API LAYER
 * Components never call fetch directly. They call a named method from ledgerApi.
 * This keeps URL, cookies, timeout, JSON parsing, and errors in one place.
 */

// Use the environment URL when it exists. Otherwise use the normal local/production URL.
let API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL && import.meta.env.PROD) {
    API_BASE_URL = window.location.origin
}

if (!API_BASE_URL) {
    API_BASE_URL = "http://localhost:3000"
}

/*
 * Sends every frontend request through one consistent pipeline.
 * Named ledgerApi methods provide the path/options; this function adds cookies,
 * JSON conversion, and a 15-second timeout, then parses the response.
 * HTTP failures become Error objects, and a 401 also notifies App to log out.
 */
async function request(path, options = {}) {
    // AbortController lets us cancel a request that takes longer than 15 seconds.
    let response
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)

    const requestOptions = {
        method: options.method || "GET",
        credentials: "include", // Sends the secure HttpOnly login cookie.
        signal: controller.signal
    }

    // A request body must be converted from a JavaScript object to JSON text.
    if (options.body) {
        requestOptions.headers = { "Content-Type": "application/json" }
        requestOptions.body = JSON.stringify(options.body)
    }

    try {
        response = await fetch(`${API_BASE_URL}${path}`, requestOptions)
    } catch (error) {
        // Network and timeout failures happen before an HTTP response exists.
        if (error.name === "AbortError") {
            throw new Error("The server took too long to respond. Please try again.")
        }

        throw new Error("Unable to connect to the server. Check your connection and try again.")
    } finally {
        // The request finished, so this timer is no longer needed.
        window.clearTimeout(timeout)
    }

    const contentType = response.headers.get("content-type") || ""
    let data

    if (contentType.includes("application/json")) {
        data = await response.json()
    } else {
        data = { message: "The server returned an unexpected response" }
    }

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

/*
 * This object is the public frontend API used by App.jsx.
 * Each method describes one backend endpoint and delegates common work to request,
 * keeping fetch details and endpoint URLs out of visual React components.
 */
export const ledgerApi = {
    baseUrl: API_BASE_URL,
    health: () => request("/api/health"),
    register: (body) => request("/api/auth/register", { method: "POST", body: body }),
    verifyEmail: (token) => request("/api/auth/verify-email", { method: "POST", body: { token: token } }),
    resendVerification: (email) => request("/api/auth/resend-verification", { method: "POST", body: { email: email } }),
    login: (body) => request("/api/auth/login", { method: "POST", body: body }),
    forgotPassword: (email) => request("/api/auth/forgot-password", { method: "POST", body: { email: email } }),
    resetPassword: (token, password) => request("/api/auth/reset-password", {
        method: "POST",
        body: { token: token, password: password }
    }),
    session: () => request("/api/auth/session"),
    logout: () => request("/api/auth/logout", { method: "POST" }),
    deleteUserAccount: (body) => request("/api/auth/account", { method: "DELETE", body: body }),
    listAccounts: () => request("/api/accounts"),
    createAccount: (body) => request("/api/accounts", { method: "POST", body: body }),
    deleteAccount: (accountId) => request(`/api/accounts/${accountId}`, { method: "DELETE" }),
    getBalance: (accountId) => request(`/api/accounts/balance/${accountId}`),
    transfer: (body) => request("/api/transactions", { method: "POST", body: body }),
    createMoneyEvent: (body) => request("/api/expenses", { method: "POST", body: body }),
    listMoneyEvents: () => request("/api/expenses"),
    getMoneyEventSummary: () => request("/api/expenses/summary"),
    reverseMoneyEvent: (id) => request(`/api/expenses/${id}`, { method: "DELETE" }),
    listBudgets: () => request("/api/budgets"),
    saveBudget: (body) => request("/api/budgets", { method: "POST", body: body }),
    removeBudget(category) {
        const safeCategory = encodeURIComponent(category)
        return request(`/api/budgets/${safeCategory}`, { method: "DELETE" })
    }
}
