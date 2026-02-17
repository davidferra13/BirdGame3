/**
 * RememberMeService
 * Manages the "Stay signed in" preference.
 *
 * When "Stay signed in" is checked (default), the Supabase session persists
 * across browser restarts via localStorage (normal behavior).
 *
 * When unchecked, we mark the session as temporary. A sessionStorage flag
 * tracks whether the browser is still open. On the next app load, if the
 * flag is missing (browser was closed), the user is automatically signed out.
 */

const REMEMBER_ME_KEY = 'birdgame_remember_me';
const SESSION_ALIVE_KEY = 'birdgame_session_alive';

/**
 * Store the user's "stay signed in" preference after a successful sign-in.
 */
export function setRememberMe(remember: boolean): void {
  if (remember) {
    localStorage.setItem(REMEMBER_ME_KEY, 'true');
    sessionStorage.removeItem(SESSION_ALIVE_KEY);
  } else {
    localStorage.setItem(REMEMBER_ME_KEY, 'false');
    // Mark this browser session as active so we don't sign out on same-session reloads
    sessionStorage.setItem(SESSION_ALIVE_KEY, 'true');
  }
}

/**
 * Check whether the current session should be cleared.
 * Returns true if the user explicitly opted out of "stay signed in" AND the
 * browser has been closed and reopened since (sessionStorage is gone).
 */
export function shouldClearSession(): boolean {
  const rememberMe = localStorage.getItem(REMEMBER_ME_KEY);

  // If "remember me" is explicitly 'false', the user chose not to stay signed in.
  // Check if the browser session is still alive.
  if (rememberMe === 'false') {
    const sessionAlive = sessionStorage.getItem(SESSION_ALIVE_KEY);
    if (sessionAlive) {
      // Same browser session (page reload, navigation) — keep the session
      return false;
    }
    // Browser was closed and reopened — clear the session
    return true;
  }

  // 'true' or null (never set / existing user before this feature) — stay signed in
  return false;
}

/**
 * Clean up remember-me state on sign-out.
 */
export function clearRememberMe(): void {
  localStorage.removeItem(REMEMBER_ME_KEY);
  sessionStorage.removeItem(SESSION_ALIVE_KEY);
}
