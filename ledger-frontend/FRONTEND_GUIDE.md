# SpendWise Frontend Learning Guide

This guide explains the React frontend in simple language. Read the files in this order:

1. `src/main.jsx`
2. `src/App.jsx`
3. `src/api.js`
4. `src/components/AuthScreen.jsx`
5. Files inside `src/sections/`
6. Small components and helper files

## 1. Frontend folder structure

```text
ledger-frontend/
├── src/
│   ├── main.jsx              Starts React
│   ├── App.jsx               Stores shared state and connects the app
│   ├── api.js                Sends requests to the backend
│   ├── categories.js         Shared transaction category list
│   ├── icons.jsx             SVG icons
│   ├── style.css             SpendWise-specific styles
│   ├── assets/               Images
│   ├── components/           Reusable UI pieces
│   ├── sections/             Main dashboard pages
│   └── lib/                  Plain JavaScript helper functions
├── index.html                Contains the root HTML element
└── package.json              Dependencies and npm commands
```

Bootstrap provides common button, form, card, and spacing styles. `style.css` keeps the SpendWise colors, layout, charts, login artwork, and responsive design.

## 2. How the frontend starts

`index.html` contains this empty element:

```html
<div id="app"></div>
```

`main.jsx` finds that element and renders the main component:

```jsx
ReactDOM.createRoot(document.getElementById("app")).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
```

The flow is:

```text
index.html → main.jsx → App.jsx → child components
```

## 3. What App.jsx does

`App.jsx` is the coordinator of the frontend. It has four main jobs:

1. Store shared data such as the user, accounts, transactions, and budgets.
2. Call functions from `api.js`.
3. Decide whether to show authentication or the dashboard.
4. Pass data and event functions to child components using props.

Example state:

```jsx
const [accounts, setAccounts] = useState([])
```

- `accounts` is the current value.
- `setAccounts` changes the value.
- `[]` is the initial value.
- React renders the screen again when the state changes.

App uses separate state for separate types of data. For example:

- `user`: currently signed-in user
- `accounts`: user's financial accounts
- `balances`: account ID to balance mapping
- `expenses`: income and expense records
- `budgets`: saved category limits
- `activeTab`: currently selected dashboard page
- `busyAction`: currently running operation
- `showModal`: whether the transaction dialog is open
- `toasts`: temporary success/error messages

## 4. Components and props

A component is a function that returns JSX.

```jsx
function AppTopbar(props) {
    const activeTab = props.activeTab
    const user = props.user
    const onShowModal = props.onShowModal

    return <button onClick={onShowModal}>Add transaction</button>
}
```

This project reads props one by one instead of destructuring a long list. It uses a few extra lines, but makes the source of every value obvious.

Props are values given by a parent component to a child component:

```jsx
<AppTopbar
    activeTab={activeTab}
    user={user}
    onShowModal={() => setShowModal(true)}
/>
```

Data normally moves down from parent to child. User actions move up through callback functions.

```text
App passes accounts to AccountsSection
AccountsSection displays accounts
User clicks Delete
AccountsSection calls onDeleteAccount
App opens DeleteAccountModal
```

## 5. Major components

### Authentication components

- `AuthScreen.jsx`: Login, registration, forgot password, reset password, and email verification UI.
- `BrandMark.jsx`: SpendWise SVG logo.

`AuthScreen` displays the form, but `App.jsx` performs the actual API actions. This keeps the screen focused on UI.

### Layout components

- `AppSidebar.jsx`: Navigation, user details, service status, and logout.
- `AppTopbar.jsx`: Current page title and Add transaction button.
- `ToastContainer.jsx`: Temporary success, error, or information messages.

### Dialog components

- `MoneyEventModal.jsx`: Adds income or expense.
- `CreateAccountModal.jsx`: Creates a financial account.
- `DeleteAccountModal.jsx`: Confirms account deletion.
- `DeleteUserModal.jsx`: Confirms permanent user deletion.
- `BudgetCard.jsx`: Displays and edits one category budget.

### Dashboard sections

- `DashboardSection.jsx`: Balance overview, statistics, recent transactions, and top spending.
- `ExpensesSection.jsx`: Transaction list and filters.
- `AnalyticsSection.jsx`: Income, expense, monthly, and category charts.
- `AccountsSection.jsx`: Account cards and account security actions.
- `TransferSection.jsx`: Moves money between two accounts.
- `BudgetSection.jsx`: Lists category budget cards and the CSV export button.

Sections receive already prepared data through props. Most backend calls remain in `App.jsx`.

## 6. Controlled form inputs

React stores the input value in state:

```jsx
const [name, setName] = useState("")

<input
    value={name}
    onChange={(event) => setName(event.target.value)}
/>
```

When the user types:

1. `onChange` runs.
2. `event.target.value` contains the new text.
3. `setName` updates state.
4. React renders the input with the new value.

This is called a controlled input because React controls its value.

## 7. Event handlers

An event handler is a function that runs after a user action.

```jsx
function handleSubmit(event) {
    event.preventDefault()
    void onSubmit(form)
}
```

- `event.preventDefault()` stops the browser from refreshing the page.
- `onSubmit(form)` sends the form data to the parent component.
- The parent can then call the backend.

Functions starting with `handle`, `submit`, `load`, or `on` usually have clear roles:

- `handle...`: responds to a browser/user event
- `submit...`: submits a form
- `load...`: fetches data
- `on...`: callback received through props

## 8. Hooks used in this project

React requires this array syntax:

```jsx
const [accounts, setAccounts] = useState([])
```

The first item is the current state value. The second item is the function that changes it. This destructuring is kept because it is the normal React API, not an unnecessary shortcut.

### useState

Stores values that can change and affect the screen.

```jsx
const [activeTab, setActiveTab] = useState("dashboard")
```

### useEffect

Runs work outside normal rendering, such as an API call or browser event listener.

```jsx
useEffect(() => {
    void runHealthCheck()
}, [])
```

The empty array means it runs once after the component first appears.

Another effect reloads private data after login:

```jsx
useEffect(() => {
    if (user) {
        void loadAccounts()
        void loadMoneyEvents()
        void loadBudgets()
    }
}, [user])
```

### useRef

Stores a value without causing a new render. It is used to remember whether email verification has already started and to reference the modal overlay.

### Other JavaScript syntax that remains

- `map`: turns each item in an array into one React element.
- Arrow functions: used for short callbacks and simple API wrapper methods.
- `...object`: keeps the other form fields when one field changes.
- `async/await`: waits for a backend request.
- `try/catch`: handles successful and failed backend requests.
- `Promise.all`: runs independent API requests together and waits for all of them.
- Template strings such as `` `Welcome ${name}` ``: insert values into text.

These patterns are used only where they directly solve a React or API task.

Example of `Promise.all`:

```js
await Promise.all([
    loadMoneyEvents(),
    loadMoneyEventSummary(),
    loadAccounts()
])
```

These three refresh requests do not depend on each other. Running them together is faster than waiting for each request one by one.

## 9. Login flow step by step

```text
1. User types email and password in AuthScreen.
2. AuthScreen calls the onSubmit prop.
3. App.handleAuthSubmit prevents page refresh.
4. App.submitLogin calls ledgerApi.login.
5. api.js sends POST /api/auth/login.
6. Backend validates credentials and sets an HttpOnly cookie.
7. Frontend stores only safe user display data.
8. setUser updates React state.
9. App renders the dashboard instead of AuthScreen.
10. The user effect loads accounts, transactions, summary, and budgets.
```

The JWT is not stored in React or localStorage. The browser sends the secure HttpOnly cookie automatically because `api.js` uses:

```js
credentials: "include"
```

## 10. Dashboard flow

After login, `App.jsx` renders:

```text
AppSidebar + AppTopbar + selected section + optional dialogs
```

The sidebar changes `activeTab`. `renderActiveSection()` reads that value and returns the correct page.

Example:

```text
User clicks Accounts
→ setActiveTab("accounts")
→ React renders again
→ renderActiveSection returns AccountsSection
```

## 11. How API requests work

Components do not use `fetch` directly. They use named methods:

```js
ledgerApi.login(details)
ledgerApi.listAccounts()
ledgerApi.saveBudget(data)
```

All methods use the common `request()` function in `api.js`. That function:

1. Creates the complete URL.
2. Adds the HTTP method.
3. Converts request objects into JSON.
4. Sends the login cookie.
5. Cancels requests after 15 seconds.
6. Reads JSON responses.
7. Throws an error for failed responses.
8. Reports a `401` response so App can return to login.

This central design prevents repeated `fetch` code in every component.

## 12. Helper files

### `categories.js`

Contains only transaction category names, short icons, and colors. Several screens use the same list, so keeping one copy prevents mismatched category names.

### `lib/formatters.js`

Converts numbers and dates into readable text, such as `₹5,000` and `05 Nov 2026`.

### `lib/analytics.js`

Converts transaction data into category totals and monthly chart data.

### `lib/storage.js`

Stores and removes the safe user object in `localStorage`. It does not store the JWT.

## 13. Run the frontend in VS Code

Open two VS Code terminals.

### Terminal 1: backend

```bash
cd backend-ledger
npm install
npm run dev
```

### Terminal 2: frontend

```bash
cd ledger-frontend
npm install
npm run dev
```

Open the URL printed by Vite, normally:

```text
http://localhost:5173
```

Production build check:

```bash
cd ledger-frontend
npm run build
```

## 14. Important viva questions

### What is React?

React is a JavaScript library used to build user interfaces from reusable components.

### What is JSX?

JSX lets us write HTML-like UI inside JavaScript. React converts it into browser elements.

### What is a component?

A component is a JavaScript function that returns a part of the UI.

### What are props?

Props are values and callback functions passed from a parent component to a child component.

### What is state?

State stores changing data inside a component. Updating state causes React to render the latest UI.

### Props versus state?

Props come from a parent. State is managed by the component that owns the data.

### Why is App.jsx important?

It owns shared state, calls the backend, handles major actions, and connects smaller components.

### Why use useEffect?

It runs side effects such as API calls, session restoration, and browser event listeners.

### Why use `key` inside map?

The key helps React identify which list item was added, removed, or updated.

### What is conditional rendering?

It means showing different JSX based on a condition, such as login versus dashboard.

### How does a child communicate with its parent?

The parent passes a callback prop. The child calls that function after a user action.

### Why is API code kept in api.js?

It keeps the backend URL, cookies, timeout, response parsing, and errors in one place.

### Where is the JWT stored?

The backend stores it in an HttpOnly cookie. React cannot read it, which reduces token theft through frontend JavaScript.

### Why use Bootstrap and custom CSS together?

Bootstrap handles common controls such as buttons and forms. Custom CSS preserves the SpendWise brand, layout, charts, and responsive design.

### What happens after state changes?

React runs the component again and updates only the necessary browser elements.

### Why does the project use separate section components?

Each dashboard page stays smaller and easier to read, while App keeps the shared data and actions.

## 15. A short project explanation

> The SpendWise frontend is built with React. `main.jsx` starts the app, and `App.jsx` manages shared state, authentication, API actions, and page selection. Reusable components display forms, navigation, dialogs, and messages, while section components display each dashboard page. The frontend communicates with the Express backend through one API helper and uses a secure HttpOnly cookie for authentication. Bootstrap handles common controls, and custom CSS keeps the SpendWise design and responsiveness.
