import "server-only";

import { cache } from "react";
import { requireAuthenticatedAccount } from "@/lib/auth/session";
import type { MembershipRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

export function isValidVenueId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export type ManagedVenueShell = {
  id: string;
  name: string | null;
  city: string | null;
  country: string | null;
  is_approved: boolean | null;
  data_quality_status: string | null;
  membershipRole: MembershipRole;
};

/**
 * Request-scoped venue shell for the management layout.
 * Uses React cache() so layout + pages share one membership/venue fetch per request.
 */
export const loadManagedVenueShell = cache(
  async (venueId: string): Promise<ManagedVenueShell | null> => {
    if (!isValidVenueId(venueId)) return null;

    const account = await requireAuthenticatedAccount(
      `/account/venues/${encodeURIComponent(venueId)}`
    );
    const supabase = await createClient();

    const { data: membership, error: membershipError } = await supabase
      .from("venue_memberships")
      .select("membership_role")
      .eq("venue_id", venueId)
      .eq("user_id", account.id)
      .maybeSingle();

    if (membershipError || !membership) return null;

    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("id, name, city, country, is_approved, data_quality_status")
      .eq("id", venueId)
      .maybeSingle();

    if (venueError || !venue) return null;

    return {
      id: venue.id as string,
      name: venue.name,
      city: venue.city,
      country: venue.country,
      is_approved: venue.is_approved,
      data_quality_status: venue.data_quality_status,
      membershipRole: membership.membership_role as MembershipRole,
    };
  }
);
