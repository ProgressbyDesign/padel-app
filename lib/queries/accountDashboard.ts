import "server-only";

import { requireAuthenticatedAccount } from "@/lib/auth/session";
import type { MembershipRole } from "@/lib/auth/types";
import {
  ACTIVE_APPLICATION_STATUSES,
  type CoachApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import {
  buildCoachCompletion,
  buildVenueCompletion,
} from "@/lib/coachProfileCompletion";
import { getStructuredOpeningHours } from "@/lib/openingHours";
import { coachHasLivePublicAvailability } from "@/lib/queries/coachAvailability";
import { loadBookingAttention } from "@/lib/queries/coachBookings";
import { createClient } from "@/lib/supabase/server";
import {
  isAccountJourney,
  type AccountJourney,
} from "@/lib/lifecycle/constants";
import type { VenueApplicationStatus } from "@/lib/venueProfileApplication/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

const ACTIVE_VENUE_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
] as const satisfies readonly VenueApplicationStatus[];

type ProfileRow = {
  full_name: string | null;
  account_journey: string | null;
};

type CoachSummary = {
  id: string;
  name: string | null;
  slug: string | null;
  role: string | null;
  image_url: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  experience_years: number | null;
  price_from: number | null;
  is_approved: boolean | null;
};

type VenueSummary = {
  id: string;
  name: string | null;
  city: string | null;
  country: string | null;
  image_url: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  courts: number | null;
  court_type: string | null;
  venue_type: string | null;
  coaching_description: string | null;
  opening_hours_structured: unknown;
  is_approved: boolean | null;
};

type CoachMembershipRow = {
  coach_id: string;
  membership_role: MembershipRole;
  coaches: CoachSummary | CoachSummary[] | null;
};

type VenueMembershipRow = {
  venue_id: string;
  membership_role: MembershipRole;
  venues: VenueSummary | VenueSummary[] | null;
};

export type ManagedCoach = {
  id: string;
  name: string;
  slug: string | null;
  membershipRole: MembershipRole;
  imageUrl: string | null;
  role: string | null;
  location: string | null;
  completionPercent: number;
  availabilityStatus: "live" | "private" | "none";
  pendingBookingCount: number;
};

export type ManagedVenue = {
  id: string;
  name: string;
  location: string;
  membershipRole: MembershipRole;
  imageUrl: string | null;
  completionPercent: number;
  activeCoachCount: number;
};

export type AccountCoachApplicationSummary = {
  id: string;
  status: CoachApplicationStatus;
  currentStep: number;
  submittedAt: string | null;
  updatedAt: string;
  reviewNote: string | null;
  coachId: string | null;
} | null;

export type AccountVenueApplicationSummary = {
  id: string;
  status: VenueApplicationStatus;
  currentStep: number;
  submittedAt: string | null;
  updatedAt: string;
  reviewNote: string | null;
  approvedVenueId: string | null;
} | null;

export type AccountRelationshipAttention = {
  venueInvitations: number;
  coachRequests: number;
  items: Array<{
    kind: "coach" | "venue";
    entityId: string;
    entityName: string;
    count: number;
    href: string;
    message: string;
  }>;
};

export type AccountBookingAttention = {
  playerAwaiting: number;
  playerAcceptedUpcoming: number;
  coachNewRequests: Array<{ coachId: string; coachName: string; count: number }>;
  coachAcceptedUpcoming: Array<{
    coachId: string;
    coachName: string;
    count: number;
  }>;
};

export type AccountDashboardData = {
  account: {
    id: string;
    email: string;
    fullName: string | null;
  };
  /** UX hint only — never used as an authorization mechanism. */
  accountJourney: AccountJourney;
  coaches: ManagedCoach[];
  venues: ManagedVenue[];
  coachApplication: AccountCoachApplicationSummary;
  venueApplication: AccountVenueApplicationSummary;
  relationshipAttention: AccountRelationshipAttention;
  bookingAttention: AccountBookingAttention;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function locationLabel(
  city: string | null | undefined,
  country: string | null | undefined
): string {
  return [city, country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

function countByKey(
  rows: Array<{ [key: string]: unknown }> | null | undefined,
  key: string
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    const id = String(row[key] ?? "");
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

async function enrichManagedCoaches(
  supabase: SupabaseClient,
  baseCoaches: Array<{
    id: string;
    name: string;
    slug: string | null;
    membershipRole: MembershipRole;
    role: string | null;
    imageUrl: string | null;
    email: string | null;
    phone: string | null;
    description: string | null;
    experienceYears: number | null;
    priceFrom: number | null;
    isApproved: boolean | null;
  }>
): Promise<ManagedCoach[]> {
  if (baseCoaches.length === 0) return [];

  const coachIds = baseCoaches.map((coach) => coach.id);
  const nowIso = new Date().toISOString();

  const [
    locationsResult,
    imagesResult,
    socialsResult,
    venuesResult,
    achievementsResult,
    attributesResult,
    outcomesResult,
    bookingsResult,
    availabilityResults,
  ] = await Promise.all([
    supabase
      .from("coach_locations")
      .select("coach_id, city, country, is_primary")
      .in("coach_id", coachIds),
    supabase.from("coach_images").select("coach_id").in("coach_id", coachIds),
    supabase.from("coach_socials").select("coach_id").in("coach_id", coachIds),
    supabase
      .from("coach_venues")
      .select("id, coach_id, is_primary, venues ( city, country )")
      .in("coach_id", coachIds)
      .eq("status", "active"),
    supabase
      .from("coach_achievements")
      .select("coach_id")
      .in("coach_id", coachIds),
    supabase
      .from("coach_attributes")
      .select("coach_id, audience_adults, audience_juniors, player_levels")
      .in("coach_id", coachIds),
    supabase
      .from("coach_outcomes")
      .select("coach_id, outcome, outcome_key")
      .in("coach_id", coachIds),
    supabase
      .from("coach_booking_requests")
      .select("coach_id")
      .in("coach_id", coachIds)
      .eq("status", "requested")
      .gte("starts_at", nowIso),
    Promise.all(
      coachIds.map((coachId) => coachHasLivePublicAvailability(coachId))
    ),
  ]);

  const locationByCoach = new Map<string, string>();
  const hasPrimaryLocationByCoach = new Map<string, boolean>();
  const locationRows = (locationsResult.data ?? []) as Array<{
    coach_id: string;
    city: string | null;
    country: string | null;
    is_primary: boolean | null;
  }>;

  for (const coachId of coachIds) {
    const rows = locationRows.filter((row) => String(row.coach_id) === coachId);
    hasPrimaryLocationByCoach.set(
      coachId,
      rows.some((row) => row.is_primary) || rows.length > 0
    );
    const ordered = [...rows].sort(
      (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
    );
    for (const row of ordered) {
      const label = locationLabel(row.city, row.country);
      if (label) {
        locationByCoach.set(coachId, label);
        break;
      }
    }
  }

  const venueRows = (venuesResult.data ?? []) as Array<{
    id: string;
    coach_id: string;
    is_primary: boolean | null;
    venues:
      | { city: string | null; country: string | null }
      | { city: string | null; country: string | null }[]
      | null;
  }>;

  for (const coachId of coachIds) {
    if (locationByCoach.has(coachId)) continue;
    const links = venueRows
      .filter((row) => String(row.coach_id) === coachId)
      .sort(
        (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
      );
    for (const link of links) {
      const venue = one(link.venues);
      const label = locationLabel(venue?.city, venue?.country);
      if (label) {
        locationByCoach.set(coachId, label);
        break;
      }
    }
  }

  const imageCountByCoach = countByKey(imagesResult.data, "coach_id");
  const socialCountByCoach = countByKey(socialsResult.data, "coach_id");
  const achievementCountByCoach = countByKey(
    achievementsResult.data,
    "coach_id"
  );
  const pendingByCoach = countByKey(bookingsResult.data, "coach_id");
  const venueCountByCoach = countByKey(venueRows, "coach_id");

  const attributesByCoach = new Map<
    string,
    {
      audienceAdults: boolean;
      audienceJuniors: boolean;
      playerLevels: string[];
    }
  >();
  for (const row of (attributesResult.data ?? []) as Array<{
    coach_id: string;
    audience_adults: boolean | null;
    audience_juniors: boolean | null;
    player_levels: unknown;
  }>) {
    attributesByCoach.set(String(row.coach_id), {
      audienceAdults: Boolean(row.audience_adults),
      audienceJuniors: Boolean(row.audience_juniors),
      playerLevels: Array.isArray(row.player_levels)
        ? (row.player_levels as string[])
        : [],
    });
  }

  const outcomesByCoach = new Map<string, string[]>();
  for (const row of (outcomesResult.data ?? []) as Array<{
    coach_id: string;
    outcome: string | null;
    outcome_key: string | null;
  }>) {
    const id = String(row.coach_id);
    const list = outcomesByCoach.get(id) ?? [];
    list.push(
      (row.outcome_key ? String(row.outcome_key) : null) ||
        String(row.outcome ?? "")
    );
    outcomesByCoach.set(id, list);
  }

  const relationshipIds = venueRows.map((row) => String(row.id));
  const pricingByCoach = new Map<string, boolean>();
  if (relationshipIds.length > 0) {
    const { data: pricingRows } = await supabase
      .from("coach_venue_availability_settings")
      .select("coach_venue_id, currency, default_hourly_rate_minor")
      .in("coach_venue_id", relationshipIds);

    const relationshipCoach = new Map(
      venueRows.map((row) => [String(row.id), String(row.coach_id)] as const)
    );
    for (const row of (pricingRows ?? []) as Array<{
      coach_venue_id: string;
      currency: string | null;
      default_hourly_rate_minor: number | null;
    }>) {
      const configured =
        Boolean(typeof row.currency === "string" && row.currency.trim()) &&
        row.default_hourly_rate_minor != null;
      if (!configured) continue;
      const coachId = relationshipCoach.get(String(row.coach_venue_id));
      if (coachId) pricingByCoach.set(coachId, true);
    }
  }

  const availabilityByCoach = new Map(
    coachIds.map((coachId, index) => [coachId, availabilityResults[index]] as const)
  );

  return baseCoaches.map((coach) => {
    const attributes = attributesByCoach.get(coach.id) ?? {
      audienceAdults: false,
      audienceJuniors: false,
      playerLevels: [],
    };
    const availability = availabilityByCoach.get(coach.id) ?? {
      status: "none" as const,
      nextSlotStartsAt: null,
    };
    const completion = buildCoachCompletion(coach.id, {
      name: coach.name,
      role: coach.role,
      description: coach.description,
      experience_years: coach.experienceYears,
      phone: coach.phone,
      email: coach.email,
      price_from: coach.priceFrom,
      image_url: coach.imageUrl,
      is_approved: coach.isApproved,
      hasPrimaryLocation: hasPrimaryLocationByCoach.get(coach.id) ?? false,
      audienceAdults: attributes.audienceAdults,
      audienceJuniors: attributes.audienceJuniors,
      playerLevels: attributes.playerLevels,
      outcomes: (outcomesByCoach.get(coach.id) ?? []).filter(Boolean),
      imageCount: imageCountByCoach.get(coach.id) ?? 0,
      socialCount: socialCountByCoach.get(coach.id) ?? 0,
      achievementCount: achievementCountByCoach.get(coach.id) ?? 0,
      activeVenueCount: venueCountByCoach.get(coach.id) ?? 0,
      availabilityLive: availability.status === "live",
      pricingConfigured: pricingByCoach.get(coach.id) ?? false,
      hasFutureSession: Boolean(availability.nextSlotStartsAt),
      pendingBookingCount: pendingByCoach.get(coach.id) ?? 0,
    });

    return {
      id: coach.id,
      name: coach.name,
      slug: coach.slug,
      membershipRole: coach.membershipRole,
      imageUrl: coach.imageUrl,
      role: coach.role,
      location: locationByCoach.get(coach.id) ?? null,
      completionPercent: completion.overallPercent,
      availabilityStatus: availability.status,
      pendingBookingCount: pendingByCoach.get(coach.id) ?? 0,
    };
  });
}

async function enrichManagedVenues(
  supabase: SupabaseClient,
  baseVenues: Array<{
    id: string;
    name: string;
    location: string;
    membershipRole: MembershipRole;
    imageUrl: string | null;
    city: string | null;
    country: string | null;
    address: string | null;
    website: string | null;
    phone: string | null;
    courts: number | null;
    courtType: string | null;
    venueType: string | null;
    coachingDescription: string | null;
    openingHoursStructured: unknown;
    isApproved: boolean | null;
  }>
): Promise<ManagedVenue[]> {
  if (baseVenues.length === 0) return [];

  const venueIds = baseVenues.map((venue) => venue.id);

  const [imagesResult, socialsResult, coachesResult] = await Promise.all([
    supabase.from("venue_images").select("venue_id").in("venue_id", venueIds),
    supabase.from("venue_socials").select("venue_id").in("venue_id", venueIds),
    supabase
      .from("coach_venues")
      .select("id, venue_id")
      .in("venue_id", venueIds)
      .eq("status", "active"),
  ]);

  const imageCountByVenue = countByKey(imagesResult.data, "venue_id");
  const socialCountByVenue = countByKey(socialsResult.data, "venue_id");
  const coachRows = (coachesResult.data ?? []) as Array<{
    id: string;
    venue_id: string;
  }>;
  const coachCountByVenue = countByKey(coachRows, "venue_id");

  const relationshipIds = coachRows.map((row) => String(row.id));
  const hasAvailabilityByVenue = new Map<string, boolean>();
  if (relationshipIds.length > 0) {
    const { data: settings } = await supabase
      .from("coach_venue_availability_settings")
      .select("coach_venue_id")
      .in("coach_venue_id", relationshipIds)
      .eq("is_public", true);

    const relationshipVenue = new Map(
      coachRows.map((row) => [String(row.id), String(row.venue_id)] as const)
    );
    for (const row of (settings ?? []) as Array<{ coach_venue_id: string }>) {
      const venueId = relationshipVenue.get(String(row.coach_venue_id));
      if (venueId) hasAvailabilityByVenue.set(venueId, true);
    }
  }

  return baseVenues.map((venue) => {
    const imageCount = imageCountByVenue.get(venue.id) ?? 0;
    const activeCoachCount = coachCountByVenue.get(venue.id) ?? 0;
    const completion = buildVenueCompletion(venue.id, {
      name: venue.name,
      city: venue.city,
      country: venue.country,
      address: venue.address,
      website: venue.website,
      phone: venue.phone,
      courts: venue.courts,
      courtType: venue.courtType,
      venueType: venue.venueType,
      hasOpeningHours: Boolean(
        getStructuredOpeningHours(venue.openingHoursStructured)
      ),
      imageCount: imageCount > 0 || Boolean(venue.imageUrl) ? Math.max(imageCount, 1) : 0,
      socialCount: socialCountByVenue.get(venue.id) ?? 0,
      hasCoachingDescription: Boolean(venue.coachingDescription?.trim()),
      activeCoachCount,
      hasCoachAvailability: hasAvailabilityByVenue.get(venue.id) ?? false,
      isVerified: Boolean(venue.isApproved),
    });

    return {
      id: venue.id,
      name: venue.name,
      location: venue.location,
      membershipRole: venue.membershipRole,
      imageUrl: venue.imageUrl,
      completionPercent: completion.overallPercent,
      activeCoachCount,
    };
  });
}

export async function loadAccountDashboard(): Promise<AccountDashboardData> {
  const account = await requireAuthenticatedAccount("/account/personal");
  const supabase = await createClient();

  const [
    profileResult,
    coachResult,
    venueResult,
    coachApplicationResult,
    venueApplicationResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, account_journey")
      .eq("id", account.id)
      .maybeSingle(),
    supabase
      .from("coach_memberships")
      .select(
        `
        coach_id,
        membership_role,
        coaches (
          id,
          name,
          slug,
          role,
          image_url,
          email,
          phone,
          description,
          experience_years,
          price_from,
          is_approved
        )
      `
      )
      .eq("user_id", account.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("venue_memberships")
      .select(
        `
        venue_id,
        membership_role,
        venues (
          id,
          name,
          city,
          country,
          image_url,
          address,
          website,
          phone,
          courts,
          court_type,
          venue_type,
          coaching_description,
          opening_hours_structured,
          is_approved
        )
      `
      )
      .eq("user_id", account.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("coach_profile_applications")
      .select(
        "id, status, current_step, submitted_at, updated_at, review_note, coach_id"
      )
      .eq("user_id", account.id)
      .in("status", [...ACTIVE_APPLICATION_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("venue_profile_applications")
      .select(
        "id, status, current_step, submitted_at, updated_at, review_note, approved_venue_id"
      )
      .eq("user_id", account.id)
      .in("status", [...ACTIVE_VENUE_APPLICATION_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[account] profile:", profileResult.error.message);
    }
    throw new Error("Unable to load account profile.");
  }
  if (coachResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[account] coach memberships:", coachResult.error.message);
    }
    throw new Error("Unable to load coach memberships.");
  }
  if (venueResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[account] venue memberships:", venueResult.error.message);
    }
    throw new Error("Unable to load venue memberships.");
  }
  if (coachApplicationResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[account] coach application:",
        coachApplicationResult.error.message
      );
    }
    throw new Error("Unable to load coach application.");
  }
  if (venueApplicationResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[account] venue application:",
        venueApplicationResult.error.message
      );
    }
    throw new Error("Unable to load venue application.");
  }

  const profile = profileResult.data as ProfileRow | null;
  const journeyValue = profile?.account_journey;
  const accountJourney = isAccountJourney(journeyValue)
    ? journeyValue
    : "player";
  const coachMemberships = (coachResult.data ??
    []) as unknown as CoachMembershipRow[];
  const venueMemberships = (venueResult.data ??
    []) as unknown as VenueMembershipRow[];

  const baseCoaches = coachMemberships.map((membership) => {
    const coach = one(membership.coaches);
    return {
      id: coach?.id ?? membership.coach_id,
      name: coach?.name?.trim() || "Coach profile",
      slug: coach?.slug?.trim() || null,
      membershipRole: membership.membership_role,
      role: coach?.role?.trim() || null,
      imageUrl: coach?.image_url?.trim() || null,
      email: coach?.email ?? null,
      phone: coach?.phone ?? null,
      description: coach?.description ?? null,
      experienceYears: coach?.experience_years ?? null,
      priceFrom: coach?.price_from ?? null,
      isApproved: coach?.is_approved ?? null,
    };
  });

  const baseVenues = venueMemberships.map((membership) => {
    const venue = one(membership.venues);
    return {
      id: venue?.id ?? membership.venue_id,
      name: venue?.name?.trim() || "Venue",
      location: locationLabel(venue?.city, venue?.country),
      membershipRole: membership.membership_role,
      imageUrl: venue?.image_url?.trim() || null,
      city: venue?.city ?? null,
      country: venue?.country ?? null,
      address: venue?.address ?? null,
      website: venue?.website ?? null,
      phone: venue?.phone ?? null,
      courts: venue?.courts ?? null,
      courtType: venue?.court_type ?? null,
      venueType: venue?.venue_type ?? null,
      coachingDescription: venue?.coaching_description ?? null,
      openingHoursStructured: venue?.opening_hours_structured ?? null,
      isApproved: venue?.is_approved ?? null,
    };
  });

  const [coaches, venues] = await Promise.all([
    enrichManagedCoaches(supabase, baseCoaches),
    enrichManagedVenues(supabase, baseVenues),
  ]);

  const coachApplicationRow = coachApplicationResult.data as {
    id: string;
    status: CoachApplicationStatus;
    current_step: number;
    submitted_at: string | null;
    updated_at: string;
    review_note: string | null;
    coach_id: string | null;
  } | null;
  const venueApplicationRow = venueApplicationResult.data as {
    id: string;
    status: VenueApplicationStatus;
    current_step: number;
    submitted_at: string | null;
    updated_at: string;
    review_note: string | null;
    approved_venue_id: string | null;
  } | null;

  const coachIds = coaches.map((coach) => coach.id);
  const venueIds = venues.map((venue) => venue.id);
  const relationshipAttention: AccountRelationshipAttention = {
    venueInvitations: 0,
    coachRequests: 0,
    items: [],
  };

  if (coachIds.length > 0 || venueIds.length > 0) {
    const [coachPendingResult, venuePendingResult] = await Promise.all([
      coachIds.length > 0
        ? supabase
            .from("coach_venues")
            .select("id, coach_id")
            .in("coach_id", coachIds)
            .eq("status", "pending")
            .eq("initiated_by", "venue")
        : Promise.resolve({ data: [], error: null }),
      venueIds.length > 0
        ? supabase
            .from("coach_venues")
            .select("id, venue_id")
            .in("venue_id", venueIds)
            .eq("status", "pending")
            .eq("initiated_by", "coach")
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (coachPendingResult.error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[account] venue invitations:",
          coachPendingResult.error.message
        );
      }
      throw new Error("Unable to load venue invitations.");
    }
    if (venuePendingResult.error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[account] coach requests:",
          venuePendingResult.error.message
        );
      }
      throw new Error("Unable to load coach requests.");
    }

    const invitationsByCoach = new Map<string, number>();
    for (const row of coachPendingResult.data ?? []) {
      const id = String(row.coach_id);
      invitationsByCoach.set(id, (invitationsByCoach.get(id) ?? 0) + 1);
    }
    const requestsByVenue = new Map<string, number>();
    for (const row of venuePendingResult.data ?? []) {
      const id = String(row.venue_id);
      requestsByVenue.set(id, (requestsByVenue.get(id) ?? 0) + 1);
    }

    for (const coach of coaches) {
      const count = invitationsByCoach.get(coach.id) ?? 0;
      if (count <= 0) continue;
      relationshipAttention.venueInvitations += count;
      relationshipAttention.items.push({
        kind: "coach",
        entityId: coach.id,
        entityName: coach.name,
        count,
        href: `/account/coaches/${encodeURIComponent(coach.id)}/venues`,
        message:
          count === 1
            ? "1 venue invitation awaiting your response"
            : `${count} venue invitations awaiting your response`,
      });
    }

    for (const venue of venues) {
      const count = requestsByVenue.get(venue.id) ?? 0;
      if (count <= 0) continue;
      relationshipAttention.coachRequests += count;
      relationshipAttention.items.push({
        kind: "venue",
        entityId: venue.id,
        entityName: venue.name,
        count,
        href: `/account/venues/${encodeURIComponent(venue.id)}/coaches`,
        message:
          count === 1
            ? "1 coach request awaiting venue review"
            : `${count} coach requests awaiting venue review`,
      });
    }
  }

  const bookingAttentionRaw = await loadBookingAttention(account.id);
  const bookingAttention: AccountBookingAttention = {
    playerAwaiting: bookingAttentionRaw.playerAwaiting,
    playerAcceptedUpcoming: bookingAttentionRaw.playerAcceptedUpcoming,
    coachNewRequests: bookingAttentionRaw.coachNewRequests,
    coachAcceptedUpcoming: bookingAttentionRaw.coachAcceptedUpcoming,
  };

  return {
    account: {
      id: account.id,
      email: account.email,
      fullName: profile?.full_name?.trim() || null,
    },
    accountJourney,
    coaches,
    venues,
    coachApplication: coachApplicationRow
      ? {
          id: coachApplicationRow.id,
          status: coachApplicationRow.status,
          currentStep: coachApplicationRow.current_step,
          submittedAt: coachApplicationRow.submitted_at,
          updatedAt: coachApplicationRow.updated_at,
          reviewNote: coachApplicationRow.review_note,
          coachId: coachApplicationRow.coach_id,
        }
      : null,
    venueApplication: venueApplicationRow
      ? {
          id: venueApplicationRow.id,
          status: venueApplicationRow.status,
          currentStep: venueApplicationRow.current_step,
          submittedAt: venueApplicationRow.submitted_at,
          updatedAt: venueApplicationRow.updated_at,
          reviewNote: venueApplicationRow.review_note,
          approvedVenueId: venueApplicationRow.approved_venue_id,
        }
      : null,
    relationshipAttention,
    bookingAttention,
  };
}
