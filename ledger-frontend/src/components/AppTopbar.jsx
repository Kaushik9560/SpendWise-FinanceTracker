import { Icon } from "../icons"

export default function AppTopbar(props) {
    const activeTab = props.activeTab
    const user = props.user
    const onShowModal = props.onShowModal

    const firstName = user.name.split(" ")[0]
    let pageTitle = "Dashboard"
    let pageSubtitle = `Good to see you, ${firstName}`

    if (activeTab === "expenses") {
        pageTitle = "Expenses"
        pageSubtitle = "Review income and spending in one place"
    } else if (activeTab === "analytics") {
        pageTitle = "Analytics"
        pageSubtitle = "Understand where your money goes"
    } else if (activeTab === "accounts") {
        pageTitle = "Accounts"
        pageSubtitle = "Manage your linked accounts"
    } else if (activeTab === "transfer") {
        pageTitle = "Transfer"
        pageSubtitle = "Move money between your accounts"
    } else if (activeTab === "budget") {
        pageTitle = "Budget"
        pageSubtitle = "Plan monthly spending by category"
    }

    // activeTab decides the heading; the button asks App to open the modal.
    return (
        <div className="topbar">
            <div className="topbar-info">
                <h1 className="page-title">{pageTitle}</h1>
                <p className="page-subtitle">{pageSubtitle}</p>
            </div>
            <button id="topbar-add-btn" className="btn btn-primary" onClick={onShowModal}>
                {Icon.plus} Add transaction
            </button>
        </div>
    )
}
