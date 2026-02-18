/**
 * AuthStateManager
 * Central singleton that holds current auth state and broadcasts changes.
 * Every component reads from this rather than calling getCurrentUser() repeatedly.
 */

import { supabase } from './SupabaseClient';
import { getCurrentProfile } from './AuthService';
import { Profile } from '../types/database';
import { shouldClearSession, clearRememberMe } from './RememberMeService';

/**
 * Fetch the user's profile, creating one if it doesn't exist yet.
 * This handles OAuth users (e.g. Google) who sign in for the first time
 * and don't have a profile row created by a database trigger.
 */
async function getOrCreateProfile(userId: string): Promise<Profile | null> {
  let profile = await getCurrentProfile();
  if (profile) return profile;

  // Profile doesn't exist — create one (mirrors AuthService.signIn logic)
  try {
    const { data: newProfile, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        username: `Player_${userId.substring(0, 8)}`,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create profile for OAuth user:', error);
      return null;
    }
    return newProfile;
  } catch (e) {
    console.error('Error creating profile:', e);
    return null;
  }
}

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
  private static readonly SESSION_CHECK_TIMEOUT_MS = 8000;

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
      // Set up the auth state change listener FIRST, before getSession(),
      // so we catch any events fired during session initialization
      // (e.g. SIGNED_IN from OAuth redirect processing).
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await getOrCreateProfile(session.user.id);
          const fallbackName = session.user.user_metadata?.full_name
            || session.user.email?.split('@')[0]
            || `Player_${session.user.id.substring(0, 8)}`;
          this.setState({
            isAuthenticated: true,
            userId: session.user.id,
            username: profile?.username || fallbackName,
            profile: profile || null,
          });
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

      // Now check for an existing session.
      // getSession() waits for Supabase's internal initialization to complete,
      // which includes processing OAuth callback params (PKCE code or implicit tokens) from the URL.
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Auth session check timed out')), AuthStateManager.SESSION_CHECK_TIMEOUT_MS);
        }),
      ]);

      const { data: { session } } = sessionResult;

      if (session?.user) {
        // If the user opted out of "stay signed in" and the browser was closed,
        // clear the session so they must sign in again.
        if (shouldClearSession()) {
          await supabase.auth.signOut();
          clearRememberMe();
          // Fall through to guest state below
        } else {
          const profile = await getOrCreateProfile(session.user.id);
          const fallbackName = session.user.user_metadata?.full_name
            || session.user.email?.split('@')[0]
            || `Player_${session.user.id.substring(0, 8)}`;
          this.state = {
            isAuthenticated: true,
            userId: session.user.id,
            username: profile?.username || fallbackName,
            profile: profile || null,
          };
        }
      }
    } catch (error) {
      console.warn('Auth initialization failed or timed out, continuing as guest:', error);
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
    this.setState({
      isAuthenticated: true,
      userId: profile.id,
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
