import { createClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://isywkcymfzpgjerfuors.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXdrY3ltZnpwZ2plcmZ1b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQwMzAsImV4cCI6MjEwNjkyMDAzMH0.b7GmU3Bz1zRB7sROsCchnohgZVb6LIyw8v_N_lNLDPs';

export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseAnonKey.includes('your-anon-public-key')
  );
};

/**
 * Remove all Supabase auth session keys from localStorage and sessionStorage.
 * This guarantees that dead or revoked refresh tokens cannot cause recurring 400 POST /token errors.
 */
export const purgeStoredAuthTokens = (): void => {
  if (typeof window === 'undefined') return;

  const storageTargets = [window.localStorage, window.sessionStorage];
  const keysToRemove: { storage: Storage; key: string }[] = [];

  storageTargets.forEach((storage) => {
    if (!storage) return;
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (
          key &&
          (key.startsWith('sb-') ||
            key.includes('auth-token') ||
            key.includes('supabase.auth') ||
            key.includes('refresh_token'))
        ) {
          keysToRemove.push({ storage, key });
        }
      }
    } catch {
      // Ignore cross-origin / security errors
    }
  });

  keysToRemove.forEach(({ storage, key }) => {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore
    }
  });

  try {
    window.dispatchEvent(new CustomEvent('supabase:auth-purged'));
  } catch {
    // Ignore
  }
};

/**
 * Custom fetch wrapper that intercepts 400 Bad Request responses on /auth/v1/token.
 * When Supabase responds with "Invalid Refresh Token: Refresh Token Not Found" or "invalid_grant",
 * this automatically purges the dead token from browser storage so the client stops retrying.
 */
const authSafeFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);

  if (response.status === 400) {
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof Request
        ? input.url
        : String(input);

    if (urlStr.includes('/auth/v1/token')) {
      try {
        const clone = response.clone();
        const text = await clone.text();
        if (
          text.includes('Invalid Refresh Token') ||
          text.includes('refresh_token_not_found') ||
          text.includes('invalid_grant')
        ) {
          console.warn(
            '[Supabase Client] Invalid refresh token rejected by server (400). Purging stale auth storage to prevent retry loops.'
          );
          purgeStoredAuthTokens();
        }
      } catch {
        // Ignore response clone errors
      }
    }
  }

  return response;
};

// Create a singleton Supabase client instance
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: authSafeFetch,
    },
  }
);

