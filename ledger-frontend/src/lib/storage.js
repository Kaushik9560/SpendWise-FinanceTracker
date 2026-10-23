// Only the safe user object is cached here. The JWT remains in an HttpOnly cookie.
const storageKey = "spendwise-user"

export function readStoredUser() {
    try {
        // localStorage returns text, so JSON.parse converts it back into an object.
        return JSON.parse(localStorage.getItem(storageKey) || "null")
    } catch {
        // Broken/old browser data should not crash the complete application.
        return null
    }
}

export function persistStoredSession(user) {
    // JSON.stringify converts the object into text that localStorage can store.
    localStorage.setItem(storageKey, JSON.stringify(user))
}

export function clearStoredSession() {
    // Logout removes the cached display data. Backend logout clears the real cookie.
    localStorage.removeItem(storageKey)
}
