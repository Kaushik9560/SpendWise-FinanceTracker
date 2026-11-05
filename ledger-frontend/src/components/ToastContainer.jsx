import { Icon } from "../icons"

/* Maps each notification type to a small visual symbol. */
function getToastIcon(type) {
    if (type === "success") return "✓"
    if (type === "error") return "✕"
    return "ℹ"
}

/*
 * Renders temporary notifications created in App.
 * It receives the toast array and calls onRemove with an id when the user closes
 * one; timeout-based removal remains controlled by App.
 */
export default function ToastContainer(props) {
    const toasts = props.toasts
    const onRemove = props.onRemove

    // map converts each toast object into one visible notification.
    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <div key={toast.id} className={`toast toast-${toast.type}`}>
                    <span className="toast-icon">{getToastIcon(toast.type)}</span>
                    <span className="toast-msg">{toast.message}</span>
                    <button className="toast-close" onClick={() => onRemove(toast.id)}>
                        {Icon.close}
                    </button>
                </div>
            ))}
        </div>
    )
}
