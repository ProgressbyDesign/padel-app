import "server-only";

import { cache } from "react";
import { requireAuthenticatedAccount } from "@/lib/auth/session";
import type { MembershipRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

export function isValidCoachId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export type ManagedCoachShell = {
  id: string;
  name: string | null;
  role: string | null;
  is_approved: boolean | null;
  data_quality_status: string | null;
  membershipRole: MembershipRole;
  primaryLocation: string | null;
};

export const loadManagedCoachShell = cache(
  async (coachId: string): Promise<ManagedCoachShell | null> => {
    if (!isValidCoachId(coachId)) return null;

    const account = await requireAuthenticatedAccount(
      `/account/coaches/${encodeURIComponent(coachId)}`
    );
    const supabase = await createClient();

    const { data: membership, error: membershipError } = await supabase
      .from("coach_memberships")
      .select("membership_role")
      .eq("coach_id", coachId)
      .eq("user_id", account.id)
      .maybeSingle();

    if (membershipError || !membership) return null;

    const { data: coach, error: coachError } = await supabase
      .from("coaches")
      .select("id, name, role, is_approved, data_quality_status")
      .eq("id", coachId)
      .maybeSingle();

    if (coachError || !coach) return null;

    const { data: coachLocations } = await supabase
      .from("coach_locations")
      .select("city, country, is_primary")
      .eq("coach_id", coachId)
      .order("is_primary", { ascending: false })
      .limit(5);

    let primaryLocation: string | null = null;
    for (const location of coachLocations ?? []) {
      const label = [location.city, location.country]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(", ");
      if (label) {
        primaryLocation = label;
        break;
      }
    }

    if (!primaryLocation) {
      const { data: venueLinks } = await supabase
        .from("coach_venues")
        .select("is_primary, venues ( city, country )")
        .eq("coach_id", coachId)
        .in("status", ["active", "unverified"])
        .order("is_primary", { ascending: false })
        .limit(5);

      for (const link of venueLinks ?? []) {
        const venues = link.venues as
          | { city: string | null; country: string | null }
          | { city: string | null; country: string | null }[]
          | null;
        const venue = Array.isArray(venues) ? venues[0] : venues;
        const location = [venue?.city, venue?.country]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(", ");
        if (location) {
          primaryLocation = location;
          break;
        }
      }
    }

    return {
      id: coach.id as string,
      name: coach.name,
      role: coach.role,
      is_approved: coach.is_approved,
      data_quality_status: coach.data_quality_status,
      membershipRole: membership.membership_role as MembershipRole,
      primaryLocation,
    };
  }
);
