import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client. Used by client components for auth state and
 * tenant-scoped mutations. RLS policies enforce row-level isolation.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
}
