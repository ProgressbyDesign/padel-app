import { describe, expect, it } from "vitest";
import { buildPersonalDashboardView } from "@/lib/account/personalDashboard";
import type {
  AccountCoachApplicationSummary,
  AccountDashboardData,
  ManagedCoach,
  ManagedVenue,
} from "@/lib/queries/accountDashboard";

function dashboard(
  overrides: Partial<
    Pick<
      AccountDashboardData,
      | "coaches"
      | "venues"
      | "coachApplication"
      | "venueApplication"
      | "accountJourney"
    >
  > = {}
) {
  return {
    coaches: [] as ManagedCoach[],
    venues: [] as ManagedVenue[],
    coachApplication: null as AccountCoachApplicationSummary,
    venueApplication: null,
    accountJourney: "player" as const,
    ...overrides,
  };
}

describe("player personal dashboard view", () => {
  it("keeps a default player dashboard free of prominent coach/venue start cards", () => {
    const view = buildPersonalDashboardView(dashboard());
    expect(view.isPurePlayer).toBe(true);
    expect(view.showCoachStartCard).toBe(false);
    expect(view.showVenueStartCard).toBe(false);
    expect(view.showApplicationsSection).toBe(false);
    expect(view.showPlayerEmptyState).toBe(true);
    expect(view.showPlayerCtas).toBe(true);
    expect(view.playerCtas.map((cta) => cta.href)).toEqual([
      "/coaches",
      "/account/bookings",
      "/account/settings",
    ]);
    expect(view.showPartnerConversion).toBe(true);
  });

  it("shows an active coach application without start cards", () => {
    const view = buildPersonalDashboardView(
      dashboard({
        coachApplication: {
          id: "app-1",
          status: "submitted",
          currentStep: 4,
          submittedAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
          reviewNote: null,
          coachId: null,
        },
      })
    );
    expect(view.showCoachApplication).toBe(true);
    expect(view.showApplicationsSection).toBe(true);
    expect(view.showCoachStartCard).toBe(false);
    expect(view.showVenueStartCard).toBe(false);
    expect(view.showPlayerEmptyState).toBe(false);
    expect(view.showPartnerConversion).toBe(false);
  });

  it("shows managed coach and venue workspaces when memberships exist", () => {
    const view = buildPersonalDashboardView(
      dashboard({
        coaches: [{ id: "coach-1" } as ManagedCoach],
        venues: [{ id: "venue-1" } as ManagedVenue],
        accountJourney: "player",
      })
    );
    expect(view.showManagedCoaches).toBe(true);
    expect(view.showManagedVenues).toBe(true);
    expect(view.showCoachStartCard).toBe(false);
    expect(view.showVenueStartCard).toBe(false);
    expect(view.isPurePlayer).toBe(false);
  });

  it("lets real membership/application state override a stale account_journey hint", () => {
    const staleJourney = buildPersonalDashboardView(
      dashboard({
        accountJourney: "coach_business",
      })
    );
    expect(staleJourney.isPurePlayer).toBe(true);
    expect(staleJourney.showManagedCoaches).toBe(false);
    expect(staleJourney.showCoachStartCard).toBe(false);

    const withMembership = buildPersonalDashboardView(
      dashboard({
        accountJourney: "player",
        coaches: [{ id: "coach-1" } as ManagedCoach],
      })
    );
    expect(withMembership.isPurePlayer).toBe(false);
    expect(withMembership.showManagedCoaches).toBe(true);
  });
});
