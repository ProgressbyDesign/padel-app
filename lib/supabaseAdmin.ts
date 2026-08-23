import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://uebhforyugmvpqvkzrbt.supabase.co";

/**
 * Server-only service-role client. This is a backend credential, not an
 * admin user's password. Callers must authorize (admin membership / Owner
 * Data Quality access) before using it.
 */
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
