import "server-only";

import { deriveAvailabilitySlots } from "@/lib/coachAvailability/slots";
import {
  acceptedBlocks,
  durationMinutesFromBlock,
  rangesOverlap,
  requestedCountForSlot,
  slotBlockedByAccepted,
} from "@/lib/venueOperations/blocks";
import { buildCoachAvailabilityHealth } from "@/lib/venueOperations/coachHealth";
import {
  countAcceptedFuture,
  countAcceptedInWeek,
  countCancelledRecent,
  countRequestedFuture,
  nextAcceptedSession,
} from "@/lib/venueOperations/counts";
import { buildVenueAlerts } from "@/lib/venueOperations/alerts";
import type {
  CoachAvailabilityHealth,
  VenueAlert,
  VenueBookingBlockWithCoach,
  VenueOperationalCalendarSlot,
  VenueOpsSummary,
} from "@/lib/venueOperations/types";
import {
  loadAvailabilityExceptions,
  loadAvailabilityMetaForRelationships,
  loadAvailabilityRules,
  loadAvailabilitySettings,
} from "@/lib/queries/coachAvailability";
import { loadVenueRelationshipBoard } from "@/lib/queries/coachVenueRelationships";
import { loadManagedVenueShell } from "@/lib/queries/managedVenueShell";
import { loadCoachRelationshipIdentities } from "@/lib/queries/relationshipIdentities";
import {
  loadVenueBookingBlocks,
  loadVenueBookingBlocksWithCoaches,
} from "@/lib/queries/venueBookingBlocks";
import { createClient } from "@/lib/supabase/server";

type ActiveCoachLink = {
  relationshipId: string;
  coachId: string;
  coachName: string;
  coachRole: string | null;
  coachImageUrl: string | null;
};

async function loadActiveCoachLinks(venueId: string): Promise<ActiveCoachLink[]> {
  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from("coach_venues")
    .select("id, coach_id")
    .eq("venue_id", venueId)
    .eq("status", "active");

  if (error || !links?.length) return [];

  const identities = await loadCoachRelationshipIdentities(
    links.map((link) => String(link.coach_id)),
    supabase
  );

  return links.map((link) => {
    const coach = identities.get(String(link.coach_id));
    return {
      relationshipId: String(link.id),
      coachId: String(link.coach_id),
      coachName: coach?.name?.trim() || "Coach",
      coachRole: coach?.role ?? null,
      coachImageUrl: coach?.image_url ?? null,
    };
  });
}

function durationMinutes(startsAt: string, endsAt: string): number {
  return Math.max(
    0,
    Math.round(
      (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000
    )
  );
}

export async function loadVenueOperationalSchedule(
  venueId: string,
  days = 14
): Promise<{
  slots: VenueOperationalCalendarSlot[];
  hasActiveCoaches: boolean;
  primaryTimezone: string;
  timezoneInconsistency: boolean;
  coaches: Array<{ id: string; name: string }>;
  venueName: string;
}> {
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) {
    return {
      slots: [],
      hasActiveCoaches: false,
      primaryTimezone: "UTC",
      timezoneInconsistency: false,
      coaches: [],
      venueName: "Venue",
    };
  }

  const [links, blocks] = await Promise.all([
    loadActiveCoachLinks(venueId),
    loadVenueBookingBlocks(venueId, {
      fromIso: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      toIso: new Date(Date.now() + (days + 2) * 24 * 60 * 60 * 1000).toISOString(),
    }),
  ]);

  if (links.length === 0) {
    return {
      slots: [],
      hasActiveCoaches: false,
      primaryTimezone: "UTC",
      timezoneInconsistency: false,
      coaches: [],
      venueName: shell.name?.trim() || "Venue",
    };
  }

  const slots: VenueOperationalCalendarSlot[] = [];
  const timezones = new Set<string>();

  for (const link of links) {
    const settings = await loadAvailabilitySettings(link.relationshipId);
    if (!settings) continue;
    timezones.add(settings.timezone);

    const [rules, exceptions] = await Promise.all([
      loadAvailabilityRules(link.relationshipId),
      loadAvailabilityExceptions(link.relationshipId),
    ]);

    const derived = deriveAvailabilitySlots({
      settings,
      rules,
      exceptions,
      venueId,
      venueName: shell.name?.trim() || "Venue",
      days,
    });

    const coachBlocks = blocks.filter((b) => b.coach_id === link.coachId);
    const visibility = settings.is_public ? ("public" as const) : ("hidden" as const);

    for (const slot of derived) {
      const reserved = slotBlockedByAccepted(
        { startsAt: slot.startsAt, endsAt: slot.endsAt, coachId: link.coachId },
        coachBlocks
      );
      const requestedCount = requestedCountForSlot(
        { startsAt: slot.startsAt, endsAt: slot.endsAt, coachId: link.coachId },
        coachBlocks
      );

      const matchingAccepted = acceptedBlocks(coachBlocks).find((b) =>
        rangesOverlap(
          { startsAt: slot.startsAt, endsAt: slot.endsAt },
          b
        )
      );

      slots.push({
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        timezone: slot.timezone,
        venueId,
        venueName: shell.name?.trim() || "Venue",
        priceAmountMinor: reserved
          ? (matchingAccepted?.price_amount_minor ?? slot.priceAmountMinor)
          : slot.priceAmountMinor,
        currency: reserved
          ? (matchingAccepted?.currency ?? slot.currency)
          : slot.currency,
        bookedPriceAmountMinor: matchingAccepted?.price_amount_minor ?? null,
        bookedCurrency: matchingAccepted?.currency ?? null,
        state: reserved ? "reserved" : "available",
        visibility,
        coachId: link.coachId,
        coachName: link.coachName,
        coachRole: link.coachRole,
        coachImageUrl: link.coachImageUrl,
        relationshipId: link.relationshipId,
        durationMinutes: durationMinutes(slot.startsAt, slot.endsAt),
        bookingRequestId: matchingAccepted?.booking_request_id,
        requestedAt: matchingAccepted?.requested_at,
        respondedAt: matchingAccepted?.responded_at ?? null,
        requestedCount: requestedCount > 0 ? requestedCount : undefined,
      });
    }

    // Requested blocks that don't sit on a derived availability slot still appear
    // as neutral markers so managers can see pending coach responses.
    for (const block of coachBlocks) {
      if (block.status !== "requested") continue;
      const alreadyCovered = slots.some(
        (s) =>
          s.coachId === link.coachId &&
          s.state !== "reserved" &&
          rangesOverlap(
            { startsAt: s.startsAt, endsAt: s.endsAt },
            block
          )
      );
      if (alreadyCovered) continue;

      slots.push({
        startsAt: block.starts_at,
        endsAt: block.ends_at,
        timezone: block.timezone,
        venueId,
        venueName: shell.name?.trim() || "Venue",
        priceAmountMinor: block.price_amount_minor,
        currency: block.currency,
        bookedPriceAmountMinor: block.price_amount_minor,
        bookedCurrency: block.currency,
        state: "requested",
        visibility,
        coachId: link.coachId,
        coachName: link.coachName,
        coachRole: link.coachRole,
        coachImageUrl: link.coachImageUrl,
        relationshipId: link.relationshipId,
        durationMinutes: durationMinutesFromBlock(block),
        bookingRequestId: block.booking_request_id,
        requestedAt: block.requested_at,
        respondedAt: block.responded_at,
        requestedCount: 1,
      });
    }
  }

  slots.sort((a, b) => {
    const byStart = a.startsAt.localeCompare(b.startsAt);
    if (byStart !== 0) return byStart;
    return a.coachName.localeCompare(b.coachName);
  });

  const tzList = [...timezones];
  const primaryTimezone = tzList[0] ?? "UTC";

  return {
    slots,
    hasActiveCoaches: true,
    primaryTimezone,
    timezoneInconsistency: tzList.length > 1,
    coaches: links.map((l) => ({ id: l.coachId, name: l.coachName })),
    venueName: shell.name?.trim() || "Venue",
  };
}

export async function loadVenueCoachHealth(
  venueId: string
): Promise<CoachAvailabilityHealth[]> {
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) return [];

  const links = await loadActiveCoachLinks(venueId);
  if (links.length === 0) return [];

  const relationshipIds = links.map((l) => l.relationshipId);
  const meta = await loadAvailabilityMetaForRelationships(relationshipIds);
  const now = Date.now();
  const fromIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const to30 = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const to14 = new Date(now + 16 * 24 * 60 * 60 * 1000).toISOString();

  const blocks = await loadVenueBookingBlocks(venueId, {
    fromIso,
    toIso: to30,
  });

  const result: CoachAvailabilityHealth[] = [];

  for (const link of links) {
    const current = meta.get(link.relationshipId) ?? {
      configured: false,
      isPublic: false,
      timezone: null,
      ruleCount: 0,
      upcomingExceptionCount: 0,
    };

    let nextFutureSlotStartsAt: string | null = null;
    let lastScheduleUpdateAt: string | null = null;
    let isPublic = current.isPublic;
    let timezone = current.timezone;

    if (current.configured) {
      const settings = await loadAvailabilitySettings(link.relationshipId);
      if (settings) {
        isPublic = settings.is_public;
        timezone = settings.timezone;
        lastScheduleUpdateAt = settings.updated_at;
        const [rules, exceptions] = await Promise.all([
          loadAvailabilityRules(link.relationshipId),
          loadAvailabilityExceptions(link.relationshipId),
        ]);
        const coachBlocks = blocks.filter((b) => b.coach_id === link.coachId);
        const acceptedRanges = acceptedBlocks(coachBlocks).map((b) => ({
          startsAt: b.starts_at,
          endsAt: b.ends_at,
        }));
        const derived = deriveAvailabilitySlots({
          settings,
          rules,
          exceptions,
          venueId,
          venueName: shell.name?.trim() || "Venue",
          days: 14,
          blockedRanges: acceptedRanges,
        });
        // Only count future slots within horizon
        const future = derived.filter(
          (s) => new Date(s.startsAt).getTime() > now && s.startsAt < to14
        );
        nextFutureSlotStartsAt = future[0]?.startsAt ?? null;
      }
    }

    const coachBlocks = blocks.filter((b) => b.coach_id === link.coachId);
    const acceptedNext30Days = coachBlocks.filter(
      (b) =>
        b.status === "accepted" &&
        new Date(b.starts_at).getTime() > now &&
        b.starts_at < to30
    ).length;
    const requestedAwaitingResponse = coachBlocks.filter(
      (b) =>
        b.status === "requested" && new Date(b.starts_at).getTime() > now
    ).length;

    result.push(
      buildCoachAvailabilityHealth({
        relationshipId: link.relationshipId,
        coachId: link.coachId,
        coachName: link.coachName,
        coachRole: link.coachRole,
        coachImageUrl: link.coachImageUrl,
        settingsConfigured: current.configured,
        isPublic,
        activeRuleCount: current.ruleCount,
        futureExtraCount: current.upcomingExceptionCount,
        nextFutureSlotStartsAt,
        acceptedNext30Days,
        requestedAwaitingResponse,
        lastScheduleUpdateAt,
        timezone,
      })
    );
  }

  return result;
}

export async function loadVenueOpsOverview(venueId: string): Promise<{
  summary: VenueOpsSummary;
  health: CoachAvailabilityHealth[];
  alerts: VenueAlert[];
  nextSession: VenueBookingBlockWithCoach | null;
} | null> {
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) return null;

  const [health, board, blocksWithCoaches] = await Promise.all([
    loadVenueCoachHealth(venueId),
    loadVenueRelationshipBoard(venueId),
    loadVenueBookingBlocksWithCoaches(venueId),
  ]);

  const primaryTimezone =
    health.find((h) => h.timezone)?.timezone ?? "UTC";
  const now = Date.now();

  const confirmedFuture = countAcceptedFuture(blocksWithCoaches, now);
  const nextSession = nextAcceptedSession(blocksWithCoaches, now);
  const summary: VenueOpsSummary = {
    activeCoaches: health.length,
    publicCoaches: health.filter((h) => h.settingsConfigured && h.isPublic)
      .length,
    hiddenSchedules: health.filter((h) => h.settingsConfigured && !h.isPublic)
      .length,
    notConfigured: health.filter((h) => !h.settingsConfigured).length,
    sessionsThisWeek: countAcceptedInWeek(
      blocksWithCoaches,
      primaryTimezone,
      now
    ),
    confirmedFuture,
    pendingRelationships: board.incoming.length + board.outgoing.length,
    importedUnverified: board.current.filter((r) => r.status === "unverified")
      .length,
    nextSession,
    cancelledNextSevenDays: countCancelledRecent(
      blocksWithCoaches,
      7 * 24 * 60 * 60 * 1000,
      now
    ),
    requestedAwaitingCoach: countRequestedFuture(blocksWithCoaches, now),
    noFutureSessions: confirmedFuture === 0 && countRequestedFuture(blocksWithCoaches, now) === 0,
  };

  const alerts = buildVenueAlerts({
    venueId,
    summary,
    health,
    invitationAwaitingCount: board.outgoing.length + board.incoming.length,
  });

  return { summary, health, alerts, nextSession };
}
