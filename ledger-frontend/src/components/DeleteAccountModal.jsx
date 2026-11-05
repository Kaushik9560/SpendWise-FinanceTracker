import { useEffect } from "react"
import { Icon } from "../icons"

/*
 * Displays confirmation for the account selected in AccountsSection.
 * App supplies the account and confirm/close callbacks; the modal never deletes
 * data itself. Busy state locks dismissal while the backend request is running.
 */
export default function DeleteAccountModal(props) {
    const account = props.account
    const busy = props.busy
    const onClose = props.onClose
    const onConfirm = props.onConfirm

    /*
     * Registers Escape while the modal is mounted and removes it on cleanup.
     * busy and onClose are dependencies because the listener must use their latest
     * values and must not dismiss a deletion already in progress.
     */
    useEffect(() => {
        function closeOnEscape(event) {
            if (event.key === "Escape" && !busy) onClose()
        }

        window.addEventListener("keydown", closeOnEscape)
        return () => window.removeEventListener("keydown", closeOnEscape)
    }, [busy, onClose])

    /* Closes on a backdrop click, but ignores clicks inside the dialog. */
    function handleOverlayMouseDown(event) {
        const clickedOutsideModal = event.target === event.currentTarget

        if (clickedOutsideModal && !busy) {
            onClose()
        }
    }

    // This modal only asks for confirmation; App performs the API deletion.
    return (
        <div className="modal-overlay" role="presentation" onMouseDown={handleOverlayMouseDown}>
            <section className="modal account-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
                <div className="delete-modal-header">
                    <div className="delete-modal-icon">{Icon.trash}</div>
                    <div className="delete-modal-heading">
                        <span>Remove account</span>
                        <h2 id="delete-account-title">Delete {account.name}?</h2>
                        <p>Review what happens before you continue.</p>
                    </div>
                    <button className="icon-btn" type="button" onClick={onClose} disabled={busy} aria-label="Close">
                        {Icon.close}
                    </button>
                </div>

                <div className="account-delete-summary">
                    <div className="acc-icon">{Icon.accounts}</div>
                    <div><strong>{account.name}</strong><span>Financial account</span></div>
                    <span className="zero-balance-badge">₹0 required</span>
                </div>

                <p className="account-delete-note">
                    Only a zero-balance account can be deleted. It will disappear from your workspace, while its past transaction records stay safely preserved.
                </p>

                <div className="modal-actions">
                    <button className="btn btn-secondary" type="button" onClick={onClose} disabled={busy} autoFocus>Keep account</button>
                    <button className="btn btn-danger account-delete-button" type="button" onClick={onConfirm} disabled={busy}>
                        {busy && <span className="spinner" />}
                        {busy && "Deleting..."}
                        {!busy && Icon.trash}
                        {!busy && "Delete account"}
                    </button>
                </div>
            </section>
        </div>
    )
}
