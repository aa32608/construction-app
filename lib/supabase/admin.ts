import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/** Server-only client for Auth Admin operations. Never import this in client components. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to the server environment to invite users.');
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
