import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase access for the Research module.
 *
 * The retired portal ran under Supabase-Auth + RLS and distinguished a public
 * (anon) client from a service-role ("admin") client. The Engagement app does
 * NOT rely on RLS — every DB/Storage read and write goes through the service
 * role key, and access is gated by the app's own JWT session (in middleware and
 * in each route handler / server action). To keep the ported research code
 * unchanged we expose the two original entry points, but both return the same
 * service-role client. This is safe: the public research reads only ever query
 * `status = 'published'`, so no draft or privileged row is exposed, and the
 * client is never imported into browser code.
 *
 * Uses the same env vars as the rest of the app: SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_* keys are introduced).
 */
let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** Service-role client — used for every research read and write. */
export function getSupabaseAdmin(): SupabaseClient {
  return client();
}

/**
 * Historically the "public read" client. Under this app's no-RLS model it is
 * the same service-role client; callers restrict to published rows themselves.
 */
export function getSupabaseServerClient(): SupabaseClient {
  return client();
}
