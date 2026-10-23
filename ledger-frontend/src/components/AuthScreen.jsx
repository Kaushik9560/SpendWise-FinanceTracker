import { ledgerApi } from "../api"
import heroImage from "../assets/spendwise-hero.png"
import BrandMark from "./BrandMark"

/*
 * Text for every authentication screen.
 * Keeping it outside JSX removes repeated conditional headings from the UI.
 */
const AUTH_COPY = {
    login: ["Welcome back", "Sign in to SpendWise", "Enter your details to continue to your dashboard."],
    register: ["Get started", "Create your account", "We will verify your email before activating your workspace."],
    forgot: ["Account recovery", "Forgot your password?", "Enter your verified email and we will send a secure reset link."],
    reset: ["Account recovery", "Choose a new password", "Use at least 8 characters for your new password."],
    "verify-pending": ["One last step", "Check your email", "Open the verification link we sent to activate your account."]
}

function healthLabel(health) {
    if (health === "online") return "Service available"
    if (health === "offline") return "Service unavailable"
    return "Checking service"
}

/*
 * AuthScreen only displays forms. App.jsx owns authentication logic and passes
 * event functions as props. This is separation of UI and business logic.
 */
export default function AuthScreen({
    mode,
    setMode,
    authForm,
    setAuthForm,
    busyAction,
    onSubmit,
    health,
    onHealthCheck,
    authNotice,
    onResendVerification
}) {
    // These booleans make conditional JSX read like English.
    const isLogin = mode === "login"
    const isRegister = mode === "register"
    const isForgot = mode === "forgot"
    const isReset = mode === "reset"
    const isPending = mode === "verify-pending"

    const [eyebrow, title, defaultSubtitle] = AUTH_COPY[mode] || AUTH_COPY.login
    const subtitle = isPending && authNotice?.message ? authNotice.message : defaultSubtitle

    // Update one property without removing the other form properties.
    function updateField(field, value) {
        setAuthForm((current) => ({ ...current, [field]: value }))
    }

    // Clear sensitive fields whenever the user changes authentication screen.
    function changeMode(nextMode) {
        setAuthForm({
            name: "",
            email: nextMode === "forgot" ? authForm.email : "",
            password: "",
            confirmPassword: ""
        })
        setMode(nextMode)
    }

    return (
        <div className="auth-page">
            {/* Left side is visual branding; aria-hidden elements are decorative. */}
            <section className="auth-left" aria-label="SpendWise">
                <div className="auth-brand">
                    <div className="brand-header">
                        <span className="brand-logo"><BrandMark /></span>
                        <span className="brand-name">SpendWise</span>
                    </div>

                    <div className="brand-copy">
                        <p className="brand-eyebrow">Spend smarter. Live better.</p>
                        <h1>Make every rupee count.</h1>
                        <p className="brand-tagline">
                            A simpler way to see where your money goes—and shape where it takes you.
                        </p>
                    </div>

                    <div className="brand-visual" aria-hidden="true">
                        <div className="brand-glow" />
                        <div className="brand-orbit"><span /></div>
                        <span className="brand-particle particle-one" />
                        <span className="brand-particle particle-two" />
                        <span className="brand-particle particle-three" />

                        <div className="visual-card visual-saving">
                            <span>Monthly savings</span>
                            <strong>+18.4%</strong>
                        </div>

                        <div className="visual-card visual-budget">
                            <div><span>Smart budget</span><strong>76%</strong></div>
                            <i><b /></i>
                        </div>

                        <img src={heroImage} alt="" />
                    </div>
                    <p className="brand-signoff">Track. Plan. Grow.</p>
                </div>
            </section>

            {/* Right side changes between login, register, forgot, reset, and verify. */}
            <main className="auth-right">
                <div className="auth-card">
                    <div className="auth-mobile-brand">
                        <span className="brand-logo"><BrandMark /></span>
                        <span className="brand-name">SpendWise</span>
                    </div>

                    {(isLogin || isRegister) && (
                        <div className="auth-mode-row">
                            <span>{isRegister ? "Already have an account?" : "New to SpendWise?"}</span>
                            <button type="button" onClick={() => changeMode(isRegister ? "login" : "register")}>
                                {isRegister ? "Sign in" : "Create account"}
                            </button>
                        </div>
                    )}

                    <header className="auth-header">
                        <p className="auth-eyebrow">{eyebrow}</p>
                        <h2 className="auth-title">{title}</h2>
                        <p className="auth-sub">{subtitle}</p>
                    </header>

                    {isPending ? (
                        /* Verification has no normal form, only resend and back actions. */
                        <div className="auth-form">
                            <div className="auth-info-box">
                                Verification links expire after 24 hours. Check your spam folder too.
                            </div>

                            {authNotice?.previewUrl && (
                                <a className="btn btn-secondary btn-full" href={authNotice.previewUrl}>
                                    Open local verification link
                                </a>
                            )}

                            <button
                                className="btn btn-primary btn-full btn-lg auth-submit"
                                type="button"
                                disabled={busyAction === "resend"}
                                onClick={() => void onResendVerification()}
                            >
                                {busyAction === "resend" ? <><span className="spinner" /> Sending...</> : "Resend verification email"}
                            </button>

                            <button className="auth-link-button" type="button" onClick={() => changeMode("login")}>
                                Back to sign in
                            </button>
                        </div>
                    ) : (
                        /* Controlled inputs read from authForm and update it on every keystroke. */
                        <form onSubmit={onSubmit} className="auth-form">
                            {isRegister && (
                                <div className="form-group">
                                    <label className="form-label" htmlFor="reg-name">Full name</label>
                                    <input
                                        id="reg-name"
                                        className="form-input"
                                        type="text"
                                        placeholder="Your name"
                                        value={authForm.name}
                                        onChange={(event) => updateField("name", event.target.value)}
                                        autoComplete="name"
                                        maxLength={100}
                                        required
                                    />
                                </div>
                            )}

                            {!isReset && (
                                <div className="form-group">
                                    <label className="form-label" htmlFor="auth-email">Email address</label>
                                    <input
                                        id="auth-email"
                                        className="form-input"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={authForm.email}
                                        onChange={(event) => updateField("email", event.target.value)}
                                        autoComplete="email"
                                        maxLength={254}
                                        required
                                    />
                                </div>
                            )}

                            {!isForgot && (
                                <div className="form-group auth-password-group">
                                    <div className="auth-label-row">
                                        <label className="form-label" htmlFor="auth-password">
                                            {isReset ? "New password" : "Password"}
                                        </label>
                                        {(isRegister || isReset) && <span>8 characters minimum</span>}
                                    </div>
                                    <input
                                        id="auth-password"
                                        className="form-input"
                                        type="password"
                                        placeholder="Enter your password"
                                        value={authForm.password}
                                        onChange={(event) => updateField("password", event.target.value)}
                                        autoComplete={isLogin ? "current-password" : "new-password"}
                                        minLength={isLogin ? 1 : 8}
                                        maxLength={128}
                                        required
                                    />
                                </div>
                            )}

                            {isReset && (
                                <div className="form-group">
                                    <label className="form-label" htmlFor="confirm-password">Confirm new password</label>
                                    <input
                                        id="confirm-password"
                                        className="form-input"
                                        type="password"
                                        value={authForm.confirmPassword}
                                        onChange={(event) => updateField("confirmPassword", event.target.value)}
                                        autoComplete="new-password"
                                        minLength={8}
                                        maxLength={128}
                                        required
                                    />
                                </div>
                            )}

                            {isLogin && (
                                <button className="auth-link-button auth-forgot-link" type="button" onClick={() => changeMode("forgot")}>
                                    Forgot password?
                                </button>
                            )}

                            <button
                                id="auth-submit-btn"
                                className="btn btn-primary btn-full btn-lg auth-submit"
                                type="submit"
                                disabled={Boolean(busyAction)}
                            >
                                {busyAction === mode
                                    ? <><span className="spinner" /> Please wait...</>
                                    : isRegister ? "Create account"
                                        : isForgot ? "Send reset link"
                                            : isReset ? "Reset password"
                                                : "Sign in"}
                            </button>

                            {(isForgot || isReset) && (
                                <button className="auth-link-button" type="button" onClick={() => changeMode("login")}>
                                    Back to sign in
                                </button>
                            )}
                        </form>
                    )}

                    <p className="auth-privacy-note">
                        Your password is hashed and your session uses a secure, HttpOnly cookie.
                    </p>

                    <button
                        className="api-status-row"
                        onClick={() => void onHealthCheck()}
                        id="health-check-btn"
                        type="button"
                        aria-label="Check service status"
                    >
                        <span className={`status-dot dot-${health}`} />
                        <span aria-live="polite">{healthLabel(health)}</span>
                        <span className="api-url">{ledgerApi.baseUrl}</span>
                    </button>
                </div>
            </main>
        </div>
    )
}
