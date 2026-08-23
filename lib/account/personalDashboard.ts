import type { AccountJourney } from "@/lib/lifecycle/constants";
import type { AccountDashboardData } from "@/lib/queries/accountDashboard";

export type PersonalPlayerCta = {
  href: string;
  title: string;
  description: string;
};

export type PersonalDashboardView = {
  accountJourney: AccountJourney;
  isPurePlayer: boolean;
  showPlayerEmptyState: boolean;
  showPlayerCtas: boolean;
  showManagedCoaches: boolean;
  showManagedVenues: boolean;
  showCoachApplication: boolean;
  showVenueApplication: boolean;
  showCoachStartCard: boolean;
  showVenueStartCard: boolean;
  showPartnerConversion: boolean;
  showApplicationsSection: boolean;
  playerCtas: PersonalPlayerCta[];
};

const PLAYER_CTAS: PersonalPlayerCta[] = [
  {
    href: "/coaches",
    title: "Find coaches",
    description: "Browse published coaches and start a booking or enquiry.",
  },
  {
    href: "/account/bookings",
    title: "My bookings",
    description: "Review sessions you have requested as a player.",
  },
  {
    href: "/account/settings",
    title: "Account settings",
    description: "Update your profile, email, password, and security.",
  },
];

/**
 * Presentation-only. Memberships and applications are the source of truth;
 * account_journey never grants coach/venue workspace access.
 */
export function buildPersonalDashboardView(
  data: Pick<
    AccountDashboardData,
    | "coaches"
    | "venues"
    | "coachApplication"
    | "venueApplication"
    | "accountJourney"
  >
): PersonalDashboardView {
  const hasMemberships = data.coaches.length > 0 || data.venues.length > 0;
  const showCoachApplication = Boolean(data.coachApplication);
  const showVenueApplication = Boolean(data.venueApplication);
  const hasApplications = showCoachApplication || showVenueApplication;
  const isPurePlayer = !hasMemberships && !hasApplications;

  return {
    accountJourney: data.accountJourney,
    isPurePlayer,
    showPlayerEmptyState: isPurePlayer,
    showPlayerCtas: isPurePlayer,
    showManagedCoaches: data.coaches.length > 0,
    showManagedVenues: data.venues.length > 0,
    showCoachApplication,
    showVenueApplication,
    showCoachStartCard: false,
    showVenueStartCard: false,
    showPartnerConversion: isPurePlayer,
    showApplicationsSection: hasApplications,
    playerCtas: PLAYER_CTAS,
  };
}
