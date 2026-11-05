import { useState } from "react"
import { Icon } from "../icons"

/*
 * Collects a new account name inside a controlled modal form.
 * App passes loading/close/submit callbacks; this component owns only the text
 * input and returns the trimmed name when the user submits.
 */
export default function CreateAccountModal(props) {
    const busy = props.busy
    const onClose = props.onClose
    const onSubmit = props.onSubmit

    // Controlled input: React state is the single source of truth for the text box.
    const [name, setName] = useState("")
    const trimmedName = name.trim()

    /*
     * Prevents browser refresh and passes a non-empty trimmed name to App.
     * App then validates again, calls the backend, and controls the busy state.
     */
    function handleSubmit(event) {
        event.preventDefault()

        if (trimmedName) {
            void onSubmit(trimmedName)
        }
    }

    /* Closes only when the dark backdrop itself is clicked and no request is active. */
    function handleOverlayClick(event) {
        if (event.target === event.currentTarget && !busy) {
            onClose()
        }
    }

    function handleNameChange(event) {
        setName(event.target.value)
    }

    // role="dialog" and aria-modal help screen readers understand the overlay.
    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
                <div className="modal-header">
                    <h2 className="modal-title" id="account-modal-title">Create account</h2>
                    <button className="icon-btn" type="button" onClick={onClose} disabled={busy} aria-label="Close">
                        {Icon.close}
                    </button>
                </div>

                <p className="modal-description">
                    Add a name you can easily recognize in expenses and transfers.
                </p>

                <form className="modal-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="account-name">Account name</label>
                        <input
                            id="account-name"
                            className="form-control form-input"
                            type="text"
                            placeholder="e.g. SBI Salary or Cash Wallet"
                            value={name}
                            onChange={handleNameChange}
                            maxLength={50}
                            disabled={busy}
                            autoFocus
                            required
                        />
                        <span className="form-hint">Maximum 50 characters</span>
                    </div>

                    <div className="modal-actions">
                        <button className="btn btn-secondary" type="button" onClick={onClose} disabled={busy}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" type="submit" disabled={busy || !trimmedName}>
                            {busy && <span className="spinner" />}
                            {busy && "Creating..."}
                            {!busy && Icon.plus}
                            {!busy && "Create account"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
