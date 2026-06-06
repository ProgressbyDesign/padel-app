import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://uebhforyugmvpqvkzrbt.supabase.co";

/** Server-only Supabase client with service role (bypasses RLS for admin writes). */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin operations. Add it to .env.local (server only)."
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
