import { useEffect, useRef, useState } from "react"
import { ledgerApi } from "./api"
import { CATEGORY_META } from "./constants"
import { Icon } from "./icons"
import { buildCategoryTotals, buildMonthlyData, buildTopExpenseCategories } from "./lib/analytics"
import { formatCurrency, generateIdempotencyKey } from "./lib/formatters"
import {
    clearStoredSession,
    persistStoredSession,
    readStoredUser
} from "./lib/storage"
import MoneyEventModal from "./components/MoneyEventModal"
import AppSidebar from "./components/AppSidebar"
import AppTopbar from "./components/AppTopbar"
import AuthScreen from "./components/AuthScreen"
import CreateAccountModal from "./components/CreateAccountModal"
import DeleteAccountModal from "./components/DeleteAccountModal"
import DeleteUserModal from "./components/DeleteUserModal"
import ToastContainer from "./components/ToastContainer"
import AccountsSection from "./sections/AccountsSection"
import AnalyticsSection from "./sections/AnalyticsSection"
import BudgetSection from "./sections/BudgetSection"
import DashboardSection from "./sections/DashboardSection"
import ExpensesSection from "./sections/ExpensesSection"
import TransferSection from "./sections/TransferSection"

/*
 * App.jsx is the coordinator of the frontend.
 * It stores shared state, calls the API, and passes data to small UI components.
 * Keeping fixed values outside App prevents them from being recreated on every render.
 */
const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: Icon.dashboard },
    { id: "expenses", label: "Expenses", icon: Icon.expenses },
    { id: "analytics", label: "Analytics", icon: Icon.analytics },
    { id: "accounts", label: "Accounts", icon: Icon.accounts },
    { id: "transfer", label: "Transfer", icon: Icon.transfer },
    { id: "budget", label: "Budget", icon: Icon.budget }
]

const EMPTY_AUTH_FORM = { name: "", email: "", password: "", confirmPassword: "" }
const EMPTY_TRANSFER = { fromAccount: "", toAccount: "", amount: "" }

// Demo rows are data, not component logic, so they stay outside the component.
const DEMO_TRANSACTIONS = [
    { type: "income", category: "Salary & Income", amount: 75000, description: "Monthly salary", daysAgo: 1 },
    { type: "expense", category: "Rent & Housing", amount: 18000, description: "Monthly rent", daysAgo: 1 },
    { type: "expense", category: "Food & Dining", amount: 3200, description: "Groceries & dining", daysAgo: 2 },
    { type: "expense", category: "Transport", amount: 1500, description: "Uber & metro", daysAgo: 3 },
    { type: "expense", category: "Bills & Utilities", amount: 2100, description: "Electricity & internet", daysAgo: 5 },
    { type: "expense", category: "Entertainment", amount: 800, description: "Netflix & Hotstar", daysAgo: 7 },
    { type: "expense", category: "Shopping", amount: 4500, description: "Clothes & accessories", daysAgo: 8 },
    { type: "income", category: "Investments", amount: 5000, description: "Dividend payout", daysAgo: 10 },
    { type: "expense", category: "Health & Medical", amount: 1200, description: "Pharmacy & checkup", daysAgo: 12 },
    { type: "expense", category: "Education", amount: 2500, description: "Udemy courses", daysAgo: 15 }
]

// API errors are Error objects in normal cases; this helper also handles unknown values.
function errorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback
}

export default function App() {
    // URL parameters decide whether the first screen is login, reset, or verification.
    const urlParams = new URLSearchParams(window.location.search)
    const [mode, setMode] = useState(urlParams.has("reset") ? "reset" : "login")
    const [authForm, setAuthForm] = useState(EMPTY_AUTH_FORM)
    const [authNotice, setAuthNotice] = useState(null)
    const [resetToken] = useState(() => urlParams.get("reset") || "")
    const verificationStarted = useRef(false)
    const [user, setUser] = useState(() => urlParams.has("reset") ? null : readStoredUser())

    // Data received from the backend.
    const [accounts, setAccounts] = useState([])
    const [balances, setBalances] = useState({})
    const [expenses, setExpenses] = useState([])
    const [summary, setSummary] = useState(null)
    const [health, setHealth] = useState("checking")

    const [transfer, setTransfer] = useState(EMPTY_TRANSFER)

    // UI-only state: selected tab, open dialogs, filters, and loading buttons.
    const [activeTab, setActiveTab] = useState("dashboard")
    const [busyAction, setBusyAction] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [showAccountModal, setShowAccountModal] = useState(false)
    const [accountToDelete, setAccountToDelete] = useState(null)
    const [showDeleteUserModal, setShowDeleteUserModal] = useState(false)
    const [toasts, setToasts] = useState([])
    const [expenseFilter, setExpenseFilter] = useState("all")
    const [budgets, setBudgets] = useState([])
    const [budgetEdit, setBudgetEdit] = useState(null)

    // Derived values are calculated from state; they do not need separate useState variables.
    const totalBalance = Object.values(balances).reduce((sum, value) => sum + value, 0)
    const filteredExpenses = expenseFilter === "all"
        ? expenses
        : expenses.filter((expense) => expense.type === expenseFilter)

    const categoryTotals = buildCategoryTotals(expenses)
    const topExpenseCategories = buildTopExpenseCategories(categoryTotals)
    const totalExpense = summary?.summary.totalExpense || 0
    const maxCatTotal = topExpenseCategories[0]?.total || 1

    const monthlyData = buildMonthlyData(summary?.monthlyTrend || [])
    const maxMonthlyVal = Math.max(...monthlyData.flatMap((month) => [month.income, month.expense]), 1)

    /* TOASTS
     * A toast is a temporary message. Functional setState receives the latest
     * array, so quick successive messages do not overwrite one another.
     */
    function showToast(type, message) {
        const id = Date.now() + Math.random()
        setToasts((currentToasts) => [...currentToasts, { id, type, message }])
        setTimeout(() => {
            setToasts((currentToasts) => currentToasts.filter((currentToast) => currentToast.id !== id))
        }, 4000)
    }

    function removeToast(id) {
        setToasts((currentToasts) => currentToasts.filter((toastItem) => toastItem.id !== id))
    }

    /* SESSION HELPERS
     * localStorage keeps only safe display data. The real JWT stays in the
     * backend's HttpOnly cookie and is never read by React.
     */
    function setAuthenticatedUser(nextUser) {
        persistStoredSession(nextUser)
        setUser(nextUser)
    }

    function clearAuthenticatedSession() {
        clearStoredSession()
        setUser(null)
        setAccounts([])
        setBalances({})
        setExpenses([])
        setSummary(null)
        setBudgets([])
        setActiveTab("dashboard")
    }

    // Calls the backend health endpoint and converts the result into a UI label.
    async function runHealthCheck() {
        setHealth("checking")
        try {
            await ledgerApi.health()
            setHealth("online")
        } catch {
            setHealth("offline")
        }
    }

    /* ACCOUNT DATA
     * First fetch the account list, then fetch every account balance in parallel.
     * Promise.all waits until all balance requests have finished.
     */
    async function loadAccounts() {
        try {
            const response = await ledgerApi.listAccounts()
            setAccounts(response.accounts)

            const balanceMap = {}

            await Promise.all(response.accounts.map(async (account) => {
                try {
                    const balanceResponse = await ledgerApi.getBalance(account._id)
                    balanceMap[account._id] = balanceResponse.balance
                } catch {
                    balanceMap[account._id] = 0
                }
            }))

            setBalances(balanceMap)
        } catch {
            // Keep the current UI state if the refresh fails.
        }
    }

    async function handleRefreshAccounts() {
        if (!user) {
            return
        }

        setBusyAction("refreshAccounts")
        try {
            await loadAccounts()
            showToast("success", "Accounts refreshed")
        } catch {
            showToast("error", "Unable to refresh accounts right now")
        } finally {
            setBusyAction(null)
        }
    }

    async function handleCreateAccount(accountName) {
        if (!user) {
            return
        }

        const trimmedName = accountName.trim()

        if (!trimmedName || trimmedName.length > 50) {
            showToast("error", "Account name must be between 1 and 50 characters")
            return
        }

        setBusyAction("createAccount")
        try {
            const response = await ledgerApi.createAccount({ name: trimmedName })
            setAccounts((currentAccounts) => [response.account, ...currentAccounts])
            setBalances((currentBalances) => ({ ...currentBalances, [response.account._id]: 0 }))
            setShowAccountModal(false)
            showToast("success", `${response.account.name} created!`)
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to create account"))
        } finally {
            setBusyAction(null)
        }
    }

    async function handleDeleteAccount(account) {
        setBusyAction("deleteAccount")
        try {
            await ledgerApi.deleteAccount(account._id)
            setAccounts((currentAccounts) => currentAccounts.filter((item) => item._id !== account._id))
            setBalances((currentBalances) => {
                const nextBalances = { ...currentBalances }
                delete nextBalances[account._id]
                return nextBalances
            })
            setTransfer((currentTransfer) => ({
                fromAccount: currentTransfer.fromAccount === account._id ? "" : currentTransfer.fromAccount,
                toAccount: currentTransfer.toAccount === account._id ? "" : currentTransfer.toAccount,
                amount: currentTransfer.amount
            }))
            setAccountToDelete(null)
            showToast("success", "Account deleted")
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to delete account"))
        } finally {
            setBusyAction(null)
        }
    }

    /* MONEY EVENTS
     * "Money event" is the frontend name for an income or expense transaction.
     */
    async function loadMoneyEvents() {
        try {
            const response = await ledgerApi.listMoneyEvents()
            setExpenses(response.expenses)
        } catch {
            // Keep the current UI state if the refresh fails.
        }
    }

    async function loadMoneyEventSummary() {
        try {
            const response = await ledgerApi.getMoneyEventSummary()
            setSummary(response)
        } catch {
            // Keep the current UI state if the refresh fails.
        }
    }

    async function handleAddMoneyEvent(form) {
        setBusyAction("addMoneyEvent")
        try {
            await ledgerApi.createMoneyEvent({
                accountId: form.accountId,
                amount: Number.parseFloat(form.amount),
                type: form.type,
                category: form.category,
                description: form.description,
                date: form.date
            })
            showToast("success", `${form.type === "income" ? "Income" : "Expense"} recorded!`)
            setShowModal(false)
            await Promise.all([loadMoneyEvents(), loadMoneyEventSummary(), loadAccounts()])
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to save"))
        } finally {
            setBusyAction(null)
        }
    }

    async function handleReverseMoneyEvent(id) {
        if (!confirm("Delete this entry? The balance will be reversed.")) {
            return
        }

        try {
            await ledgerApi.reverseMoneyEvent(id)
            showToast("success", "Entry deleted and balance reversed.")
            await Promise.all([loadMoneyEvents(), loadMoneyEventSummary(), loadAccounts()])
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to delete"))
        }
    }

    // Adds example rows one-by-one so a new user can quickly explore the charts.
    async function handleSeedData() {
        if (!accounts.length) {
            showToast("error", "Create an account first!")
            return
        }

        const activeAccount = accounts[0]

        setBusyAction("seeding")

        let addedCount = 0
        for (const seed of DEMO_TRANSACTIONS) {
            const date = new Date()
            date.setDate(date.getDate() - seed.daysAgo)

            try {
                await ledgerApi.createMoneyEvent({
                    accountId: activeAccount._id,
                    amount: seed.amount,
                    type: seed.type,
                    category: seed.category,
                    description: seed.description,
                    date: date.toISOString().split("T")[0]
                })
                addedCount += 1
            } catch {
                // Skip entries that cannot be added, usually due to balance checks.
            }
        }

        await Promise.all([loadMoneyEvents(), loadMoneyEventSummary(), loadAccounts()])
        showToast("success", `${addedCount} demo transactions added!`)
        setBusyAction(null)
    }

    /* CSV EXPORT
     * Convert each transaction into a row, create an in-memory file (Blob),
     * click a temporary link, then release the temporary URL.
     */
    function handleExportCSV() {
        if (!expenses.length) {
            showToast("info", "No transactions to export")
            return
        }

        const headers = ["Date", "Type", "Category", "Description", "Amount (INR)"]
        const rows = expenses.map((expense) => [
            new Date(expense.date).toLocaleDateString("en-IN"),
            expense.type,
            expense.category,
            `"${expense.description.replace(/"/g, "\"\"")}"`,
            expense.amount
        ])

        const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = `spendwise-${new Date().toISOString().split("T")[0]}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
        showToast("success", "CSV downloaded!")
    }

    /* BUDGETS
     * Budgets come from MongoDB, so they remain available on another device.
     */
    async function loadBudgets() {
        try {
            const response = await ledgerApi.listBudgets()
            setBudgets(response.budgets)
        } catch {
            // Keep current budgets if refresh fails.
        }
    }

    async function handleSaveBudget(category, value) {
        const limit = Number.parseFloat(value)
        if (Number.isNaN(limit) || limit <= 0) {
            showToast("error", "Enter a valid amount")
            return
        }

        setBusyAction("saveBudget")
        try {
            const response = await ledgerApi.saveBudget({ category, limit })
            setBudgets((currentBudgets) => [
                ...currentBudgets.filter((budget) => budget.category !== category),
                response.budget
            ])
            setBudgetEdit(null)
            showToast("success", "Budget saved for " + category)
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to save budget"))
        } finally {
            setBusyAction(null)
        }
    }

    async function handleRemoveBudget(category) {
        setBusyAction("removeBudget")
        try {
            await ledgerApi.removeBudget(category)
            setBudgets((currentBudgets) => currentBudgets.filter((budget) => budget.category !== category))
            showToast("info", "Budget removed")
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to remove budget"))
        } finally {
            setBusyAction(null)
        }
    }

    /* AUTH ACTIONS
     * Each screen has its own small function. This is easier to read than one
     * large function containing deeply nested if/else blocks.
     */
    async function submitForgotPassword() {
        setBusyAction("forgot")
        try {
            const email = authForm.email.trim().toLowerCase()
            const response = await ledgerApi.forgotPassword(email)
            setAuthNotice(response)
            showToast("success", response.message)

            // Local development may return a preview link instead of sending email.
            if (response.previewUrl) window.location.assign(response.previewUrl)
        } catch (error) {
            showToast("error", errorMessage(error, "Could not send reset email"))
        } finally {
            setBusyAction(null)
        }
    }

    async function submitPasswordReset() {
        if (authForm.password !== authForm.confirmPassword) {
            showToast("error", "Passwords do not match")
            return
        }

        setBusyAction("reset")
        try {
            const response = await ledgerApi.resetPassword(resetToken, authForm.password)
            showToast("success", response.message)

            // Remove the secret reset token from the browser address bar.
            window.history.replaceState({}, "", window.location.pathname)
            setAuthForm(EMPTY_AUTH_FORM)
            setMode("login")
        } catch (error) {
            showToast("error", errorMessage(error, "Could not reset password"))
        } finally {
            setBusyAction(null)
        }
    }

    async function submitRegistration() {
        const name = authForm.name.trim()
        const email = authForm.email.trim().toLowerCase()

        if (!name || !email || !authForm.password) {
            showToast("error", "Name, email and password are required")
            return
        }

        setBusyAction("register")
        try {
            const response = await ledgerApi.register({ name, email, password: authForm.password })
            setAuthNotice(response)
            setAuthForm((current) => ({ ...current, password: "", confirmPassword: "" }))
            setMode("verify-pending")
            showToast("success", response.message)
        } catch (error) {
            showToast("error", errorMessage(error, "Registration failed"))
        } finally {
            setBusyAction(null)
        }
    }

    async function submitLogin() {
        const email = authForm.email.trim().toLowerCase()
        if (!email || !authForm.password) {
            showToast("error", "Email and password are required")
            return
        }

        setBusyAction("login")
        try {
            const response = await ledgerApi.login({ email, password: authForm.password })
            setAuthenticatedUser(response.user)
            setAuthForm(EMPTY_AUTH_FORM)
            setActiveTab("dashboard")
            showToast("success", `Welcome, ${response.user.name}!`)
        } catch (error) {
            if (error.code === "EMAIL_NOT_VERIFIED") {
                setAuthNotice({ message: "Verify your email before signing in." })
                setMode("verify-pending")
            }
            showToast("error", errorMessage(error, "Login failed"))
        } finally {
            setBusyAction(null)
        }
    }

    // The form uses one submit handler, which forwards work to the active screen.
    async function handleAuthSubmit(event) {
        event.preventDefault()

        if (mode === "forgot") return submitForgotPassword()
        if (mode === "reset") return submitPasswordReset()
        if (mode === "register") return submitRegistration()
        return submitLogin()
    }

    async function handleResendVerification() {
        setBusyAction("resend")
        try {
            const response = await ledgerApi.resendVerification(authForm.email)
            setAuthNotice(response)
            showToast("success", response.message)
        } catch (error) {
            showToast("error", errorMessage(error, "Could not resend verification email"))
        } finally {
            setBusyAction(null)
        }
    }

    /* SESSION ACTIONS
     * Logout clears both server cookie and frontend display state. If the server
     * is offline, local logout still succeeds so the user is not stuck.
     */
    async function handleLogout() {
        setBusyAction("logout")

        try {
            await ledgerApi.logout()
        } catch {
            // Logging out locally is enough if the request fails.
        }

        clearAuthenticatedSession()
        showToast("info", "Logged out. See you next time!")
        setBusyAction(null)
    }

    async function handleDeleteUserAccount(credentials) {
        setBusyAction("deleteUserAccount")
        try {
            await ledgerApi.deleteUserAccount(credentials)
            setShowDeleteUserModal(false)
            clearAuthenticatedSession()
            setMode("login")
            showToast("info", "Your SpendWise account was deleted")
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to delete user account"))
        } finally {
            setBusyAction(null)
        }
    }

    /* TRANSFER
     * Client-side validation gives fast feedback. The backend repeats every
     * validation because browser data must never be trusted.
     */
    async function handleTransfer(event) {
        event.preventDefault()

        const { fromAccount, toAccount, amount } = transfer
        if (!fromAccount || !toAccount || !amount) {
            showToast("error", "Fill all fields")
            return
        }

        if (fromAccount === toAccount) {
            showToast("error", "From and To must differ")
            return
        }

        const parsedAmount = Number.parseFloat(amount)
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            showToast("error", "Enter a valid amount")
            return
        }

        setBusyAction("transfer")

        try {
            await ledgerApi.transfer({
                fromAccount,
                toAccount,
                amount: parsedAmount,
                idempotencyKey: generateIdempotencyKey()
            })
            showToast("success", `${formatCurrency(parsedAmount)} transferred successfully!`)
            setTransfer(EMPTY_TRANSFER)
            await loadAccounts()
        } catch (error) {
            showToast("error", errorMessage(error, "Transfer failed"))
        } finally {
            setBusyAction(null)
        }
    }

    /* REACT EFFECTS
     * useEffect runs work that is outside rendering, such as network calls and
     * browser event listeners. An empty dependency array means "run once".
     */
    useEffect(() => {
        void runHealthCheck()
    }, [])

    // If the URL contains ?verify=..., verify it once and then clean the URL.
    useEffect(() => {
        const verificationToken = new URLSearchParams(window.location.search).get("verify")
        if (!verificationToken || verificationStarted.current) return
        verificationStarted.current = true

        async function verify() {
            setBusyAction("verify")
            try {
                const response = await ledgerApi.verifyEmail(verificationToken)
                showToast("success", response.message)
                window.history.replaceState({}, "", window.location.pathname)
                setMode("login")
            } catch (error) {
                const message = errorMessage(error, "Email verification failed")
                setAuthNotice({ message })
                showToast("error", message)
            } finally {
                setBusyAction(null)
            }
        }

        void verify()
    }, [])

    // Ask the server whether the browser's HttpOnly cookie is still valid.
    useEffect(() => {
        async function restoreSession() {
            if (resetToken || new URLSearchParams(window.location.search).has("verify")) return
            try {
                const response = await ledgerApi.session()
                setAuthenticatedUser(response.user)
            } catch {
                clearAuthenticatedSession()
            }
        }

        void restoreSession()
    }, [resetToken])

    // api.js dispatches this event after a 401 response (expired/invalid session).
    useEffect(() => {
        function handleUnauthorized(event) {
            if (!readStoredUser()) {
                return
            }

            clearAuthenticatedSession()
            setMode("login")
            showToast("info", event.detail?.message || "Session expired. Please sign in again.")
        }

        window.addEventListener("ledger:unauthorized", handleUnauthorized)

        return () => {
            window.removeEventListener("ledger:unauthorized", handleUnauthorized)
        }
    }, [])

    // Whenever login changes user from null to an object, load all private data.
    useEffect(() => {
        if (user) {
            void loadAccounts()
            void loadMoneyEvents()
            void loadMoneyEventSummary()
            void loadBudgets()
        }
    }, [user])

    /* RENDERING
     * Conditional rendering: guests see authentication; logged-in users see
     * the dashboard shell. React re-runs this decision whenever user changes.
     */
    if (!user) {
        return (
            <>
                <ToastContainer toasts={toasts} onRemove={removeToast} />
                <AuthScreen
                    mode={mode}
                    setMode={setMode}
                    authForm={authForm}
                    setAuthForm={setAuthForm}
                    busyAction={busyAction}
                    onSubmit={handleAuthSubmit}
                    health={health}
                    onHealthCheck={runHealthCheck}
                    authNotice={authNotice}
                    onResendVerification={handleResendVerification}
                />
            </>
        )
    }

    return (
        <div className="app-shell">
            {/* Modals are mounted only while their related state is truthy. */}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
            {showModal && (
                <MoneyEventModal
                    accounts={accounts}
                    onClose={() => setShowModal(false)}
                    onSubmit={handleAddMoneyEvent}
                    busy={busyAction === "addMoneyEvent"}
                />
            )}
            {showAccountModal && (
                <CreateAccountModal
                    busy={busyAction === "createAccount"}
                    onClose={() => setShowAccountModal(false)}
                    onSubmit={handleCreateAccount}
                />
            )}
            {accountToDelete && (
                <DeleteAccountModal
                    account={accountToDelete}
                    busy={busyAction === "deleteAccount"}
                    onClose={() => setAccountToDelete(null)}
                    onConfirm={() => void handleDeleteAccount(accountToDelete)}
                />
            )}
            {showDeleteUserModal && (
                <DeleteUserModal
                    busy={busyAction === "deleteUserAccount"}
                    onClose={() => setShowDeleteUserModal(false)}
                    onConfirm={handleDeleteUserAccount}
                />
            )}

            {/* Sidebar changes activeTab; the page section below reads it. */}
            <AppSidebar
                user={user}
                activeTab={activeTab}
                navItems={NAV_ITEMS}
                health={health}
                busyAction={busyAction}
                onSetActiveTab={setActiveTab}
                onHealthCheck={runHealthCheck}
                onLogout={handleLogout}
            />

            <main className="main-content">
                <AppTopbar activeTab={activeTab} user={user} onShowModal={() => setShowModal(true)} />

                {/* Only the selected section is rendered. */}
                <div className="page-body">
                    {activeTab === "dashboard" && (
                        <DashboardSection
                            summary={summary}
                            accounts={accounts}
                            balances={balances}
                            totalBalance={totalBalance}
                            expenses={expenses}
                            topExpenseCategories={topExpenseCategories}
                            maxCatTotal={maxCatTotal}
                            onShowModal={() => setShowModal(true)}
                            onSetActiveTab={setActiveTab}
                        />
                    )}

                    {activeTab === "expenses" && (
                        <ExpensesSection
                            expenseFilter={expenseFilter}
                            filteredExpenses={filteredExpenses}
                            onSetExpenseFilter={setExpenseFilter}
                            onShowModal={() => setShowModal(true)}
                            onReverseMoneyEvent={handleReverseMoneyEvent}
                        />
                    )}

                    {activeTab === "analytics" && (
                        <AnalyticsSection
                            summary={summary}
                            monthlyData={monthlyData}
                            maxMonthlyVal={maxMonthlyVal}
                            topExpenseCategories={topExpenseCategories}
                            totalExpense={totalExpense}
                        />
                    )}

                    {activeTab === "accounts" && (
                        <AccountsSection
                            accounts={accounts}
                            balances={balances}
                            busyAction={busyAction}
                            onRefreshAccounts={handleRefreshAccounts}
                            onCreateAccount={() => setShowAccountModal(true)}
                            onDeleteAccount={setAccountToDelete}
                            onDeleteUserAccount={() => setShowDeleteUserModal(true)}
                        />
                    )}

                    {activeTab === "transfer" && (
                        <TransferSection
                            accounts={accounts}
                            balances={balances}
                            transfer={transfer}
                            setTransfer={setTransfer}
                            busyAction={busyAction}
                            onSubmit={handleTransfer}
                            onGoToAccounts={() => setActiveTab("accounts")}
                        />
                    )}

                    {activeTab === "budget" && (
                        <BudgetSection
                            budgets={budgets}
                            budgetEdit={budgetEdit}
                            setBudgetEdit={setBudgetEdit}
                            categoryTotals={categoryTotals}
                            busyAction={busyAction}
                            onSeedData={handleSeedData}
                            onExportCSV={handleExportCSV}
                            onSaveBudget={handleSaveBudget}
                            onRemoveBudget={handleRemoveBudget}
                        />
                    )}
                </div>
            </main>
        </div>
    )
}
