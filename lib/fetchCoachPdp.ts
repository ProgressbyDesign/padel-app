import { createClient } from "./supabase/server";
import {
  rawCoachRowToProfileView,
  type CoachPdpQueryRow,
  type CoachProfileView,
} from "./coachProfileView";
import { COACH_PUBLIC_PROFILES_TABLE, PUBLIC_COACH_SELECT, asPublicRow, type PublicCoachRow } from "./publicProfiles";
import { coachHasDisplayedPublicAvailability } from "./queries/coachAvailability";
import { hydratePublicCoachRows } from "./queries/hydratePublicCoaches";

/**
 * Load a published coach for `/coach/[id]` from the public projection.
 * Child rows are batched separately — the view has no PostgREST FKs.
 * Does not select email, phone, or socials.
 */
export async function fetchCoachPdpById(id: string): Promise<CoachProfileView | null> {
  const supabase = await createClient();
  const availability = await coachHasDisplayedPublicAvailability(id);
  const availabilityLive = availability.status === "live";

  const { data, error } = await supabase
    .from(COACH_PUBLIC_PROFILES_TABLE)
    .select(PUBLIC_COACH_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const core = asPublicRow<PublicCoachRow>(data);
  if (!core) return null;

  const [hydrated] = await hydratePublicCoachRows(
    supabase,
    [core],
    { achievements: true }
  );
  if (!hydrated) return null;

  return rawCoachRowToProfileView(hydrated as CoachPdpQueryRow, { availabilityLive });
}
