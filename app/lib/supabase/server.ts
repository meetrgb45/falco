import "server-only";
import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Read-only client using anon key — safe for server components. */
export function getReadSupabase() {
  return createClient(url, anon, { auth: { persistSession: false } });
}

/** Write client using service role key — indexer only. */
export function getWriteSupabase() {
  return createClient(url, service, { auth: { persistSession: false } });
}
