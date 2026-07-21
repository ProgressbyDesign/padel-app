import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sortVenueSocials,
  type VenueSocialRow,
} from "@/lib/venueSocials";

export async function loadVenueSocials(
  supabase: SupabaseClient,
  venueId: string
): Promise<VenueSocialRow[] | null> {
  const { data, error } = await supabase
    .from("venue_socials")
    .select("id, venue_id, platform, url, is_primary, created_at")
    .eq("venue_id", venueId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) return null;
  return sortVenueSocials((data ?? []) as VenueSocialRow[]);
}
