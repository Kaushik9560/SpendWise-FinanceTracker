import { useRef, useState } from "react"
import { CATEGORY_DETAILS } from "../categories"
import { Icon } from "../icons"

/* Creates fresh controlled-form values each time the modal mounts. */
function emptyMoneyEventForm() {
    return {
        accountId: "",
        amount: "",
        type: "expense",
        category: "",
        description: "",
        date: new Date().toISOString().split("T")[0]
    }
}

/* Returns whether a category is valid for the currently selected transaction type. */
function categoryMatchesType(category, type) {
    if (type === "income") {
        return ["Salary & Income", "Investments", "Others"].includes(category)
    }
    return category !== "Salary & Income"
}

/*
 * Displays the controlled form for adding an income or expense transaction.
 * It receives accounts plus submit/close callbacks from App, owns temporary form
 * input, and sends the complete form object back on submit. App calls the API.
 */
export default function MoneyEventModal(props) {
    const accounts = props.accounts
    const onClose = props.onClose
    const onSubmit = props.onSubmit
    const busy = props.busy

    // useState stores form values; useRef points to the real overlay DOM element.
    const [form, setForm] = useState(emptyMoneyEventForm)
    const overlayRef = useRef(null)
    const categories = Object.keys(CATEGORY_DETAILS)
    const today = new Date().toISOString().split("T")[0]

    /* Closes only when the backdrop is clicked, not any child inside the modal. */
    function handleOverlayClick(event) {
        if (event.target === overlayRef.current) {
            onClose()
        }
    }

    // Each input has its own handler, so it is clear which property changes.
    function handleAmountChange(event) {
        setForm({ ...form, amount: event.target.value })
    }

    function handleAccountChange(event) {
        setForm({ ...form, accountId: event.target.value })
    }

    function handleDescriptionChange(event) {
        setForm({ ...form, description: event.target.value })
    }

    function handleDateChange(event) {
        setForm({ ...form, date: event.target.value })
    }

    function selectCategory(category) {
        setForm({ ...form, category })
    }

    /*
     * Switches to expense and clears an income-only category if necessary.
     * This prevents the form from submitting an invalid type/category pair.
     */
    function selectExpense() {
        let selectedCategory = form.category

        if (!form.category || form.category === "Salary & Income") {
            selectedCategory = ""
        }

        setForm({ ...form, type: "expense", category: selectedCategory })
    }

    /* Switches to income and chooses its default Salary & Income category. */
    function selectIncome() {
        setForm({ ...form, type: "income", category: "Salary & Income" })
    }

    /* Prevents page refresh and sends the current controlled form to App. */
    function handleSubmit(event) {
        event.preventDefault()
        void onSubmit(form)
    }

    let submitButtonClass = "btn-expense"
    let submitButtonIcon = Icon.expense
    let submitButtonText = "Add expense"
    let expenseTypeButtonClass = "type-btn type-expense"
    let incomeTypeButtonClass = "type-btn type-income"

    if (form.type === "income") {
        submitButtonClass = "btn-income"
        submitButtonIcon = Icon.income
        submitButtonText = "Record income"
        incomeTypeButtonClass += " active"
    } else {
        expenseTypeButtonClass += " active"
    }

    return (
        <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <div className="modal" role="dialog" aria-modal="true" aria-label="Add transaction">
                <div className="modal-header">
                    <h2 className="modal-title">Add transaction</h2>
                    <button className="icon-btn" onClick={onClose} id="modal-close-btn" type="button" aria-label="Close transaction form">
                        {Icon.close}
                    </button>
                </div>

                {/* These buttons change the transaction type; they do not submit the form. */}
                <div className="type-toggle">
                    <button
                        id="type-expense-btn"
                        className={expenseTypeButtonClass}
                        onClick={selectExpense}
                        type="button"
                    >
                        <span className="type-icon">{Icon.expense}</span> Expense
                    </button>
                    <button
                        id="type-income-btn"
                        className={incomeTypeButtonClass}
                        onClick={selectIncome}
                        type="button"
                    >
                        <span className="type-icon">{Icon.income}</span> Income
                    </button>
                </div>

                <form className="modal-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="exp-amount">Amount (₹)</label>
                        <div className="amount-input-wrap">
                            <span className="amount-prefix">₹</span>
                            <input
                                id="exp-amount"
                                className="form-control form-input amount-input"
                                type="number"
                                placeholder="0.00"
                                min="0.01"
                                step="0.01"
                                value={form.amount}
                                onChange={handleAmountChange}
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="exp-account">Account</label>
                        <select
                            id="exp-account"
                            className="form-input form-select"
                            value={form.accountId}
                            onChange={handleAccountChange}
                            required
                        >
                            <option value="">Select account...</option>
                            {accounts.map((account) => (
                                <option key={account._id} value={account._id}>
                                    {account.name || `Account ...${account._id.slice(-8)}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Category</label>
                        <div className="category-grid">
                            {categories.map((category) => {
                                const meta = CATEGORY_DETAILS[category]
                                const showCategory = categoryMatchesType(category, form.type)

                                if (!showCategory) {
                                    return null
                                }

                                let categoryClass = "cat-chip"
                                if (form.category === category) {
                                    categoryClass += " selected"
                                }

                                return (
                                    <button
                                        key={category}
                                        type="button"
                                        id={`cat-${category.replace(/\s+/g, "-").toLowerCase()}`}
                                        className={categoryClass}
                                        style={{ "--cat-color": meta.color }}
                                        onClick={() => selectCategory(category)}
                                    >
                                        <span>{meta.icon}</span>
                                        <span>{category}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="exp-desc">
                            Description <span style={{ opacity: 0.5 }}>(optional)</span>
                        </label>
                        <input
                            id="exp-desc"
                            className="form-control form-input"
                            type="text"
                            placeholder="e.g. Lunch at Cafe Coffee Day"
                            value={form.description}
                            onChange={handleDescriptionChange}
                            maxLength={200}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="exp-date">Date</label>
                        <input
                            id="exp-date"
                            className="form-control form-input"
                            type="date"
                            value={form.date}
                            onChange={handleDateChange}
                            max={today}
                            required
                        />
                    </div>

                    <button
                        id="modal-submit-btn"
                        className={`btn w-100 btn-lg ${submitButtonClass}`}
                        type="submit"
                        disabled={busy || !form.amount || !form.accountId || !form.category}
                    >
                        {busy && <span className="spinner" />}
                        {busy && "Saving..."}
                        {!busy && submitButtonIcon}
                        {!busy && submitButtonText}
                    </button>
                </form>
            </div>
        </div>
    )
}
