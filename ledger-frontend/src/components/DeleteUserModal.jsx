import { useEffect, useState } from "react"
import { Icon } from "../icons"

export default function DeleteUserModal(props) {
    const busy = props.busy
    const onClose = props.onClose
    const onConfirm = props.onConfirm

    // Both fields are required because deleting a complete user is irreversible.
    const [password, setPassword] = useState("")
    const [confirmation, setConfirmation] = useState("")
    const ready = password.length > 0 && confirmation === "DELETE"

    // Effects are useful for browser events that are outside normal React clicks.
    useEffect(() => {
        function closeOnEscape(event) {
            if (event.key === "Escape" && !busy) onClose()
        }
        window.addEventListener("keydown", closeOnEscape)
        return () => window.removeEventListener("keydown", closeOnEscape)
    }, [busy, onClose])

    function handleOverlayMouseDown(event) {
        const clickedOutsideModal = event.target === event.currentTarget

        if (clickedOutsideModal && !busy) {
            onClose()
        }
    }

    function handleSubmit(event) {
        event.preventDefault()

        if (ready) {
            onConfirm({ password, confirmation })
        }
    }

    function handlePasswordChange(event) {
        setPassword(event.target.value)
    }

    function handleConfirmationChange(event) {
        setConfirmation(event.target.value)
    }

    return (
        <div className="modal-overlay" role="presentation" onMouseDown={handleOverlayMouseDown}>
            <section className="modal delete-user-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
                <div className="delete-modal-header">
                    <div className="delete-modal-icon">{Icon.trash}</div>
                    <div className="delete-modal-heading">
                        <span>Permanent action</span>
                        <h2 id="delete-user-title">Delete SpendWise account?</h2>
                        <p>This action cannot be undone.</p>
                    </div>
                    <button className="icon-btn" type="button" onClick={onClose} disabled={busy} aria-label="Close">{Icon.close}</button>
                </div>

                <div className="delete-impact">
                    <strong>The following data will be permanently removed:</strong>
                    <ul>
                        <li>Linked accounts and balances</li>
                        <li>Transactions and ledger history</li>
                        <li>Budgets and analytics data</li>
                    </ul>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="delete-password">Current password</label>
                        <input
                            id="delete-password"
                            className="form-control form-input"
                            type="password"
                            value={password}
                            onChange={handlePasswordChange}
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            autoFocus
                            disabled={busy}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="delete-confirmation">Type <code>DELETE</code> to confirm</label>
                        <input
                            id="delete-confirmation"
                            className="form-control form-input"
                            value={confirmation}
                            onChange={handleConfirmationChange}
                            autoComplete="off"
                            placeholder="DELETE"
                            disabled={busy}
                            required
                        />
                    </div>
                    <div className="modal-actions">
                        <button className="btn btn-secondary" type="button" onClick={onClose} disabled={busy}>Keep my account</button>
                        <button className="btn btn-danger" type="submit" disabled={!ready || busy}>
                            {busy && <span className="spinner" />}
                            {busy && "Deleting..."}
                            {!busy && Icon.trash}
                            {!busy && "Delete account"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    )
}
