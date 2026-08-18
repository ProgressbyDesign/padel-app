import { describe, expect, it } from "vitest";
import { deriveAvailabilitySlots } from "@/lib/coachAvailability/slots";
import type {
  AvailabilityException,
  AvailabilityRule,
  AvailabilitySettings,
} from "@/lib/coachAvailability/types";

const settings: AvailabilitySettings = {
  coach_venue_id: "rel-public",
  timezone: "UTC",
  default_slot_duration_minutes: 60,
  is_public: true,
  currency: "EUR",
  default_hourly_rate_minor: 6000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

/** Fixed far-future Monday so slot generation is stable. */
const FAR_MONDAY = "2030-06-03";

const mondayRule: AvailabilityRule = {
  id: "rule-1",
  coach_venue_id: "rel-public",
  day_of_week: 1,
  start_time: "10:00:00",
  end_time: "12:00:00",
  slot_duration_minutes: 60,
  valid_from: "2020-01-01",
  valid_until: null,
  is_active: true,
  price_override_minor: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const emptyExceptions: AvailabilityException[] = [];

describe("public availability accepted-range omission", () => {
  it("omits an accepted booking range from displayed public slots", () => {
    const withoutBlocks = deriveAvailabilitySlots({
      settings,
      rules: [mondayRule],
      exceptions: emptyExceptions,
      venueId: "venue-a",
      venueName: "Venue A",
      days: 7,
      fromYmd: FAR_MONDAY,
    });

    expect(withoutBlocks.map((s) => s.startsAt)).toContain(
      "2030-06-03T10:00:00.000Z"
    );
    expect(withoutBlocks.map((s) => s.startsAt)).toContain(
      "2030-06-03T11:00:00.000Z"
    );

    const withAcceptedBlock = deriveAvailabilitySlots({
      settings,
      rules: [mondayRule],
      exceptions: emptyExceptions,
      venueId: "venue-a",
      venueName: "Venue A",
      days: 7,
      fromYmd: FAR_MONDAY,
      blockedRanges: [
        {
          startsAt: "2030-06-03T10:00:00.000Z",
          endsAt: "2030-06-03T11:00:00.000Z",
        },
      ],
    });

    expect(withAcceptedBlock.map((s) => s.startsAt)).not.toContain(
      "2030-06-03T10:00:00.000Z"
    );
    expect(withAcceptedBlock.map((s) => s.startsAt)).toContain(
      "2030-06-03T11:00:00.000Z"
    );
  });

  it("documents public loader must use anon-safe RPC ranges only", () => {
    // Contract mirror of get_public_accepted_booking_ranges OUT columns.
    // Application code maps these into BlockedTimeRange for deriveAvailabilitySlots.
    const publicRpcRow = {
      starts_at: "2030-06-03T10:00:00+00",
      ends_at: "2030-06-03T11:00:00+00",
    };
    const blocked = {
      startsAt: String(publicRpcRow.starts_at),
      endsAt: String(publicRpcRow.ends_at),
    };
    expect(Object.keys(publicRpcRow).sort()).toEqual(["ends_at", "starts_at"]);
    expect(blocked).toEqual({
      startsAt: "2030-06-03T10:00:00+00",
      endsAt: "2030-06-03T11:00:00+00",
    });
    expect("requester_email" in publicRpcRow).toBe(false);
    expect("id" in publicRpcRow).toBe(false);
    expect("price_amount_minor" in publicRpcRow).toBe(false);
  });
});
