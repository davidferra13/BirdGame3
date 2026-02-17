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
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  profile?: Profile;
}

/**
 * Sign up a new user with email and password
 */
export async function signUp(data: SignUpData): Promise<AuthResult> {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' };
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

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      return { success: false, error: 'Profile not found' };
    }

    return { success: true, profile };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Sign in existing user with email and password
 */
export async function signIn(data: SignInData): Promise<AuthResult> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Login failed' };
    }

    // Fetch or create profile
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    // If profile doesn't exist, create it (partial onboarding)
    if (profileError || !profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: `Player_${authData.user.id.substring(0, 8)}`,
        })
        .select()
        .single();

      if (createError) {
        return { success: false, error: 'Failed to create profile' };
      }

      profile = newProfile;
    }

    return { success: true, profile };
  } catch (error) {
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
