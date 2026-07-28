import { describe, expect, it } from "vitest";
import {
  buildAdminBookingQueryString,
  filterAdminBookings,
  paginateAdminBookings,
  parseAdminBookingSearchParams,
  sortAdminBookings,
} from "@/lib/admin/bookingTable";
import type { CoachBookingRequest } from "@/lib/coachBookings/types";

function booking(
  overrides: Partial<CoachBookingRequest> & Pick<CoachBookingRequest, "id">
): CoachBookingRequest {
  return {
    id: overrides.id,
    coach_venue_id: overrides.coach_venue_id ?? "cv-1",
    coach_id: overrides.coach_id ?? "coach-1",
    venue_id: overrides.venue_id ?? "venue-1",
    requester_user_id: overrides.requester_user_id ?? "user-1",
    requester_name: overrides.requester_name ?? "Alex Player",
    requester_email: overrides.requester_email ?? "alex@example.com",
    requester_phone: overrides.requester_phone ?? null,
    player_level: overrides.player_level ?? "intermediate",
    message: overrides.message ?? null,
    starts_at: overrides.starts_at ?? "2026-08-01T10:00:00.000Z",
    ends_at: overrides.ends_at ?? "2026-08-01T11:00:00.000Z",
    timezone: overrides.timezone ?? "Europe/London",
    status: overrides.status ?? "requested",
    created_at: overrides.created_at ?? "2026-07-28T09:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-07-28T09:00:00.000Z",
    responded_at: overrides.responded_at ?? null,
    cancelled_at: overrides.cancelled_at ?? null,
    completed_at: overrides.completed_at ?? null,
    price_amount_minor: overrides.price_amount_minor ?? 5000,
    currency: overrides.currency ?? "GBP",
    pricing_source: overrides.pricing_source ?? null,
    coach:
      overrides.coach ??
      ({
        id: "coach-1",
        name: "Coach One",
        role: null,
        image_url: null,
        price_from: null,
        email: null,
        phone: null,
      } satisfies CoachBookingRequest["coach"]),
    venue:
      overrides.venue ??
      ({
        id: "venue-1",
        name: "Venue One",
        city: null,
        country: null,
      } satisfies CoachBookingRequest["venue"]),
  };
}

describe("admin booking table helpers", () => {
  it("parses search params with defaults", () => {
    expect(parseAdminBookingSearchParams({})).toMatchObject({
      view: "upcoming",
      sort: "starts_at",
      dir: "asc",
      page: 1,
    });
  });

  it("filters upcoming bookings to future requested or accepted sessions", () => {
    const nowMs = new Date("2026-07-28T12:00:00.000Z").getTime();
    const rows = [
      booking({
        id: "1",
        status: "requested",
        starts_at: "2026-08-01T10:00:00.000Z",
      }),
      booking({
        id: "2",
        status: "accepted",
        starts_at: "2026-08-02T10:00:00.000Z",
      }),
      booking({
        id: "3",
        status: "requested",
        starts_at: "2026-07-20T10:00:00.000Z",
      }),
      booking({
        id: "4",
        status: "cancelled",
        starts_at: "2026-08-03T10:00:00.000Z",
      }),
    ];
    const params = parseAdminBookingSearchParams({});
    expect(filterAdminBookings(rows, params, nowMs).map((row) => row.id)).toEqual([
      "1",
      "2",
    ]);
  });

  it("sorts by coach name and paginates at 25 rows", () => {
    const rows = [
      booking({
        id: "1",
        coach: {
          id: "c2",
          name: "Zed",
          role: null,
          image_url: null,
          price_from: null,
          email: null,
          phone: null,
        },
      }),
      booking({
        id: "2",
        coach: {
          id: "c1",
          name: "Amy",
          role: null,
          image_url: null,
          price_from: null,
          email: null,
          phone: null,
        },
      }),
    ];
    const params = parseAdminBookingSearchParams({ sort: "coach", dir: "asc" });
    const sorted = sortAdminBookings(rows, params);
    expect(sorted.map((row) => row.id)).toEqual(["2", "1"]);

    const many = Array.from({ length: 30 }, (_, index) =>
      booking({ id: String(index + 1) })
    );
    const pageOne = paginateAdminBookings(many, 1);
    expect(pageOne.rows).toHaveLength(25);
    expect(pageOne.pageCount).toBe(2);
  });

  it("builds query strings without default params", () => {
    const params = parseAdminBookingSearchParams({
      q: "alex",
      view: "awaiting",
      page: "2",
    });
    expect(buildAdminBookingQueryString(params)).toBe(
      "?q=alex&view=awaiting&page=2"
    );
  });
});
