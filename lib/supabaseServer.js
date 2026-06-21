import { createClient } from "@supabase/supabase-js";

// Server-only client using the service role key. Never import this into a
// component that runs in the browser. All DB access goes through API routes,
// which are gated by our own JWT session — so RLS is not relied upon here.
let _client = null;

export function getSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
