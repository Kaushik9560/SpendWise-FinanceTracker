import { useEffect, useRef, useState } from "react"
import { ledgerApi } from "./api"
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

// These values are used only by App, so they stay beside App.
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

/*
 * Returns a safe message for the toast system.
 * API failures normally arrive as Error objects from api.js, while the fallback
 * covers unexpected values. This keeps every catch block short and consistent.
 */
function errorMessage(error, fallback) {
    if (error instanceof Error) {
        return error.message
    }

    return fallback
}

/*
 * App is the main coordinator of SpendWise.
 * It owns shared state, calls the backend, prepares analytics data, and passes
 * data plus callback functions to the smaller screen components.
 * A change here can update several sections because App is their common parent.
 */
export default function App() {
    // URL parameters decide whether the first screen is login, reset, or verification.
    const urlParams = new URLSearchParams(window.location.search)

    let startingMode = "login"
    if (urlParams.has("reset")) {
        startingMode = "reset"
    }

    let startingUser = readStoredUser()
    if (urlParams.has("reset")) {
        startingUser = null
    }

    const resetToken = urlParams.get("reset") || ""

    const [mode, setMode] = useState(startingMode)
    const [authForm, setAuthForm] = useState(EMPTY_AUTH_FORM)
    const [authNotice, setAuthNotice] = useState(null)
    const verificationStarted = useRef(false)
    const [user, setUser] = useState(startingUser)

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

    /* DERIVED DASHBOARD DATA
     * These values are recalculated from the latest API state during rendering.
     * They are not stored in useState because they can be derived from accounts,
     * balances, expenses, and summary without another source of truth.
     */
    let totalBalance = 0
    const accountBalances = Object.values(balances)

    accountBalances.forEach((balance) => {
        totalBalance += balance
    })

    let filteredExpenses = expenses
    if (expenseFilter !== "all") {
        filteredExpenses = expenses.filter((expense) => expense.type === expenseFilter)
    }

    const categoryTotals = buildCategoryTotals(expenses)
    const topExpenseCategories = buildTopExpenseCategories(categoryTotals)
    let totalExpense = 0
    let monthlyTrend = []

    if (summary && summary.summary) {
        totalExpense = summary.summary.totalExpense
    }

    if (summary && summary.monthlyTrend) {
        monthlyTrend = summary.monthlyTrend
    }

    let maxCatTotal = 1
    if (topExpenseCategories.length > 0) {
        maxCatTotal = topExpenseCategories[0].total
    }

    const monthlyData = buildMonthlyData(monthlyTrend)
    let maxMonthlyVal = 1

    monthlyData.forEach((month) => {
        if (month.income > maxMonthlyVal) maxMonthlyVal = month.income
        if (month.expense > maxMonthlyVal) maxMonthlyVal = month.expense
    })

    /* TOAST NOTIFICATIONS
     * Adds a message requested by any feature and removes it after four seconds.
     * Functional setState always receives the newest array, so multiple API
     * responses arriving close together do not overwrite each other's toasts.
     */
    function showToast(type, message) {
        const id = Date.now() + Math.random()
        setToasts((currentToasts) => [...currentToasts, { id, type, message }])
        setTimeout(() => {
            setToasts((currentToasts) => currentToasts.filter((currentToast) => currentToast.id !== id))
        }, 4000)
    }

    /*
     * Removes one toast when its close button is clicked.
     * ToastContainer sends the selected id back through its onRemove callback.
     */
    function removeToast(id) {
        setToasts((currentToasts) => currentToasts.filter((toastItem) => toastItem.id !== id))
    }

    /* SESSION HELPERS
     * Saves the safe user profile after login or session restoration.
     * The authentication token is not stored here; it remains protected in the
     * backend's HttpOnly cookie and is automatically sent by api.js.
     */
    function setAuthenticatedUser(nextUser) {
        persistStoredSession(nextUser)
        setUser(nextUser)
    }

    /*
     * Clears all user-specific frontend state after logout, deletion, or 401.
     * It also returns navigation to Dashboard so another user starts cleanly.
     * The backend cookie is cleared separately by the logout endpoint.
     */
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

    /*
     * Checks whether the backend service is reachable.
     * It runs when App mounts and when the sidebar status is clicked, then stores
     * checking, online, or offline so AppSidebar can display the current result.
     */
    async function runHealthCheck() {
        setHealth("checking")
        try {
            await ledgerApi.health()
            setHealth("online")
        } catch {
            setHealth("offline")
        }
    }

    /* ACCOUNTS AND BALANCES
     * Loads the user's accounts, then requests every ledger balance in parallel.
     * Each failed balance becomes zero so one account cannot block the full list.
     * The final account-id-to-balance map is used across Dashboard and Accounts.
     */
    async function loadAccounts() {
        try {
            const response = await ledgerApi.listAccounts()
            setAccounts(response.accounts)

            const balanceMap = {}

            const balanceRequests = response.accounts.map(async (account) => {
                try {
                    const balanceResponse = await ledgerApi.getBalance(account._id)
                    balanceMap[account._id] = balanceResponse.balance
                } catch {
                    balanceMap[account._id] = 0
                }
            })

            // Promise.all waits until every independent balance request finishes.
            await Promise.all(balanceRequests)

            setBalances(balanceMap)
        } catch {
            // Keep the current UI state if the refresh fails.
        }
    }

    /*
     * Handles the Refresh button in AccountsSection.
     * It prevents guest requests, shows button loading state, and asks
     * loadAccounts to refresh data. That loader preserves current data if its
     * background request fails, and this handler always clears the busy state.
     */
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

    /*
     * Creates an account using the name entered in CreateAccountModal.
     * After client-side validation, it sends the name to the backend and inserts
     * the returned account into local state with a zero starting balance.
     * API errors keep the modal open and are shown in a toast.
     */
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
            const updatedAccounts = [response.account, ...accounts]
            const updatedBalances = { ...balances }
            updatedBalances[response.account._id] = 0

            setAccounts(updatedAccounts)
            setBalances(updatedBalances)
            setShowAccountModal(false)
            showToast("success", `${response.account.name} created!`)
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to create account"))
        } finally {
            setBusyAction(null)
        }
    }

    /*
     * Deletes the account selected in AccountsSection after modal confirmation.
     * On success it removes the account and balance locally, clears any transfer
     * selection using that account, closes the dialog, and shows the result.
     * The backend decides whether deletion is allowed, including zero balance.
     */
    async function handleDeleteAccount(account) {
        setBusyAction("deleteAccount")
        try {
            await ledgerApi.deleteAccount(account._id)

            const updatedAccounts = accounts.filter((item) => item._id !== account._id)
            const updatedBalances = { ...balances }
            delete updatedBalances[account._id]

            const updatedTransfer = { ...transfer }
            if (updatedTransfer.fromAccount === account._id) updatedTransfer.fromAccount = ""
            if (updatedTransfer.toAccount === account._id) updatedTransfer.toAccount = ""

            setAccounts(updatedAccounts)
            setBalances(updatedBalances)
            setTransfer(updatedTransfer)
            setAccountToDelete(null)
            showToast("success", "Account deleted")
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to delete account"))
        } finally {
            setBusyAction(null)
        }
    }

    /* MONEY EVENTS
     * Loads the complete income/expense list used by Dashboard and Expenses.
     * A failed background refresh keeps the last successful list on screen.
     */
    async function loadMoneyEvents() {
        try {
            const response = await ledgerApi.listMoneyEvents()
            setExpenses(response.expenses)
        } catch {
            // Keep the current UI state if the refresh fails.
        }
    }

    /*
     * Loads backend-calculated totals and monthly trends for Dashboard/Analytics.
     * Keeping aggregation on the backend avoids recalculating database-wide
     * summaries in the browser.
     */
    async function loadMoneyEventSummary() {
        try {
            const response = await ledgerApi.getMoneyEventSummary()
            setSummary(response)
        } catch {
            // Keep the current UI state if the refresh fails.
        }
    }

    /*
     * Records the form submitted by MoneyEventModal as income or expense.
     * It converts amount text to a number, calls the API, closes the modal, then
     * refreshes transactions, summary, and balances together with Promise.all().
     * Validation/API failures are reported without losing the open form early.
     */
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
            let eventName = "Expense"
            if (form.type === "income") {
                eventName = "Income"
            }

            showToast("success", `${eventName} recorded!`)
            setShowModal(false)

            // These requests are independent, so running them together is faster.
            await Promise.all([
                loadMoneyEvents(),
                loadMoneyEventSummary(),
                loadAccounts()
            ])
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to save"))
        } finally {
            setBusyAction(null)
        }
    }

    /*
     * Deletes a selected transaction after browser confirmation.
     * The backend reverses its ledger effect; the frontend then reloads the list,
     * analytics summary, and balances in parallel to keep every screen consistent.
     */
    async function handleReverseMoneyEvent(id) {
        if (!confirm("Delete this entry? The balance will be reversed.")) {
            return
        }

        try {
            await ledgerApi.reverseMoneyEvent(id)
            showToast("success", "Entry deleted and balance reversed.")
            await Promise.all([
                loadMoneyEvents(),
                loadMoneyEventSummary(),
                loadAccounts()
            ])
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to delete"))
        }
    }

    /* CSV EXPORT
     * Runs from the Budget page's Export button and uses current expense state.
     * It escapes description quotes, builds CSV text, creates an in-memory Blob,
     * triggers a browser download, and releases the temporary object URL.
     */
    function handleExportCSV() {
        if (!expenses.length) {
            showToast("info", "No transactions to export")
            return
        }

        const headers = ["Date", "Type", "Category", "Description", "Amount (INR)"]
        const rows = []

        for (const expense of expenses) {
            const row = [
                new Date(expense.date).toLocaleDateString("en-IN"),
                expense.type,
                expense.category,
                `"${expense.description.replace(/"/g, "\"\"")}"`,
                expense.amount
            ]

            rows.push(row)
        }

        const csvLines = [headers]
        for (const row of rows) {
            csvLines.push(row)
        }

        const textLines = []
        for (const row of csvLines) {
            textLines.push(row.join(","))
        }

        const csv = textLines.join("\n")
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
     * Loads saved category limits from the backend into shared App state.
     * BudgetSection combines these limits with calculated spending totals.
     */
    async function loadBudgets() {
        try {
            const response = await ledgerApi.listBudgets()
            setBudgets(response.budgets)
        } catch {
            // Keep current budgets if refresh fails.
        }
    }

    /*
     * Creates or updates the limit edited in a BudgetCard.
     * It validates the text input, sends category and numeric limit to the API,
     * replaces that category in local state, and closes the inline editor.
     */
    async function handleSaveBudget(category, value) {
        const limit = Number.parseFloat(value)
        if (Number.isNaN(limit) || limit <= 0) {
            showToast("error", "Enter a valid amount")
            return
        }

        setBusyAction("saveBudget")
        try {
            const response = await ledgerApi.saveBudget({ category, limit })
            const otherBudgets = budgets.filter((budget) => budget.category !== category)
            const updatedBudgets = [...otherBudgets, response.budget]

            setBudgets(updatedBudgets)
            setBudgetEdit(null)
            showToast("success", "Budget saved for " + category)
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to save budget"))
        } finally {
            setBusyAction(null)
        }
    }

    /*
     * Removes a saved limit for the selected category.
     * The backend is updated first; only a successful response removes the item
     * from frontend state. Failures leave the current card unchanged.
     */
    async function handleRemoveBudget(category) {
        setBusyAction("removeBudget")
        try {
            await ledgerApi.removeBudget(category)
            const updatedBudgets = budgets.filter((budget) => budget.category !== category)
            setBudgets(updatedBudgets)
            showToast("info", "Budget removed")
        } catch (error) {
            showToast("error", errorMessage(error, "Failed to remove budget"))
        } finally {
            setBusyAction(null)
        }
    }

    /* AUTHENTICATION AND ACCOUNT RECOVERY
     * Requests a password-reset email for the address entered in AuthScreen.
     * The backend returns a neutral response; local development may also return
     * a preview URL, which is opened so the flow can be tested without SMTP.
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

    /*
     * Submits the reset token from the URL with the user's new password.
     * Matching passwords are checked first. Success removes the secret token
     * from the address bar, clears the form, and returns to the login screen.
     */
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

    /*
     * Registers the name, normalized email, and password entered in AuthScreen.
     * On success it clears password fields and opens the verification-pending
     * screen. Registration does not log the user in before email verification.
     */
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
            setAuthForm({
                name: authForm.name,
                email: authForm.email,
                password: "",
                confirmPassword: ""
            })
            setMode("verify-pending")
            showToast("success", response.message)
        } catch (error) {
            showToast("error", errorMessage(error, "Registration failed"))
        } finally {
            setBusyAction(null)
        }
    }

    /*
     * Handles login using the email and password entered in AuthScreen.
     * The API sets the HttpOnly cookie; React stores only the safe user profile,
     * clears the form, and opens Dashboard. Unverified users are redirected to
     * the verification screen, while every failure is shown as a toast.
     */
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

    /*
     * Receives the shared authentication form submission from AuthScreen.
     * It prevents browser refresh and delegates to the function matching mode,
     * allowing one form component to support login, register, forgot, and reset.
     */
    async function handleAuthSubmit(event) {
        event.preventDefault()

        if (mode === "forgot") return submitForgotPassword()
        if (mode === "reset") return submitPasswordReset()
        if (mode === "register") return submitRegistration()
        return submitLogin()
    }

    /*
     * Resends an email verification link from the pending-verification screen.
     * It uses the email already held in authForm and updates the notice/toast with
     * the backend response. The loading action prevents repeated clicks.
     */
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
     * Runs when the sidebar logout button is clicked.
     * It asks the server to clear the secure cookie, then always clears frontend
     * state. Local logout still succeeds if the network request fails.
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

    /*
     * Permanently deletes the signed-in user after DeleteUserModal supplies the
     * password and DELETE confirmation. Success closes the modal, clears all
     * session data, and returns to login; failure keeps the account and session.
     */
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

    /* TRANSFERS
     * Handles the transfer form submitted by TransferSection.
     * It validates both accounts and amount, then sends a unique idempotency key
     * so a retried request cannot transfer the same money twice. On success it
     * clears the form and reloads balances; the backend repeats all validation.
     */
    async function handleTransfer(event) {
        event.preventDefault()

        const fromAccount = transfer.fromAccount
        const toAccount = transfer.toAccount
        const amount = transfer.amount
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

    /* MODAL AND NAVIGATION CALLBACKS
     * Child components call these small functions instead of changing App state
     * directly. This keeps App as the single owner of dialog/navigation state.
     */
    function openMoneyEventModal() {
        setShowModal(true)
    }

    function closeMoneyEventModal() {
        setShowModal(false)
    }

    function openCreateAccountModal() {
        setShowAccountModal(true)
    }

    function closeCreateAccountModal() {
        setShowAccountModal(false)
    }

    function closeDeleteAccountModal() {
        setAccountToDelete(null)
    }

    function confirmDeleteAccount() {
        void handleDeleteAccount(accountToDelete)
    }

    function openDeleteUserModal() {
        setShowDeleteUserModal(true)
    }

    function closeDeleteUserModal() {
        setShowDeleteUserModal(false)
    }

    function showAccountsPage() {
        setActiveTab("accounts")
    }

    /* PAGE SELECTION
     * Runs during rendering and returns the section selected in the sidebar.
     * Each section receives prepared data plus callback props, while backend calls
     * remain centralized in App. The final return is Budget for the remaining tab.
     */
    function renderActiveSection() {
        if (activeTab === "dashboard") {
            return (
                <DashboardSection
                    summary={summary}
                    accounts={accounts}
                    balances={balances}
                    totalBalance={totalBalance}
                    expenses={expenses}
                    topExpenseCategories={topExpenseCategories}
                    maxCatTotal={maxCatTotal}
                    onShowModal={openMoneyEventModal}
                    onSetActiveTab={setActiveTab}
                />
            )
        }

        if (activeTab === "expenses") {
            return (
                <ExpensesSection
                    expenseFilter={expenseFilter}
                    filteredExpenses={filteredExpenses}
                    onSetExpenseFilter={setExpenseFilter}
                    onShowModal={openMoneyEventModal}
                    onReverseMoneyEvent={handleReverseMoneyEvent}
                />
            )
        }

        if (activeTab === "analytics") {
            return (
                <AnalyticsSection
                    summary={summary}
                    monthlyData={monthlyData}
                    maxMonthlyVal={maxMonthlyVal}
                    topExpenseCategories={topExpenseCategories}
                    totalExpense={totalExpense}
                />
            )
        }

        if (activeTab === "accounts") {
            return (
                <AccountsSection
                    accounts={accounts}
                    balances={balances}
                    busyAction={busyAction}
                    onRefreshAccounts={handleRefreshAccounts}
                    onCreateAccount={openCreateAccountModal}
                    onDeleteAccount={setAccountToDelete}
                    onDeleteUserAccount={openDeleteUserModal}
                />
            )
        }

        if (activeTab === "transfer") {
            return (
                <TransferSection
                    accounts={accounts}
                    balances={balances}
                    transfer={transfer}
                    setTransfer={setTransfer}
                    busyAction={busyAction}
                    onSubmit={handleTransfer}
                    onGoToAccounts={showAccountsPage}
                />
            )
        }

        return (
            <BudgetSection
                budgets={budgets}
                budgetEdit={budgetEdit}
                setBudgetEdit={setBudgetEdit}
                categoryTotals={categoryTotals}
                busyAction={busyAction}
                onExportCSV={handleExportCSV}
                onSaveBudget={handleSaveBudget}
                onRemoveBudget={handleRemoveBudget}
            />
        )
    }

    /* INITIAL HEALTH EFFECT
     * Runs once after App first appears and checks backend availability.
     * The empty dependency array is correct because the initial check is not tied
     * to changing state; users can manually check again from the sidebar.
     */
    useEffect(() => {
        void runHealthCheck()
    }, [])

    /* EMAIL VERIFICATION EFFECT
     * Runs on mount, reads ?verify= from the email link, and submits that token.
     * verificationStarted prevents React StrictMode from sending it twice in
     * development. Success cleans the URL; failure displays the backend message.
     */
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

    /* SESSION RESTORATION EFFECT
     * Runs on startup and asks whether the browser's HttpOnly cookie is valid.
     * Reset and verification links skip restoration because their auth screens
     * must remain visible. resetToken is listed because it controls that decision.
     */
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

    /* UNAUTHORIZED EVENT EFFECT
     * api.js emits ledger:unauthorized whenever an API request receives HTTP 401.
     * This listener clears stale user data and returns to login. The cleanup
     * removes the browser listener when App unmounts to prevent duplicates.
     */
    useEffect(() => {
        function handleUnauthorized(event) {
            if (!readStoredUser()) {
                return
            }

            clearAuthenticatedSession()
            setMode("login")
            let message = "Session expired. Please sign in again."
            if (event.detail && event.detail.message) {
                message = event.detail.message
            }

            showToast("info", message)
        }

        window.addEventListener("ledger:unauthorized", handleUnauthorized)

        return () => {
            window.removeEventListener("ledger:unauthorized", handleUnauthorized)
        }
    }, [])

    /* PRIVATE DATA EFFECT
     * Runs whenever the authenticated user changes. After login or session
     * restoration, it starts the independent account, transaction, summary, and
     * budget loads. A null user causes no protected requests.
     */
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
                    onClose={closeMoneyEventModal}
                    onSubmit={handleAddMoneyEvent}
                    busy={busyAction === "addMoneyEvent"}
                />
            )}
            {showAccountModal && (
                <CreateAccountModal
                    busy={busyAction === "createAccount"}
                    onClose={closeCreateAccountModal}
                    onSubmit={handleCreateAccount}
                />
            )}
            {accountToDelete && (
                <DeleteAccountModal
                    account={accountToDelete}
                    busy={busyAction === "deleteAccount"}
                    onClose={closeDeleteAccountModal}
                    onConfirm={confirmDeleteAccount}
                />
            )}
            {showDeleteUserModal && (
                <DeleteUserModal
                    busy={busyAction === "deleteUserAccount"}
                    onClose={closeDeleteUserModal}
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
                <AppTopbar activeTab={activeTab} user={user} onShowModal={openMoneyEventModal} />

                {/* Only the selected section is rendered. */}
                <div className="page-body">{renderActiveSection()}</div>
            </main>
        </div>
    )
}
