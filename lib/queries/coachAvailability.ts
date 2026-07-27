import "server-only";

import { dayLabel } from "@/lib/coachAvailability/constants";
import {
  deriveAvailabilitySlots,
  groupSlotsByLocalDate,
} from "@/lib/coachAvailability/slots";
import type {
  AvailabilityException,
  AvailabilityRule,
  AvailabilitySettings,
  AvailabilityVenueSummary,
  DerivedSlot,
  PublicCoachAvailabilityCard,
  PublicVenueAvailabilityGroup,
  VenueCombinedAvailabilityPreviewSlot,
} from "@/lib/coachAvailability/types";
import {
  normalizeTimeHm,
} from "@/lib/coachAvailability/timezone";
import {
  loadAcceptedBlockedRangesForCoach,
  loadRequestedCountsForRelationship,
} from "@/lib/queries/coachBookingBlocks";
import { createClient } from "@/lib/supabase/server";

const SETTINGS_SELECT = `
  coach_venue_id,
  timezone,
  default_slot_duration_minutes,
  is_public,
  currency,
  default_hourly_rate_minor,
  created_at,
  updated_at
`;

const RULE_SELECT = `
  id,
  coach_venue_id,
  day_of_week,
  start_time,
  end_time,
  slot_duration_minutes,
  valid_from,
  valid_until,
  is_active,
  price_override_minor,
  created_at,
  updated_at
`;

const EXCEPTION_SELECT = `
  id,
  coach_venue_id,
  exception_type,
  starts_at,
  ends_at,
  slot_duration_minutes,
  price_override_minor,
  created_at,
  updated_at
`;

function asSettings(row: Record<string, unknown>): AvailabilitySettings {
  return {
    coach_venue_id: String(row.coach_venue_id),
    timezone: String(row.timezone),
    default_slot_duration_minutes: Number(row.default_slot_duration_minutes),
    is_public: Boolean(row.is_public),
    currency: (row.currency as string | null) ?? null,
    default_hourly_rate_minor:
      row.default_hourly_rate_minor == null
        ? null
        : Number(row.default_hourly_rate_minor),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function asRule(row: Record<string, unknown>): AvailabilityRule {
  return {
    id: String(row.id),
    coach_venue_id: String(row.coach_venue_id),
    day_of_week: Number(row.day_of_week),
    start_time: normalizeTimeHm(String(row.start_time)),
    end_time: normalizeTimeHm(String(row.end_time)),
    slot_duration_minutes: Number(row.slot_duration_minutes),
    valid_from: String(row.valid_from),
    valid_until: (row.valid_until as string | null) ?? null,
    is_active: Boolean(row.is_active),
    price_override_minor:
      row.price_override_minor == null
        ? null
        : Number(row.price_override_minor),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function asException(row: Record<string, unknown>): AvailabilityException {
  return {
    id: String(row.id),
    coach_venue_id: String(row.coach_venue_id),
    exception_type: row.exception_type as AvailabilityException["exception_type"],
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    slot_duration_minutes:
      row.slot_duration_minutes == null
        ? null
        : Number(row.slot_duration_minutes),
    price_override_minor:
      row.price_override_minor == null
        ? null
        : Number(row.price_override_minor),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function loadAvailabilitySettings(
  coachVenueId: string
): Promise<AvailabilitySettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_venue_availability_settings")
    .select(SETTINGS_SELECT)
    .eq("coach_venue_id", coachVenueId)
    .maybeSingle();
  if (error || !data) return null;
  return asSettings(data as Record<string, unknown>);
}

export async function loadAvailabilityRules(
  coachVenueId: string
): Promise<AvailabilityRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_availability_rules")
    .select(RULE_SELECT)
    .eq("coach_venue_id", coachVenueId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw new Error(`Unable to load availability rules: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(asRule);
}

export async function loadAvailabilityExceptions(
  coachVenueId: string
): Promise<AvailabilityException[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_availability_exceptions")
    .select(EXCEPTION_SELECT)
    .eq("coach_venue_id", coachVenueId)
    .order("starts_at", { ascending: true });
  if (error) {
    throw new Error(`Unable to load availability exceptions: ${error.message}`);
  }
  return ((data ?? []) as Record<string, unknown>[]).map(asException);
}

export type ActiveCoachVenueForAvailability = {
  relationshipId: string;
  coachId: string;
  venueId: string;
  venueName: string;
  city: string | null;
  country: string | null;
};

export async function loadActiveCoachVenuesForCoach(
  coachId: string
): Promise<ActiveCoachVenueForAvailability[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_venues")
    .select(
      `
      id,
      coach_id,
      venue_id,
      venues ( id, name, city, country )
    `
    )
    .eq("coach_id", coachId)
    .eq("status", "active")
    .order("is_primary", { ascending: false });

  if (error) {
    throw new Error(`Unable to load active venues: ${error.message}`);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const venues = row.venues as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null;
    const venue = Array.isArray(venues) ? venues[0] : venues;
    return {
      relationshipId: String(row.id),
      coachId: String(row.coach_id),
      venueId: String(row.venue_id),
      venueName: String(venue?.name ?? "Venue"),
      city: (venue?.city as string | null) ?? null,
      country: (venue?.country as string | null) ?? null,
    };
  });
}

export async function loadActiveCoachVenueForPair(
  coachId: string,
  relationshipId: string
): Promise<ActiveCoachVenueForAvailability | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_venues")
    .select(
      `
      id,
      coach_id,
      venue_id,
      status,
      venues ( id, name, city, country )
    `
    )
    .eq("id", relationshipId)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (error || !data || data.status !== "active") return null;
  const venues = data.venues as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;
  const venue = Array.isArray(venues) ? venues[0] : venues;
  return {
    relationshipId: String(data.id),
    coachId: String(data.coach_id),
    venueId: String(data.venue_id),
    venueName: String(venue?.name ?? "Venue"),
    city: (venue?.city as string | null) ?? null,
    country: (venue?.country as string | null) ?? null,
  };
}

function weeklySummary(rules: AvailabilityRule[]): string[] {
  const active = rules.filter((rule) => rule.is_active);
  const byDay = new Map<number, string[]>();
  for (const rule of active) {
    const list = byDay.get(rule.day_of_week) ?? [];
    list.push(
      `${normalizeTimeHm(rule.start_time)}–${normalizeTimeHm(rule.end_time)}`
    );
    byDay.set(rule.day_of_week, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([day, windows]) => `${dayLabel(day)} ${windows.join(", ")}`
    );
}

export async function loadCoachAvailabilityOverview(
  coachId: string
): Promise<AvailabilityVenueSummary[]> {
  const venues = await loadActiveCoachVenuesForCoach(coachId);
  if (venues.length === 0) return [];

  const ids = venues.map((venue) => venue.relationshipId);
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [settingsRes, rulesRes, exceptionsRes] = await Promise.all([
    supabase
      .from("coach_venue_availability_settings")
      .select(SETTINGS_SELECT)
      .in("coach_venue_id", ids),
    supabase
      .from("coach_availability_rules")
      .select(RULE_SELECT)
      .in("coach_venue_id", ids),
    supabase
      .from("coach_availability_exceptions")
      .select(EXCEPTION_SELECT)
      .in("coach_venue_id", ids)
      .gte("ends_at", nowIso),
  ]);

  const settingsById = new Map(
    ((settingsRes.data ?? []) as Record<string, unknown>[]).map((row) => {
      const settings = asSettings(row);
      return [settings.coach_venue_id, settings] as const;
    })
  );
  const rulesById = new Map<string, AvailabilityRule[]>();
  for (const row of (rulesRes.data ?? []) as Record<string, unknown>[]) {
    const rule = asRule(row);
    const list = rulesById.get(rule.coach_venue_id) ?? [];
    list.push(rule);
    rulesById.set(rule.coach_venue_id, list);
  }
  const exceptionsById = new Map<string, AvailabilityException[]>();
  for (const row of (exceptionsRes.data ?? []) as Record<string, unknown>[]) {
    const exception = asException(row);
    const list = exceptionsById.get(exception.coach_venue_id) ?? [];
    list.push(exception);
    exceptionsById.set(exception.coach_venue_id, list);
  }

  const now = Date.now();
  const rangeFrom = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const rangeTo = new Date(now + 16 * 24 * 60 * 60 * 1000).toISOString();
  const blockedRanges = await loadAcceptedBlockedRangesForCoach(
    coachId,
    rangeFrom,
    rangeTo
  );

  return venues.map((venue) => {
    const settings = settingsById.get(venue.relationshipId) ?? null;
    const rules = rulesById.get(venue.relationshipId) ?? [];
    const exceptions = exceptionsById.get(venue.relationshipId) ?? [];
    let nextSlotStartsAt: string | null = null;
    if (settings) {
      const slots = deriveAvailabilitySlots({
        settings,
        rules,
        exceptions,
        venueId: venue.venueId,
        venueName: venue.venueName,
        days: 14,
        blockedRanges,
      });
      nextSlotStartsAt = slots[0]?.startsAt ?? null;
    }
    return {
      relationshipId: venue.relationshipId,
      venueId: venue.venueId,
      venueName: venue.venueName,
      city: venue.city,
      country: venue.country,
      settings,
      ruleCount: rules.filter((rule) => rule.is_active).length,
      upcomingExceptionCount: exceptions.length,
      weeklySummary: weeklySummary(rules),
      nextSlotStartsAt,
    };
  });
}

export async function loadAvailabilityEditorBundle(
  coachId: string,
  relationshipId: string
): Promise<{
  venue: ActiveCoachVenueForAvailability;
  settings: AvailabilitySettings | null;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  previewSlots: DerivedSlot[];
  suggestedTimezone: string;
  acceptedRanges: Array<{ startsAt: string; endsAt: string }>;
  requestCounts: Record<string, number>;
} | null> {
  const venue = await loadActiveCoachVenueForPair(coachId, relationshipId);
  if (!venue) return null;

  const [settings, rules, allExceptions] = await Promise.all([
    loadAvailabilitySettings(relationshipId),
    loadAvailabilityRules(relationshipId),
    loadAvailabilityExceptions(relationshipId),
  ]);

  const now = Date.now();
  const rangeFrom = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const rangeTo = new Date(now + 16 * 24 * 60 * 60 * 1000).toISOString();
  const exceptions = allExceptions.filter(
    (exception) => new Date(exception.ends_at).getTime() >= now
  );

  const [acceptedRanges, requestCountMap] = await Promise.all([
    loadAcceptedBlockedRangesForCoach(coachId, rangeFrom, rangeTo),
    loadRequestedCountsForRelationship(relationshipId, rangeFrom, rangeTo),
  ]);

  // Account preview keeps accepted sessions visible as blocked/reserved.
  // Public slot derivation still excludes them via blockedRanges elsewhere.
  const previewSlots = settings
    ? deriveAvailabilitySlots({
        settings,
        rules,
        exceptions,
        venueId: venue.venueId,
        venueName: venue.venueName,
        days: 14,
      })
    : [];

  const suggestedTimezone =
    (venue.country &&
      (
        {
          Spain: "Europe/Madrid",
          France: "Europe/Paris",
          Italy: "Europe/Rome",
          "United Kingdom": "Europe/London",
          UK: "Europe/London",
          Germany: "Europe/Berlin",
          Portugal: "Europe/Lisbon",
          Netherlands: "Europe/Amsterdam",
          Belgium: "Europe/Brussels",
          Sweden: "Europe/Stockholm",
          Poland: "Europe/Warsaw",
          UAE: "Asia/Dubai",
          "United Arab Emirates": "Asia/Dubai",
        } as Record<string, string>
      )[venue.country]) ||
    "Europe/London";

  return {
    venue,
    settings,
    rules,
    exceptions,
    previewSlots,
    suggestedTimezone,
    acceptedRanges,
    requestCounts: Object.fromEntries(requestCountMap.entries()),
  };
}

export async function loadPublicCoachAvailability(
  coachId: string,
  days = 14
): Promise<PublicVenueAvailabilityGroup[]> {
  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from("coach_venues")
    .select(
      `
      id,
      venue_id,
      venues ( id, name, city, country )
    `
    )
    .eq("coach_id", coachId)
    .eq("status", "active");

  if (error || !links?.length) return [];

  const rangeFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const rangeTo = new Date(
    Date.now() + (days + 2) * 24 * 60 * 60 * 1000
  ).toISOString();
  const blockedRanges = await loadAcceptedBlockedRangesForCoach(
    coachId,
    rangeFrom,
    rangeTo
  );

  const groups: PublicVenueAvailabilityGroup[] = [];

  for (const link of links as Record<string, unknown>[]) {
    const relationshipId = String(link.id);
    const venues = link.venues as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null;
    const venue = Array.isArray(venues) ? venues[0] : venues;
    const settings = await loadAvailabilitySettings(relationshipId);
    if (!settings?.is_public) continue;

    const [rules, exceptions] = await Promise.all([
      loadAvailabilityRules(relationshipId),
      loadAvailabilityExceptions(relationshipId),
    ]);

    const slots = deriveAvailabilitySlots({
      settings,
      rules,
      exceptions,
      venueId: String(link.venue_id),
      venueName: String(venue?.name ?? "Venue"),
      days,
      blockedRanges,
    });
    if (slots.length === 0) continue;

    groups.push({
      venueId: String(link.venue_id),
      venueName: String(venue?.name ?? "Venue"),
      city: (venue?.city as string | null) ?? null,
      country: (venue?.country as string | null) ?? null,
      timezone: settings.timezone,
      days: groupSlotsByLocalDate(slots, settings.timezone),
    });
  }

  return groups;
}

export async function loadPublicVenueCoachAvailability(
  venueId: string,
  days = 14
): Promise<PublicCoachAvailabilityCard[]> {
  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from("coach_venues")
    .select(
      `
      id,
      coach_id,
      coaches ( id, name, role, image_url )
    `
    )
    .eq("venue_id", venueId)
    .eq("status", "active");

  if (error || !links?.length) return [];

  const cards: PublicCoachAvailabilityCard[] = [];

  for (const link of links as Record<string, unknown>[]) {
    const relationshipId = String(link.id);
    const coaches = link.coaches as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null;
    const coach = Array.isArray(coaches) ? coaches[0] : coaches;
    const settings = await loadAvailabilitySettings(relationshipId);
    if (!settings?.is_public) continue;

    const [rules, exceptions] = await Promise.all([
      loadAvailabilityRules(relationshipId),
      loadAvailabilityExceptions(relationshipId),
    ]);

    const rangeFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rangeTo = new Date(
      Date.now() + (days + 2) * 24 * 60 * 60 * 1000
    ).toISOString();
    const blockedRanges = await loadAcceptedBlockedRangesForCoach(
      String(link.coach_id),
      rangeFrom,
      rangeTo
    );

    const slots = deriveAvailabilitySlots({
      settings,
      rules,
      exceptions,
      venueId,
      venueName: "Venue",
      days,
      blockedRanges,
    });
    if (slots.length === 0) continue;

    cards.push({
      coachId: String(link.coach_id),
      coachName: String(coach?.name ?? "Coach"),
      role: (coach?.role as string | null) ?? null,
      imageUrl: (coach?.image_url as string | null) ?? null,
      timezone: settings.timezone,
      nextSlot: slots[0] ?? null,
      isPublic: true,
      relationshipId,
      days: groupSlotsByLocalDate(slots, settings.timezone),
    });
  }

  return cards;
}

export async function loadAvailabilityMetaForRelationships(
  relationshipIds: string[]
): Promise<
  Map<
    string,
    {
      configured: boolean;
      isPublic: boolean;
      timezone: string | null;
      ruleCount: number;
      upcomingExceptionCount: number;
    }
  >
> {
  const map = new Map<
    string,
    {
      configured: boolean;
      isPublic: boolean;
      timezone: string | null;
      ruleCount: number;
      upcomingExceptionCount: number;
    }
  >();
  if (relationshipIds.length === 0) return map;

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [settingsRes, rulesRes, exceptionsRes] = await Promise.all([
    supabase
      .from("coach_venue_availability_settings")
      .select(SETTINGS_SELECT)
      .in("coach_venue_id", relationshipIds),
    supabase
      .from("coach_availability_rules")
      .select("coach_venue_id, is_active")
      .in("coach_venue_id", relationshipIds),
    supabase
      .from("coach_availability_exceptions")
      .select("coach_venue_id")
      .in("coach_venue_id", relationshipIds)
      .gte("ends_at", nowIso),
  ]);

  for (const id of relationshipIds) {
    map.set(id, {
      configured: false,
      isPublic: false,
      timezone: null,
      ruleCount: 0,
      upcomingExceptionCount: 0,
    });
  }

  for (const row of (settingsRes.data ?? []) as Record<string, unknown>[]) {
    const settings = asSettings(row);
    map.set(settings.coach_venue_id, {
      configured: true,
      isPublic: settings.is_public,
      timezone: settings.timezone,
      ruleCount: 0,
      upcomingExceptionCount: 0,
    });
  }

  for (const row of rulesRes.data ?? []) {
    const id = String(row.coach_venue_id);
    const current = map.get(id);
    if (!current || !row.is_active) continue;
    map.set(id, { ...current, ruleCount: current.ruleCount + 1 });
  }

  for (const row of exceptionsRes.data ?? []) {
    const id = String(row.coach_venue_id);
    const current = map.get(id);
    if (!current) continue;
    map.set(id, {
      ...current,
      upcomingExceptionCount: current.upcomingExceptionCount + 1,
    });
  }

  return map;
}

function rangesOverlap(
  slot: { startsAt: string; endsAt: string },
  ranges: Array<{ startsAt: string; endsAt: string }>
) {
  const startMs = new Date(slot.startsAt).getTime();
  const endMs = new Date(slot.endsAt).getTime();
  return ranges.some((range) => {
    const rangeStart = new Date(range.startsAt).getTime();
    const rangeEnd = new Date(range.endsAt).getTime();
    return startMs < rangeEnd && rangeStart < endMs;
  });
}

/** Venue-manager combined calendar: all active coaches, reserved via venue_booking_blocks (no requester PII). */
export async function loadVenueCombinedAvailabilityPreview(
  venueId: string,
  days = 14
): Promise<{
  slots: VenueCombinedAvailabilityPreviewSlot[];
  hasActiveCoaches: boolean;
}> {
  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from("coach_venues")
    .select(
      `
      id,
      coach_id,
      coaches ( id, name, role, image_url )
    `
    )
    .eq("venue_id", venueId)
    .eq("status", "active");

  if (error || !links?.length) {
    return { slots: [], hasActiveCoaches: false };
  }

  const rangeFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const rangeTo = new Date(
    Date.now() + (days + 2) * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: blockRows } = await supabase
    .from("venue_booking_blocks")
    .select(
      "coach_id, status, starts_at, ends_at, price_amount_minor, currency"
    )
    .eq("venue_id", venueId)
    .eq("status", "accepted")
    .lt("starts_at", rangeTo)
    .gt("ends_at", rangeFrom);

  const acceptedByCoach = new Map<
    string,
    Array<{ startsAt: string; endsAt: string }>
  >();
  for (const row of blockRows ?? []) {
    const coachId = String(row.coach_id);
    const list = acceptedByCoach.get(coachId) ?? [];
    list.push({
      startsAt: String(row.starts_at),
      endsAt: String(row.ends_at),
    });
    acceptedByCoach.set(coachId, list);
  }

  const slots: VenueCombinedAvailabilityPreviewSlot[] = [];

  for (const link of links as Record<string, unknown>[]) {
    const relationshipId = String(link.id);
    const coachId = String(link.coach_id);
    const coaches = link.coaches as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null;
    const coach = Array.isArray(coaches) ? coaches[0] : coaches;
    const settings = await loadAvailabilitySettings(relationshipId);
    if (!settings) continue;

    const [rules, exceptions] = await Promise.all([
      loadAvailabilityRules(relationshipId),
      loadAvailabilityExceptions(relationshipId),
    ]);

    const acceptedRanges = acceptedByCoach.get(coachId) ?? [];

    // Keep accepted bookings visible as reserved (do not exclude via blockedRanges).
    const derived = deriveAvailabilitySlots({
      settings,
      rules,
      exceptions,
      venueId,
      venueName: "Venue",
      days,
    });

    const coachName = String(coach?.name ?? "Coach");
    const coachRole = (coach?.role as string | null) ?? null;
    const coachImageUrl = (coach?.image_url as string | null) ?? null;
    const visibility = settings.is_public ? ("public" as const) : ("hidden" as const);

    for (const slot of derived) {
      const reserved = rangesOverlap(slot, acceptedRanges);
      const durationMinutes = Math.max(
        0,
        Math.round(
          (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) /
            60_000
        )
      );
      slots.push({
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        timezone: slot.timezone,
        venueId: slot.venueId,
        venueName: slot.venueName,
        priceAmountMinor: slot.priceAmountMinor,
        currency: slot.currency,
        state: reserved ? "reserved" : "available",
        visibility,
        coachId,
        coachName,
        coachRole,
        coachImageUrl,
        relationshipId,
        durationMinutes,
      });
    }
  }

  slots.sort((a, b) => {
    const byStart = a.startsAt.localeCompare(b.startsAt);
    if (byStart !== 0) return byStart;
    return a.coachName.localeCompare(b.coachName);
  });

  return {
    slots,
    hasActiveCoaches: true,
  };
}

export async function loadVenueCoachAvailabilityHints(
  venueId: string,
  relationshipIds: string[]
): Promise<
  Map<
    string,
    {
      configured: boolean;
      isPublic: boolean;
      timezone: string | null;
      nextSlotStartsAt: string | null;
    }
  >
> {
  const meta = await loadAvailabilityMetaForRelationships(relationshipIds);
  const supabase = await createClient();
  const result = new Map<
    string,
    {
      configured: boolean;
      isPublic: boolean;
      timezone: string | null;
      nextSlotStartsAt: string | null;
    }
  >();

  for (const id of relationshipIds) {
    const current = meta.get(id) ?? {
      configured: false,
      isPublic: false,
      timezone: null,
      ruleCount: 0,
      upcomingExceptionCount: 0,
    };
    let nextSlotStartsAt: string | null = null;
    if (current.configured) {
      const settings = await loadAvailabilitySettings(id);
      if (settings) {
        const [rules, exceptions] = await Promise.all([
          loadAvailabilityRules(id),
          loadAvailabilityExceptions(id),
        ]);
        // Venue read-only view: accepted blocks come from venue_booking_blocks (no PII).
        const coachIdForLink = (
          await supabase
            .from("coach_venues")
            .select("coach_id")
            .eq("id", id)
            .maybeSingle()
        ).data?.coach_id;
        let blockedRanges: Array<{ startsAt: string; endsAt: string }> = [];
        if (coachIdForLink) {
          const fromIso = new Date(
            Date.now() - 24 * 60 * 60 * 1000
          ).toISOString();
          const toIso = new Date(
            Date.now() + 16 * 24 * 60 * 60 * 1000
          ).toISOString();
          const { data: blockRows } = await supabase
            .from("venue_booking_blocks")
            .select("starts_at, ends_at")
            .eq("venue_id", venueId)
            .eq("coach_id", String(coachIdForLink))
            .eq("status", "accepted")
            .lt("starts_at", toIso)
            .gt("ends_at", fromIso);
          blockedRanges = (blockRows ?? []).map((row) => ({
            startsAt: String(row.starts_at),
            endsAt: String(row.ends_at),
          }));
        }
        const slots = deriveAvailabilitySlots({
          settings,
          rules,
          exceptions,
          venueId,
          venueName: "Venue",
          days: 14,
          blockedRanges,
        });
        nextSlotStartsAt = slots[0]?.startsAt ?? null;
      }
    }
    result.set(id, {
      configured: current.configured,
      isPublic: current.isPublic,
      timezone: current.timezone,
      nextSlotStartsAt,
    });
  }

  return result;
}

export async function coachHasLivePublicAvailability(
  coachId: string
): Promise<{
  status: "none" | "private" | "live";
  nextSlotStartsAt: string | null;
}> {
  const overview = await loadCoachAvailabilityOverview(coachId);
  if (overview.length === 0) {
    return { status: "none", nextSlotStartsAt: null };
  }

  const withSettings = overview.filter((item) => item.settings);
  if (withSettings.length === 0) {
    return { status: "none", nextSlotStartsAt: null };
  }

  const live = withSettings.find(
    (item) =>
      item.settings?.is_public &&
      (item.ruleCount > 0 || item.nextSlotStartsAt)
  );
  if (live) {
    return {
      status: "live",
      nextSlotStartsAt: live.nextSlotStartsAt,
    };
  }

  const privateConfigured = withSettings.some((item) => !item.settings?.is_public);
  if (privateConfigured) {
    return {
      status: "private",
      nextSlotStartsAt:
        withSettings.find((item) => item.nextSlotStartsAt)?.nextSlotStartsAt ??
        null,
    };
  }

  return { status: "none", nextSlotStartsAt: null };
}
