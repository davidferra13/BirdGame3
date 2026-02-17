/**
 * AuthStateManager
 * Central singleton that holds current auth state and broadcasts changes.
 * Every component reads from this rather than calling getCurrentUser() repeatedly.
 */

import { supabase, getCurrentUser } from './SupabaseClient';
import { getCurrentProfile } from './AuthService';
import { Profile } from '../types/database';
import { shouldClearSession, clearRememberMe } from './RememberMeService';

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  username: string;
  profile: Profile | null;
}

export type AuthStateListener = (state: AuthState) => void;

const GUEST_ID_KEY = 'birdgame_guest_id';
const GUEST_NAME_KEY = 'birdgame_guest_name';

class AuthStateManager {
  private state: AuthState;
  private listeners: Set<AuthStateListener> = new Set();

  constructor() {
    // Start with guest state; initialize() will resolve the real state
    const guest = this.getGuestIdentity();
    this.state = {
      isAuthenticated: false,
      userId: guest.userId,
      username: guest.username,
      profile: null,
    };
  }

  /**
   * Initialize by checking for an existing Supabase session.
   * Must be called once at app startup before any UI is shown.
   */
  async initialize(): Promise<AuthState> {
    try {
      // Check for existing session
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // If the user opted out of "stay signed in" and the browser was closed,
        // clear the session so they must sign in again.
        if (shouldClearSession()) {
          await supabase.auth.signOut();
          clearRememberMe();
          // Fall through to guest state below
        } else {
          const profile = await getCurrentProfile();
          if (profile) {
            this.state = {
              isAuthenticated: true,
              userId: session.user.id,
              username: profile.username,
              profile,
            };
          }
        }
      }

      // Listen for future auth state changes (token refresh, sign out from another tab)
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await getCurrentProfile();
          if (profile) {
            this.setState({
              isAuthenticated: true,
              userId: session.user.id,
              username: profile.username,
              profile,
            });
          }
        } else if (event === 'SIGNED_OUT') {
          const guest = this.getGuestIdentity();
          this.setState({
            isAuthenticated: false,
            userId: guest.userId,
            username: guest.username,
            profile: null,
          });
        }
      });
    } catch (error) {
      console.warn('Auth initialization failed, continuing as guest:', error);
    }

    return this.state;
  }

  /** Synchronous getter — safe after initialize() resolves */
  getState(): AuthState {
    return this.state;
  }

  /** Subscribe to auth state changes. Returns unsubscribe function. */
  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called after successful sign-in or sign-up */
  async onSignIn(profile: Profile): Promise<void> {
    const user = await getCurrentUser();
    this.setState({
      isAuthenticated: true,
      userId: user?.id || profile.id,
      username: profile.username,
      profile,
    });
  }

  /** Called after sign-out or account deletion */
  async onSignOut(): Promise<void> {
    clearRememberMe();
    const guest = this.getGuestIdentity();
    this.setState({
      isAuthenticated: false,
      userId: guest.userId,
      username: guest.username,
      profile: null,
    });
  }

  /** Refresh the profile data from Supabase (e.g., after username change) */
  async refreshProfile(): Promise<void> {
    if (!this.state.isAuthenticated) return;
    const profile = await getCurrentProfile();
    if (profile) {
      this.setState({
        ...this.state,
        username: profile.username,
        profile,
      });
    }
  }

  private setState(newState: AuthState): void {
    this.state = newState;
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (e) {
        console.error('Auth state listener error:', e);
      }
    }
  }

  /**
   * Generate a stable guest identity persisted in localStorage.
   * Reused across page reloads so the guest has a consistent multiplayer name.
   */
  private getGuestIdentity(): { userId: string; username: string } {
    let guestId = localStorage.getItem(GUEST_ID_KEY);
    let guestName = localStorage.getItem(GUEST_NAME_KEY);

    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem(GUEST_ID_KEY, guestId);
    }

    if (!guestName) {
      guestName = 'Bird_' + guestId.substring(6, 10);
      localStorage.setItem(GUEST_NAME_KEY, guestName);
    }

    return { userId: guestId, username: guestName };
  }
}

export const authStateManager = new AuthStateManager();
