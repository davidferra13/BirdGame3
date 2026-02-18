/**
 * Authentication Service
 * Implements AUTH_AND_ACCOUNTS.md specification
 *
 * Features:
 * - Email/password authentication
 * - Magic link support (optional)
 * - Persistent profile management
 * - Self-serve account deletion
 */

import { supabase } from './SupabaseClient';
import { Profile } from '../types/database';

export interface SignUpData {
  email: string;
  password: string;
  username?: string;
}

export interface SignInData {
  identifier: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  profile?: Profile;
  requiresEmailConfirmation?: boolean;
}

function normalizeAuthError(message: string): string {
  const msg = message.toLowerCase();

  if (msg.includes('invalid login credentials')) {
    return 'Email or password is incorrect. If you are new, create an account first.';
  }

  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email, then sign in.';
  }

  if (msg.includes('user already registered')) {
    return 'An account with this email already exists. Try signing in.';
  }

  return message;
}

async function fetchOrCreateProfile(userId: string): Promise<Profile | null> {
  try {
    const existingProfile = await Promise.race([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timed out')), 5000)
      ),
    ]);

    const { data: profile, error: profileError } = existingProfile;

    if (!profileError && profile) {
      return profile;
    }

    const newProfileResult = await Promise.race([
      supabase
        .from('profiles')
        .insert({
          id: userId,
          username: `Player_${userId.substring(0, 8)}`,
        })
        .select()
        .single(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Profile creation timed out')), 5000)
      ),
    ]);

    const { data: newProfile, error: createError } = newProfileResult;

    if (createError) {
      console.error('Failed to create profile:', createError);
      return null;
    }

    return newProfile;
  } catch (error) {
    console.error('Profile operation failed:', error);
    return null;
  }
}

async function resolveEmailForSignIn(identifier: string): Promise<string | null> {
  const normalized = identifier.trim();
  if (!normalized) return null;

  // If it looks like an email, use it directly
  if (normalized.includes('@')) {
    return normalized;
  }

  // Resolve username to email via direct REST call to the RPC endpoint.
  // We bypass the Supabase JS client to avoid its internal initialization deadlock.
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_login_email_for_username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ p_username: normalized }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('Username lookup failed with status:', response.status);
      return normalized; // Fall back to treating identifier as email
    }

    const data = await response.json();

    if (typeof data === 'string' && data.length > 0) {
      return data;
    }

    // Username not found in database
    return null;
  } catch (e) {
    console.warn('Username lookup exception:', e);
    // On any error, treat identifier as a potential email
    return normalized;
  }
}

/**
 * Sign up a new user with email and password
 */
export async function signUp(data: SignUpData): Promise<AuthResult> {
  try {
    // Create auth user with timeout
    const signUpResult = await Promise.race([
      supabase.auth.signUp({
        email: data.email,
        password: data.password,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Sign up request timed out. Please check your connection and try again.')), 10000)
      ),
    ]);

    const { data: authData, error: authError } = signUpResult;

    if (authError) {
      return { success: false, error: normalizeAuthError(authError.message) };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' };
    }

    // When email confirmation is enabled, Supabase creates the user but no
    // authenticated session is returned yet. In that case, avoid profile calls
    // blocked by RLS and prompt user to verify email first.
    if (!authData.session) {
      return {
        success: true,
        requiresEmailConfirmation: true,
      };
    }

    // Update username if provided
    if (data.username) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: data.username })
        .eq('id', authData.user.id);

      if (updateError) {
        console.error('Failed to update username:', updateError);
      }
    }

    const profile = await fetchOrCreateProfile(authData.user.id);
    if (!profile) {
      return {
        success: false,
        error: 'Account created, but profile setup failed. Please try signing in.',
      };
    }

    return { success: true, profile };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Sign in existing user with email and password.
 * Uses direct fetch to Supabase Auth API to avoid internal client deadlocks.
 */
export async function signIn(data: SignInData): Promise<AuthResult> {
  try {
    const email = await resolveEmailForSignIn(data.identifier);

    if (!email) {
      return { success: false, error: 'No account found with that username. Try your email instead.' };
    }

    // Direct fetch to Supabase Auth API — bypasses the JS client's internal
    // initialization/lock machinery which can deadlock after a timed-out getSession().
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(
        `${supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
          },
          body: JSON.stringify({ email, password: data.password }),
          signal: controller.signal,
        },
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return { success: false, error: 'Sign in request timed out. Please check your connection and try again.' };
      }
      return { success: false, error: 'Network error. Please check your connection.' };
    }
    clearTimeout(timeoutId);

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return { success: false, error: normalizeAuthError(tokenData.msg || tokenData.error_description || 'Sign in failed.') };
    }

    console.log('[SIGNIN] Auth token received, setting session...');

    // Set session on the Supabase client (with timeout — this can deadlock).
    // Fire-and-forget with a 3s grace period; don't let it block sign-in.
    try {
      await Promise.race([
        supabase.auth.setSession({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
        }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch (setError) {
      console.warn('setSession failed (non-fatal):', setError);
    }

    const userId = tokenData.user?.id;
    if (!userId) {
      return { success: false, error: 'Login succeeded but no user ID returned.' };
    }

    console.log('[SIGNIN] Loading profile for user:', userId);

    // Fetch profile with direct REST call to avoid Supabase client deadlock
    let profile: Profile | null = null;
    try {
      const profileController = new AbortController();
      const profileTimeoutId = setTimeout(() => profileController.abort(), 5000);

      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
          signal: profileController.signal,
        },
      );
      clearTimeout(profileTimeoutId);

      if (profileResponse.ok) {
        const profiles = await profileResponse.json();
        if (profiles.length > 0) {
          profile = profiles[0];
        }
      }
    } catch (profileError) {
      console.warn('Direct profile fetch failed:', profileError);
    }

    // Fallback to Supabase client if direct fetch didn't work
    if (!profile) {
      try {
        profile = await Promise.race([
          fetchOrCreateProfile(userId),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
      } catch {
        console.warn('fetchOrCreateProfile fallback also failed');
      }
    }

    if (!profile) {
      return { success: false, error: 'Failed to load profile. Please try again.' };
    }

    console.log('[SIGNIN] Sign-in complete!');
    return { success: true, profile };
  } catch (error) {
    console.error('[SIGNIN] Unexpected error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Sign in with Google OAuth (redirects to Google, then back to app)
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Page will redirect to Google — this return is only reached if something went wrong
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Sign in with magic link (email only, passwordless)
 */
export async function signInWithMagicLink(email: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get current user's profile
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error getting profile:', error);
    return null;
  }
}

/**
 * Update user's username
 */
export async function updateUsername(newUsername: string): Promise<AuthResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername })
      .eq('id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Delete user account (self-serve)
 * Cascades to profile, inventory, progress, etc.
 */
export async function deleteAccount(): Promise<AuthResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Delete auth user (cascades to all related tables via ON DELETE CASCADE)
    const { error } = await supabase.auth.admin.deleteUser(user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    // Sign out
    await supabase.auth.signOut();

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (profile: Profile | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      const profile = await getCurrentProfile();
      callback(profile);
    } else if (event === 'SIGNED_OUT') {
      callback(null);
    }
  });
}
