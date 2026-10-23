import { useEffect } from "react"
import { Icon } from "../icons"

export default function DeleteAccountModal({ account, busy, onClose, onConfirm }) {
    // Register Escape when the modal opens; cleanup removes it when the modal closes.
    useEffect(() => {
        function closeOnEscape(event) {
            if (event.key === "Escape" && !busy) onClose()
        }

        window.addEventListener("keydown", closeOnEscape)
        return () => window.removeEventListener("keydown", closeOnEscape)
    }, [busy, onClose])

    // This modal asks for confirmation; the backend performs the actual archive.
    return (
        <div className="modal-overlay" role="presentation"
            onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
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
                        {busy ? <><span className="spinner" /> Deleting...</> : <>{Icon.trash} Delete account</>}
                    </button>
                </div>
            </section>
        </div>
    )
}
