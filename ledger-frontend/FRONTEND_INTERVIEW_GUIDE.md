# SpendWise Frontend Interview Guide

This guide is a quick revision map for explaining the React frontend. It follows the real implementation and uses the same function names as the code.

## 1. Frontend architecture in one answer

> SpendWise uses a component-based React frontend. `App.jsx` is the main coordinator: it owns shared state, calls the backend through `api.js`, prepares analytics data, and passes data plus callback functions to smaller components. Section components mainly render pages, while modal components collect input. Authentication uses an HttpOnly cookie, so React stores only safe user display data and never reads the JWT.

The data direction is:

```text
Backend response
      ↓
    api.js
      ↓
 App.jsx state
      ↓ props
Section / component
      ↓ callback
 App.jsx handler
      ↓
Backend request
```

## 2. How the frontend starts

### `main.jsx`

Speakable explanation:

> `main.jsx` is the entry point. It finds the `app` element from `index.html`, creates a React root, imports Bootstrap and the project CSS, and renders the main `App` component inside `StrictMode`.

### `App.jsx`

Speakable explanation:

> `App` is the common parent of the authenticated screens. It keeps shared data such as the user, accounts, balances, transactions, budgets, filters, and modal state. It also contains the functions that communicate with the backend. Child components receive state as props and return user actions through callback props.

## 3. API communication

### `request(path, options)` — `api.js`

> This is the common fetch wrapper. It builds the full URL, includes the HttpOnly authentication cookie, converts request objects to JSON, and cancels requests after 15 seconds. It parses JSON responses and converts failed responses into JavaScript Error objects. If the status is 401, it dispatches a custom event so `App` can clear the expired session.

### `ledgerApi`

> `ledgerApi` gives readable names to backend endpoints, such as `login`, `listAccounts`, and `saveBudget`. Components do not repeat URLs or fetch configuration. If an endpoint changes, I update the API layer instead of every screen.

### Why `credentials: "include"`?

> The JWT is stored by the backend in an HttpOnly cookie. `credentials: "include"` tells the browser to send that cookie with API requests. JavaScript cannot read the token, which reduces the risk of token theft through frontend scripts.

## 4. Authentication and session functions

### `submitRegistration()`

> It reads name, email, and password from the controlled authentication form. It normalizes the email, validates required values, and calls `ledgerApi.register`. A successful registration moves the UI to the verification-pending screen instead of logging in immediately. Errors are displayed through a toast.

### `submitLogin()`

> It validates the entered email and password and sends them to the login endpoint. The backend sets the secure cookie, while the frontend stores only the returned safe user object. It clears the form and opens Dashboard. If the backend returns `EMAIL_NOT_VERIFIED`, the UI opens the verification screen.

### `handleAuthSubmit(event)`

> AuthScreen uses one form for several modes. This handler prevents the browser refresh, checks the current mode, and forwards the work to login, registration, forgot-password, or reset-password logic.

### `submitForgotPassword()`

> It sends the normalized email to the recovery endpoint. The backend handles whether the account exists and sends the recovery email. In local development, a preview URL may be returned so the flow can be tested without a real email provider.

### `submitPasswordReset()`

> It first checks that both password fields match. It sends the reset token from the URL and the new password to the backend. On success it removes the token from the address bar, clears the form, and returns to login.

### `handleResendVerification()`

> It resends the verification link for the email already present in the form. Busy state prevents repeated clicks, and the backend response is shown as a notice and toast.

### `handleLogout()`

> It asks the backend to clear the authentication cookie, then clears frontend user data. The local cleanup still runs if the server request fails, so the user is never stuck in a signed-in interface.

### `handleDeleteUserAccount(credentials)`

> DeleteUserModal sends the current password and exact `DELETE` confirmation to this handler. The handler calls the protected delete endpoint. Success closes the modal, clears session state, and returns to login; failure leaves the account untouched and displays the error.

## 5. Authentication effects

### Health-check effect

> It runs once after the app mounts and calls `runHealthCheck`. The result is stored as checking, online, or offline for the sidebar service indicator.

### Email-verification effect

> It reads the `verify` token from an email-link URL and sends it to the backend. A ref prevents duplicate requests during React StrictMode development checks. It removes the token from the URL after success.

### Session-restoration effect

> On startup it asks the backend whether the HttpOnly cookie still represents a valid session. A valid response restores the safe user object; a failed response clears stale local state. Verification and password-reset links skip this effect because their dedicated screen must remain visible.

### Unauthorized-event effect

> The API layer emits a browser event after any 401 response. This effect listens for that event, clears the expired session, and sends the user to login. Its cleanup removes the listener when the component unmounts.

### Private-data effect

> Whenever `user` changes from null to a signed-in user, this effect loads accounts, transactions, the analytics summary, and budgets. This prevents protected requests before authentication.

## 6. Accounts and balances

### `loadAccounts()`

> It first loads the account list. It then maps every account to a balance request and waits for all requests with `Promise.all`. Results are stored in an object where the account id is the key. A failed individual balance becomes zero, so one account cannot stop the others from rendering.

### Why use `Promise.all()` here?

> Account balances are independent. Running them together is faster than waiting for one request before starting the next. `Promise.all` also gives one clear point where all balance requests have completed before state is updated.

### `handleCreateAccount(accountName)`

> CreateAccountModal sends the entered name to this function. It trims and validates the name, creates the account through the API, inserts the returned account into state, gives it a zero local balance, closes the modal, and shows a toast.

### `handleDeleteAccount(account)`

> It sends the selected account id to the backend. If deletion succeeds, it removes the account and balance from state and clears that id from the transfer form. The backend enforces rules such as requiring a zero balance.

### Why are accounts and balances separate?

> Account documents contain identity and display data, while the balance is calculated from ledger entries. Keeping them separate reflects the backend design and avoids treating a stored number as the financial source of truth.

## 7. Income and expense transactions

### `loadMoneyEvents()`

> It retrieves the full income and expense history and stores it in `expenses`. Dashboard uses a preview, while ExpensesSection uses the complete or filtered list.

### `loadMoneyEventSummary()`

> It loads backend-calculated totals and monthly aggregation. Dashboard and Analytics use this data for total income, total expenses, net balance, counts, and chart trends.

### `handleAddMoneyEvent(form)`

> MoneyEventModal sends the account, amount, type, category, description, and date. This function converts amount text to a number and creates the transaction. After success, it closes the modal and reloads transactions, analytics, and balances together using `Promise.all`.

### Why `Promise.all()` after adding or deleting a transaction?

> One transaction affects three independent views: history, summary totals, and account balance. These refresh requests do not depend on one another, so parallel execution reduces waiting time while keeping every screen synchronized.

### `handleReverseMoneyEvent(id)`

> It asks for confirmation, sends the transaction id to the delete endpoint, and lets the backend reverse its ledger impact. It then reloads the transaction list, summary, and balances in parallel.

### `handleExportCSV()`

> It converts current transactions into CSV rows in the browser. Descriptions are escaped, a Blob is created, and a temporary link triggers download. The temporary object URL is released afterward, so no server endpoint is needed for export.

## 8. Analytics calculations

### `buildCategoryTotals(expenses)`

> It groups the flat transaction list by category and keeps separate income and expense totals. Dashboard uses it for top spending, and Budget uses it to compare spending with category limits.

### `buildTopExpenseCategories(categoryTotals)`

> It converts grouped totals into an array, removes categories without expenses, sorts highest spending first, and returns the top six categories for readable charts.

### `buildMonthlyData(monthlyTrend)`

> The backend may return separate income and expense rows for one month. This function merges them by year and month, sorts them chronologically, keeps the latest six, and returns chart-ready labels and values.

### Why are derived values not separate state?

> Values such as total balance, filtered transactions, and chart arrays can be calculated from existing state. Storing them again would create two sources of truth and could make them inconsistent after an update.

## 9. Budgets

### `loadBudgets()`

> It loads the user's saved category limits from the backend. Because limits are stored in the database, they remain available after refresh or on another device.

### `handleSaveBudget(category, value)`

> It converts the entered value to a number and validates that it is positive. It creates or updates the backend budget, replaces the matching category in local state, and closes the inline editor.

### `handleRemoveBudget(category)`

> It deletes the selected category limit through the API. The item is removed from local state only after the backend confirms success.

### `BudgetCard`

> One card receives its category, saved budget, spending total, and callbacks. It calculates remaining or overspent amount and progress percentage. It owns no backend logic; save and remove actions go back to App.

## 10. Transfers and idempotency

### `handleTransfer(event)`

> It validates that both accounts exist, are different, and have a positive amount. It sends those values with a newly generated idempotency key. Success clears the form and reloads balances; backend errors are shown in a toast.

### Why use an idempotency key?

> A transfer must not run twice because of a retry or double network delivery. The unique key identifies one transfer attempt. The backend can recognize a repeated key and return the original result instead of creating another debit and credit.

### Why does the backend validate again?

> Frontend validation improves user experience, but browser data can be changed by a user. The backend is the security boundary, so it must repeat amount, account, ownership, balance, and idempotency checks.

## 11. Parent-child communication

Example: adding a transaction.

1. `App` passes `openMoneyEventModal` to `AppTopbar` as `onShowModal`.
2. The button calls that prop.
3. `App` changes `showModal` to true.
4. React renders `MoneyEventModal`.
5. The modal stores temporary input in its own state.
6. Submit calls the `onSubmit` prop with the form object.
7. That prop points to `handleAddMoneyEvent` in App.
8. App calls the API and refreshes shared state.
9. Updated props automatically re-render Dashboard, Expenses, and Analytics.

Speakable reason:

> I keep shared data and API actions in App, but temporary form input in the component that uses it. Props send data downward, and callback props send user actions upward. This gives a predictable one-way data flow.

## 12. Important component responsibilities

- `AuthScreen`: Displays authentication modes and controlled fields; App performs auth requests.
- `AppSidebar`: Displays navigation, user details, health, and logout; App owns the selected tab.
- `AppTopbar`: Chooses the page heading and opens the shared transaction modal.
- `DashboardSection`: Displays summary cards, recent transactions, and top spending.
- `ExpensesSection`: Displays filter tabs and transaction history.
- `AnalyticsSection`: Renders prepared summary and chart data.
- `AccountsSection`: Displays accounts and security actions.
- `TransferSection`: Displays the controlled transfer form.
- `BudgetSection`: Connects calculated spending and saved limits to BudgetCard.
- `MoneyEventModal`: Owns temporary income/expense form state.
- `DeleteAccountModal`: Confirms account deletion without performing API work itself.
- `DeleteUserModal`: Collects password and exact confirmation for permanent deletion.
- `ToastContainer`: Renders notifications stored in App.

## 13. Common React interview questions

### Why use `useState`?

> `useState` stores values that affect rendering and change after user actions or API responses, such as the signed-in user, account list, active tab, and modal visibility. Updating state tells React to render the affected UI again.

### Why use `useEffect`?

> Rendering should only describe UI. `useEffect` handles side effects such as API calls, URL-token processing, and browser event listeners after rendering.

### Why use `useRef` for email verification?

> Updating a ref does not trigger rendering. It works as a flag that remembers the verification request already started, which prevents a duplicate request during development StrictMode checks.

### What is a controlled input?

> A controlled input reads its value from React state and updates that state in `onChange`. React therefore owns the current form value and can validate, clear, or submit it predictably.

### Why keep API calls out of visual components?

> Centralizing API work in App and `api.js` avoids duplicated fetch logic. Visual components stay reusable and easy to test because they receive data and callbacks instead of knowing backend URLs.

### How is error handling organized?

> `api.js` converts network, timeout, and HTTP failures into Error objects. App catches them near the feature action and shows a user-friendly toast. Background refresh functions preserve the last successful UI if a request fails.

## 14. Complete feature flows

### Login flow

```text
AuthScreen input → handleAuthSubmit → submitLogin → ledgerApi.login
→ backend sets HttpOnly cookie → App stores safe user → private-data effect
→ accounts, balances, transactions, summary, and budgets appear
```

### Add transaction flow

```text
Add button → App opens MoneyEventModal → user submits controlled form
→ handleAddMoneyEvent → backend creates expense + ledger effect
→ Promise.all refreshes list, summary, and balances → UI re-renders
```

### Transfer flow

```text
TransferSection updates App-owned form → handleTransfer validates
→ unique idempotency key → backend performs debit and credit atomically
→ App reloads account balances → form clears
```

### Session-expiry flow

```text
Any protected request receives 401 → api.js dispatches ledger:unauthorized
→ App listener clears local session → login screen appears → toast explains expiry
```

## 15. Short closing explanation

> My frontend follows one-way React data flow. `App.jsx` coordinates shared state and business actions, `api.js` standardizes backend communication, helper files prepare display data, and focused components render the UI. I used parallel requests where operations are independent, HttpOnly-cookie sessions for safer authentication, and callback props so child components can report actions without owning shared state.
