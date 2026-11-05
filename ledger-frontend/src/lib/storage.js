// Only the safe user object is cached here. The JWT remains in an HttpOnly cookie.
const storageKey = "spendwise-user"

/*
 * Reads the cached display-only user when the app starts.
 * Invalid or old JSON returns null instead of crashing initial rendering.
 */
export function readStoredUser() {
    try {
        // localStorage returns text, so JSON.parse converts it back into an object.
        return JSON.parse(localStorage.getItem(storageKey) || "null")
    } catch {
        // Broken/old browser data should not crash the complete application.
        return null
    }
}

/*
 * Caches only the safe user profile so the UI can render during session checking.
 * The JWT is intentionally absent because authentication uses an HttpOnly cookie.
 */
export function persistStoredSession(user) {
    // JSON.stringify converts the object into text that localStorage can store.
    localStorage.setItem(storageKey, JSON.stringify(user))
}

/*
 * Removes the cached profile during logout, deletion, or session expiry.
 * Server logout is responsible for clearing the real authentication cookie.
 */
export function clearStoredSession() {
    // Logout removes the cached display data. Backend logout clears the real cookie.
    localStorage.removeItem(storageKey)
}
