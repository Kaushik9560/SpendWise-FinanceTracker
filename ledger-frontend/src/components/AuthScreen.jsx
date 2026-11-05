import heroImage from "../assets/spendwise-hero.png"
import BrandMark from "./BrandMark"

/*
 * Text for every authentication screen.
 * Keeping it outside JSX removes repeated conditional headings from the UI.
 */
const AUTH_COPY = {
    login: {
        eyebrow: "Welcome back",
        title: "Sign in to SpendWise",
        subtitle: "Enter your details to continue to your dashboard."
    },
    register: {
        eyebrow: "Get started",
        title: "Create your account",
        subtitle: "We will verify your email before activating your workspace."
    },
    forgot: {
        eyebrow: "Account recovery",
        title: "Forgot your password?",
        subtitle: "Enter your verified email and we will send a secure reset link."
    },
    reset: {
        eyebrow: "Account recovery",
        title: "Choose a new password",
        subtitle: "Use at least 8 characters for your new password."
    },
    "verify-pending": {
        eyebrow: "One last step",
        title: "Check your email",
        subtitle: "Open the verification link we sent to activate your account."
    }
}

function getSubmitButtonText(mode, isBusy) {
    if (isBusy) return "Please wait..."
    if (mode === "register") return "Create account"
    if (mode === "forgot") return "Send reset link"
    if (mode === "reset") return "Reset password"
    return "Sign in"
}

/*
 * AuthScreen only displays forms. App.jsx owns authentication logic and passes
 * event functions as props. This is separation of UI and business logic.
 */
export default function AuthScreen(props) {
    // App owns authentication state. This screen receives it through props.
    const mode = props.mode
    const setMode = props.setMode
    const authForm = props.authForm
    const setAuthForm = props.setAuthForm
    const busyAction = props.busyAction
    const onSubmit = props.onSubmit
    const authNotice = props.authNotice
    const onResendVerification = props.onResendVerification

    // These booleans make conditional JSX read like English.
    const isLogin = mode === "login"
    const isRegister = mode === "register"
    const isForgot = mode === "forgot"
    const isReset = mode === "reset"
    const isPending = mode === "verify-pending"

    let pageText = AUTH_COPY[mode]
    if (!pageText) {
        pageText = AUTH_COPY.login
    }

    const eyebrow = pageText.eyebrow
    const title = pageText.title
    const defaultSubtitle = pageText.subtitle

    let subtitle = defaultSubtitle
    if (isPending && authNotice && authNotice.message) {
        subtitle = authNotice.message
    }

    let previewUrl = ""
    if (authNotice && authNotice.previewUrl) {
        previewUrl = authNotice.previewUrl
    }

    let switchMessage = "New to SpendWise?"
    let switchButtonText = "Create account"
    let switchToMode = "register"

    if (isRegister) {
        switchMessage = "Already have an account?"
        switchButtonText = "Sign in"
        switchToMode = "login"
    }

    const formIsBusy = busyAction === mode
    const isResending = busyAction === "resend"
    const submitButtonText = getSubmitButtonText(mode, formIsBusy)

    let passwordLabel = "Password"
    let passwordAutoComplete = "new-password"
    let passwordMinimumLength = 8

    if (isLogin) {
        passwordAutoComplete = "current-password"
        passwordMinimumLength = 1
    }

    if (isReset) {
        passwordLabel = "New password"
    }

    // The spread keeps old fields. The last property changes only one field.
    function handleNameChange(event) {
        setAuthForm({ ...authForm, name: event.target.value })
    }

    function handleEmailChange(event) {
        setAuthForm({ ...authForm, email: event.target.value })
    }

    function handlePasswordChange(event) {
        setAuthForm({ ...authForm, password: event.target.value })
    }

    function handleConfirmPasswordChange(event) {
        setAuthForm({ ...authForm, confirmPassword: event.target.value })
    }

    // Clear sensitive fields whenever the user changes authentication screen.
    function changeMode(nextMode) {
        let email = ""
        if (nextMode === "forgot") {
            email = authForm.email
        }

        setAuthForm({
            name: "",
            email,
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
                            A simpler way to see where your money goes and shape where it takes you.
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
                            <span>{switchMessage}</span>
                            <button type="button" onClick={() => changeMode(switchToMode)}>
                                {switchButtonText}
                            </button>
                        </div>
                    )}

                    <header className="auth-header">
                        <p className="auth-eyebrow">{eyebrow}</p>
                        <h2 className="auth-title">{title}</h2>
                        <p className="auth-sub">{subtitle}</p>
                    </header>

                    {/* Verification has no normal form, only resend and back actions. */}
                    {isPending && (
                        <div className="auth-form">
                            <div className="auth-info-box">
                                Verification links expire after 24 hours. Check your spam folder too.
                            </div>

                            {previewUrl && (
                                <a className="btn btn-secondary w-100" href={previewUrl}>
                                    Open local verification link
                                </a>
                            )}

                            <button
                                className="btn btn-primary w-100 btn-lg auth-submit"
                                type="button"
                                disabled={isResending}
                                onClick={() => void onResendVerification()}
                            >
                                {isResending && <span className="spinner" />}
                                {isResending && "Sending..."}
                                {!isResending && "Resend verification email"}
                            </button>

                            <button className="auth-link-button" type="button" onClick={() => changeMode("login")}>
                                Back to sign in
                            </button>
                        </div>
                    )}

                    {/* Controlled inputs read from authForm and update it on every keystroke. */}
                    {!isPending && (
                        <form onSubmit={onSubmit} className="auth-form">
                            {isRegister && (
                                <div className="form-group">
                                    <label className="form-label" htmlFor="reg-name">Full name</label>
                                    <input
                                        id="reg-name"
                                        className="form-control form-input"
                                        type="text"
                                        placeholder="Your name"
                                        value={authForm.name}
                                        onChange={handleNameChange}
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
                                        className="form-control form-input"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={authForm.email}
                                        onChange={handleEmailChange}
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
                                            {passwordLabel}
                                        </label>
                                        {(isRegister || isReset) && <span>8 characters minimum</span>}
                                    </div>
                                    <input
                                        id="auth-password"
                                        className="form-control form-input"
                                        type="password"
                                        placeholder="Enter your password"
                                        value={authForm.password}
                                        onChange={handlePasswordChange}
                                        autoComplete={passwordAutoComplete}
                                        minLength={passwordMinimumLength}
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
                                        className="form-control form-input"
                                        type="password"
                                        value={authForm.confirmPassword}
                                        onChange={handleConfirmPasswordChange}
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
                                className="btn btn-primary w-100 btn-lg auth-submit"
                                type="submit"
                                disabled={Boolean(busyAction)}
                            >
                                {formIsBusy && <span className="spinner" />}
                                {submitButtonText}
                            </button>

                            {(isForgot || isReset) && (
                                <button className="auth-link-button" type="button" onClick={() => changeMode("login")}>
                                    Back to sign in
                                </button>
                            )}
                        </form>
                    )}

                </div>
            </main>
        </div>
    )
}
