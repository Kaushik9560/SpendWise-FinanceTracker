import { Icon } from "../icons"
import BrandMark from "./BrandMark"

function getHealthText(health) {
    if (health === "online") return "Service online"
    if (health === "offline") return "Offline"
    return "Connecting..."
}

export default function AppSidebar(props) {
    // Each value below comes from App.jsx through props.
    const user = props.user
    const activeTab = props.activeTab
    const navItems = props.navItems
    const health = props.health
    const busyAction = props.busyAction
    const onSetActiveTab = props.onSetActiveTab
    const onHealthCheck = props.onHealthCheck
    const onLogout = props.onLogout

    // Parent owns activeTab; sidebar only displays buttons and reports clicks.
    const healthText = getHealthText(health)

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-mark"><BrandMark /></div>
                <div className="logo-text">
                    SpendWise
                    <span>Personal finance</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                <span className="nav-section-label">Menu</span>
                {/* map avoids writing six almost identical navigation buttons. */}
                {navItems.map((item) => {
                    let buttonClass = "nav-item"
                    if (activeTab === item.id) {
                        buttonClass += " active"
                    }

                    return (
                        <button
                            key={item.id}
                            id={`nav-${item.id}`}
                            className={buttonClass}
                            onClick={() => onSetActiveTab(item.id)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    )
                })}
            </nav>

            <div className="sidebar-bottom">
                <div className="sidebar-user">
                    <div className="user-avatar">{user.name[0].toUpperCase()}</div>
                    <div className="user-info">
                        <div className="user-name">{user.name}</div>
                        <div className="user-email">{user.email}</div>
                    </div>
                </div>

                <div className="sidebar-status-row">
                    <button
                        className="status-pill"
                        onClick={() => void onHealthCheck()}
                        id="sidebar-health-pill"
                        type="button"
                        aria-label="Check service status"
                    >
                        <span className={`status-dot dot-${health}`} />
                        <span>{healthText}</span>
                    </button>
                    <button
                        id="nav-logout"
                        className="icon-btn logout-btn"
                        onClick={() => void onLogout()}
                        disabled={busyAction === "logout"}
                        title="Logout"
                    >
                        {Icon.logout}
                    </button>
                </div>
            </div>
        </aside>
    )
}
