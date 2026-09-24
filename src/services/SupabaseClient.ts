/**
 * Supabase Client Configuration
 * Provides centralized access to Supabase auth and database
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/** Missing legacy cloud configuration must not prevent local guest play. */
export const isCloudAuthConfigured = (() => {
  try {
    const url = new URL(SUPABASE_URL);
    return ['https:', 'http:'].includes(url.protocol) && Boolean(SUPABASE_ANON_KEY);
  } catch { return false; }
})();

let cloudClient: SupabaseClient | null = null;
function getCloudClient(): SupabaseClient {
  if (!isCloudAuthConfigured) {
    throw new Error('Cloud accounts are unavailable in this build. Continue as a guest.');
  }
  if (!cloudClient) {
    cloudClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        lock: async (_name, _timeout, fn) => await fn(),
      },
    });
  }
  return cloudClient;
}

/** Lazy compatibility facade: never fabricates credentials or successful writes. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getCloudClient();
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

/**
 * Get the current authenticated user (with timeout to prevent deadlocks)
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isCloudAuthConfigured) return null;
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { user: null } }), 3000)
      ),
    ]);
    return result.data.user;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}
