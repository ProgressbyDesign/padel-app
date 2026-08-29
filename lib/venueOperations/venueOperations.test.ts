import { describe, expect, it } from "vitest";
import {
  VENUE_BLOCK_FORBIDDEN_FIELDS,
  acceptedBlocks,
  activeCalendarBlocks,
  filterBlocksForVenue,
  mapVenueBookingBlock,
  requestedCountForSlot,
  slotBlockedByAccepted,
} from "@/lib/venueOperations/blocks";
import {
  buildCoachAvailabilityHealth,
  resolveCoachHealthState,
} from "@/lib/venueOperations/coachHealth";
import {
  countAcceptedFuture,
  countRequestedFuture,
  filterSessionsByTab,
} from "@/lib/venueOperations/counts";
import {
  DEFAULT_SCHEDULE_FILTER,
  filterOperationalSlots,
  operationalSlotIdentity,
} from "@/lib/venueOperations/scheduleFilters";
import {
  bookedSessionPriceCaption,
  currentSessionPriceLine,
} from "@/lib/venueOperations/pricingDisplay";
import { ymdInTimeZone } from "@/lib/coachAvailability/timezone";
import type { VenueBookingBlock } from "@/lib/venueOperations/types";
import type { VenueOperationalCalendarSlot } from "@/lib/venueOperations/types";

function block(
  overrides: Partial<VenueBookingBlock> &
    Pick<VenueBookingBlock, "status" | "starts_at" | "ends_at" | "coach_id">
): VenueBookingBlock {
  return {
    booking_request_id: "11111111-1111-4111-8111-111111111111",
    coach_venue_id: "22222222-2222-4222-8222-222222222222",
    venue_id: "33333333-3333-4333-8333-333333333333",
    timezone: "Europe/London",
    price_amount_minor: 4500,
    currency: "GBP",
    requested_at: "2026-07-01T10:00:00.000Z",
    responded_at: null,
    cancelled_at: null,
    completed_at: null,
    updated_at: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("venue booking block mapper", () => {
  it("maps safe fields and excludes PII keys", () => {
    const mapped = mapVenueBookingBlock({
      booking_request_id: "11111111-1111-4111-8111-111111111111",
      coach_venue_id: "22222222-2222-4222-8222-222222222222",
      coach_id: "44444444-4444-4444-8444-444444444444",
      venue_id: "33333333-3333-4333-8333-333333333333",
      status: "accepted",
      starts_at: "2026-07-20T10:00:00.000Z",
      ends_at: "2026-07-20T11:00:00.000Z",
      timezone: "Europe/London",
      price_amount_minor: 4500,
      currency: "GBP",
      requested_at: "2026-07-01T10:00:00.000Z",
      responded_at: "2026-07-02T10:00:00.000Z",
      cancelled_at: null,
      completed_at: null,
      updated_at: "2026-07-02T10:00:00.000Z",
      requester_name: "Secret Player",
      requester_email: "secret@example.com",
      requester_phone: "+440000",
      player_level: "beginner",
      message: "private",
      requester_user_id: "99999999-9999-4999-8999-999999999999",
    });

    expect(mapped).not.toBeNull();
    expect(mapped!.status).toBe("accepted");
    expect(mapped!.price_amount_minor).toBe(4500);
    for (const key of VENUE_BLOCK_FORBIDDEN_FIELDS) {
      expect(mapped).not.toHaveProperty(key);
    }
  });

  it("excludes unrelated venue blocks by filter", () => {
    const rows = [
      block({
        venue_id: "33333333-3333-4333-8333-333333333333",
        coach_id: "a",
        status: "accepted",
        starts_at: "2026-07-20T10:00:00.000Z",
        ends_at: "2026-07-20T11:00:00.000Z",
      }),
      block({
        venue_id: "55555555-5555-4555-8555-555555555555",
        coach_id: "b",
        status: "accepted",
        starts_at: "2026-07-20T10:00:00.000Z",
        ends_at: "2026-07-20T11:00:00.000Z",
      }),
    ];
    expect(
      filterBlocksForVenue(rows, "33333333-3333-4333-8333-333333333333")
    ).toHaveLength(1);
  });

  it("excludes cancelled from active calendar blocks", () => {
    const rows = [
      block({
        coach_id: "a",
        status: "accepted",
        starts_at: "2026-07-20T10:00:00.000Z",
        ends_at: "2026-07-20T11:00:00.000Z",
      }),
      block({
        coach_id: "a",
        status: "cancelled",
        starts_at: "2026-07-21T10:00:00.000Z",
        ends_at: "2026-07-21T11:00:00.000Z",
      }),
      block({
        coach_id: "a",
        status: "requested",
        starts_at: "2026-07-22T10:00:00.000Z",
        ends_at: "2026-07-22T11:00:00.000Z",
      }),
    ];
    expect(activeCalendarBlocks(rows).map((b) => b.status)).toEqual([
      "accepted",
      "requested",
    ]);
  });
});

describe("requested vs accepted slot behaviour", () => {
  const coachId = "44444444-4444-4444-8444-444444444444";
  const slot = {
    startsAt: "2026-07-20T10:00:00.000Z",
    endsAt: "2026-07-20T11:00:00.000Z",
    coachId,
  };

  it("accepted blocks public slot", () => {
    const blocks = [
      block({
        coach_id: coachId,
        status: "accepted",
        starts_at: "2026-07-20T10:00:00.000Z",
        ends_at: "2026-07-20T11:00:00.000Z",
      }),
    ];
    expect(slotBlockedByAccepted(slot, blocks)).toBe(true);
  });

  it("requested does not block", () => {
    const blocks = [
      block({
        coach_id: coachId,
        status: "requested",
        starts_at: "2026-07-20T10:00:00.000Z",
        ends_at: "2026-07-20T11:00:00.000Z",
      }),
    ];
    expect(slotBlockedByAccepted(slot, blocks)).toBe(false);
    expect(requestedCountForSlot(slot, blocks)).toBe(1);
  });
});

describe("coach health", () => {
  const base = {
    relationshipId: "r1",
    coachId: "c1",
    coachName: "Ada",
    coachRole: null,
    coachImageUrl: null,
    activeRuleCount: 1,
    futureExtraCount: 0,
    acceptedNext30Days: 0,
    lastScheduleUpdateAt: null,
    timezone: "Europe/London",
  };

  it("ready", () => {
    expect(
      resolveCoachHealthState({
        settingsConfigured: true,
        isPublic: true,
        nextFutureSlotStartsAt: "2026-07-20T10:00:00.000Z",
        requestedAwaitingResponse: 0,
      })
    ).toBe("ready");
  });

  it("hidden", () => {
    expect(
      resolveCoachHealthState({
        settingsConfigured: true,
        isPublic: false,
        nextFutureSlotStartsAt: "2026-07-20T10:00:00.000Z",
        requestedAwaitingResponse: 0,
      })
    ).toBe("hidden");
  });

  it("not configured", () => {
    expect(
      resolveCoachHealthState({
        settingsConfigured: false,
        isPublic: false,
        nextFutureSlotStartsAt: null,
        requestedAwaitingResponse: 0,
      })
    ).toBe("not_configured");
  });

  it("no future availability", () => {
    expect(
      resolveCoachHealthState({
        settingsConfigured: true,
        isPublic: true,
        nextFutureSlotStartsAt: null,
        requestedAwaitingResponse: 0,
      })
    ).toBe("no_future_availability");
  });

  it("needs response", () => {
    const health = buildCoachAvailabilityHealth({
      ...base,
      settingsConfigured: true,
      isPublic: true,
      nextFutureSlotStartsAt: "2026-07-20T10:00:00.000Z",
      requestedAwaitingResponse: 2,
    });
    expect(health.state).toBe("needs_response");
  });
});

describe("filters preserve multiple coaches", () => {
  const slots: VenueOperationalCalendarSlot[] = [
    {
      startsAt: "2026-07-20T10:00:00.000Z",
      endsAt: "2026-07-20T11:00:00.000Z",
      timezone: "Europe/London",
      venueId: "v",
      venueName: "V",
      priceAmountMinor: 4500,
      currency: "GBP",
      state: "available",
      visibility: "public",
      coachId: "c1",
      coachName: "A",
      coachRole: null,
      coachImageUrl: null,
      relationshipId: "r1",
      durationMinutes: 60,
    },
    {
      startsAt: "2026-07-20T10:00:00.000Z",
      endsAt: "2026-07-20T11:00:00.000Z",
      timezone: "Europe/London",
      venueId: "v",
      venueName: "V",
      priceAmountMinor: 5000,
      currency: "GBP",
      state: "available",
      visibility: "public",
      coachId: "c2",
      coachName: "B",
      coachRole: null,
      coachImageUrl: null,
      relationshipId: "r2",
      durationMinutes: 60,
    },
  ];

  it("keeps same-time sessions separate by coach", () => {
    const filtered = filterOperationalSlots(slots, DEFAULT_SCHEDULE_FILTER);
    expect(filtered).toHaveLength(2);
    expect(
      new Set(filtered.map((s) => operationalSlotIdentity(s))).size
    ).toBe(2);
  });
});

describe("pricing display", () => {
  it("reserved prices use snapshot wording", () => {
    expect(bookedSessionPriceCaption(4500, "GBP")).toMatch(/Booked session price/);
    expect(bookedSessionPriceCaption(4500, "GBP")).toMatch(/£45\.00|GBP/);
  });

  it("available prices use current wording", () => {
    expect(currentSessionPriceLine(4500, "GBP")).toMatch(/Current session price/);
  });
});

describe("session grouping and counts", () => {
  it("groups by timezone date", () => {
    const iso = "2026-07-20T23:30:00.000Z";
    expect(ymdInTimeZone(iso, "Europe/London")).toBe("2026-07-21");
    expect(ymdInTimeZone(iso, "UTC")).toBe("2026-07-20");
  });

  it("counts future requested vs accepted", () => {
    const now = Date.parse("2026-07-10T00:00:00.000Z");
    const rows = [
      block({
        coach_id: "a",
        status: "requested",
        starts_at: "2026-07-20T10:00:00.000Z",
        ends_at: "2026-07-20T11:00:00.000Z",
      }),
      block({
        coach_id: "a",
        status: "accepted",
        starts_at: "2026-07-21T10:00:00.000Z",
        ends_at: "2026-07-21T11:00:00.000Z",
      }),
      block({
        coach_id: "a",
        status: "accepted",
        starts_at: "2026-07-01T10:00:00.000Z",
        ends_at: "2026-07-01T11:00:00.000Z",
      }),
    ];
    expect(countRequestedFuture(rows, now)).toBe(1);
    expect(countAcceptedFuture(rows, now)).toBe(1);
    expect(acceptedBlocks(rows)).toHaveLength(2);
  });

  it("filters session tabs", () => {
    const now = Date.parse("2026-07-10T00:00:00.000Z");
    const rows = [
      {
        ...block({
          coach_id: "a",
          status: "requested",
          starts_at: "2026-07-20T10:00:00.000Z",
          ends_at: "2026-07-20T11:00:00.000Z",
        }),
        coach_name: "A",
        coach_role: null,
        coach_image_url: null,
      },
      {
        ...block({
          coach_id: "a",
          status: "cancelled",
          starts_at: "2026-07-15T10:00:00.000Z",
          ends_at: "2026-07-15T11:00:00.000Z",
          cancelled_at: "2026-07-12T10:00:00.000Z",
        }),
        coach_name: "A",
        coach_role: null,
        coach_image_url: null,
      },
    ];
    expect(filterSessionsByTab(rows, "awaiting", now)).toHaveLength(1);
    expect(filterSessionsByTab(rows, "cancelled", now)).toHaveLength(1);
    expect(filterSessionsByTab(rows, "upcoming", now)).toHaveLength(1);
  });
});
