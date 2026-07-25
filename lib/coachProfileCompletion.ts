import { optionLabel, PLAYER_LEVELS } from "@/lib/coachProfileApplication/constants";
import { coachOutcomeLabel } from "@/lib/coachManagement";

export type CoachCompletionInput = {
  name: string | null;
  role: string | null;
  description: string | null;
  experience_years: number | null;
  phone: string | null;
  email: string | null;
  price_from: number | null;
  image_url: string | null;
  is_approved: boolean | null;
  hasPrimaryLocation: boolean;
  audienceAdults: boolean;
  audienceJuniors: boolean;
  playerLevels: string[];
  outcomes: string[];
  imageCount: number;
  socialCount: number;
  achievementCount: number;
  activeVenueCount: number;
  availabilityLive: boolean;
  pendingBookingCount?: number;
};

export type CompletionItem = {
  id: string;
  label: string;
  done: boolean;
  href: string;
  weight: "essential" | "trust" | "booking" | "optional";
};

export type CompletionGroup = {
  id: "essential" | "trust" | "booking";
  title: string;
  items: CompletionItem[];
};

export type CoachBadge =
  | { id: "verified"; label: "Verified coach" }
  | { id: "complete"; label: "Complete profile" }
  | { id: "venue_confirmed"; label: "Venue confirmed" }
  | { id: "availability_live"; label: "Availability live" };

export type VenueBadge =
  | { id: "verified"; label: "Verified venue" }
  | { id: "complete"; label: "Complete profile" }
  | { id: "active_coaches"; label: "Active coaches" }
  | { id: "booking_availability"; label: "Booking availability" };

const COMPLETE_THRESHOLD = 0.8;

export function buildCoachCompletion(
  coachId: string,
  input: CoachCompletionInput
): {
  groups: CompletionGroup[];
  items: CompletionItem[];
  completedEssential: number;
  essentialTotal: number;
  completedWeighted: number;
  weightedTotal: number;
  isComplete: boolean;
  badges: CoachBadge[];
} {
  const base = `/account/coaches/${encodeURIComponent(coachId)}`;
  const hasAudience = input.audienceAdults || input.audienceJuniors;
  const hasContact = Boolean(input.phone?.trim() || input.email?.trim());
  const hasPrimaryImage = input.imageCount > 0 || Boolean(input.image_url?.trim());
  const hasDescription =
    Boolean(input.description?.trim()) &&
    (input.description?.trim().length ?? 0) >= 40;

  const items: CompletionItem[] = [
    {
      id: "name-role",
      label: "Name and role",
      done: Boolean(input.name?.trim() && input.role?.trim()),
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "description",
      label: "Coaching introduction",
      done: hasDescription,
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "experience",
      label: "Experience",
      done: input.experience_years !== null,
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "primary-location",
      label: "Primary location",
      done: input.hasPrimaryLocation,
      href: `${base}/locations`,
      weight: "essential",
    },
    {
      id: "audiences",
      label: "Adults / juniors",
      done: hasAudience,
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "player-levels",
      label: "Player levels",
      done: input.playerLevels.length > 0,
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "outcomes",
      label: "Coaching outcomes",
      done: input.outcomes.length > 0,
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "primary-image",
      label: "Primary image",
      done: hasPrimaryImage,
      href: `${base}/images`,
      weight: "essential",
    },
    {
      id: "contact",
      label: "Public contact method",
      done: hasContact,
      href: `${base}/details`,
      weight: "trust",
    },
    {
      id: "price",
      label: "Price from",
      done: input.price_from !== null,
      href: `${base}/details`,
      weight: "trust",
    },
    {
      id: "venue",
      label: "Active venue",
      done: input.activeVenueCount > 0,
      href: `${base}/venues`,
      weight: "booking",
    },
    {
      id: "availability",
      label: "Public availability",
      done: input.availabilityLive,
      href: `${base}/availability`,
      weight: "booking",
    },
    {
      id: "socials",
      label: "Social links",
      done: input.socialCount > 0,
      href: `${base}/socials`,
      weight: "optional",
    },
    {
      id: "achievements",
      label: "Achievements",
      done: input.achievementCount > 0,
      href: `${base}/achievements`,
      weight: "optional",
    },
  ];

  const groups: CompletionGroup[] = [
    {
      id: "essential",
      title: "Essential profile",
      items: items.filter((item) => item.weight === "essential"),
    },
    {
      id: "trust",
      title: "Trust signals",
      items: items.filter(
        (item) => item.weight === "trust" || item.weight === "optional"
      ),
    },
    {
      id: "booking",
      title: "Booking readiness",
      items: items.filter((item) => item.weight === "booking"),
    },
  ];

  const essential = items.filter((item) => item.weight === "essential");
  const weighted = items.filter((item) => item.weight !== "optional");
  const completedEssential = essential.filter((item) => item.done).length;
  const completedWeighted = weighted.filter((item) => item.done).length;
  const isComplete =
    completedEssential === essential.length &&
    completedWeighted / weighted.length >= COMPLETE_THRESHOLD;

  const badges: CoachBadge[] = [];
  if (input.is_approved) badges.push({ id: "verified", label: "Verified coach" });
  if (isComplete) badges.push({ id: "complete", label: "Complete profile" });
  if (input.activeVenueCount > 0) {
    badges.push({ id: "venue_confirmed", label: "Venue confirmed" });
  }
  if (input.availabilityLive) {
    badges.push({ id: "availability_live", label: "Availability live" });
  }

  return {
    groups,
    items,
    completedEssential,
    essentialTotal: essential.length,
    completedWeighted,
    weightedTotal: weighted.length,
    isComplete,
    badges,
  };
}

export function playerLevelLabels(levels: string[]): string[] {
  return levels.map((level) => optionLabel(PLAYER_LEVELS, level));
}

export function outcomeLabels(outcomes: string[]): string[] {
  return outcomes.map((outcome) => coachOutcomeLabel(outcome));
}

export type VenueCompletionInput = {
  name: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  courts: number | null;
  courtType: string | null;
  venueType: string | null;
  hasOpeningHours: boolean;
  imageCount: number;
  socialCount: number;
  hasCoachingDescription: boolean;
  activeCoachCount: number;
  hasCoachAvailability: boolean;
  isVerified: boolean;
};

export function buildVenueCompletion(
  venueId: string,
  input: VenueCompletionInput
): {
  groups: CompletionGroup[];
  items: CompletionItem[];
  isComplete: boolean;
  badges: VenueBadge[];
  completedWeighted: number;
  weightedTotal: number;
} {
  const base = `/account/venues/${encodeURIComponent(venueId)}`;
  const hasCore =
    Boolean(input.name?.trim()) &&
    Boolean(input.city?.trim()) &&
    Boolean(input.country?.trim());

  const items: CompletionItem[] = [
    {
      id: "core",
      label: "Name, city and country",
      done: hasCore,
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "address",
      label: "Address",
      done: Boolean(input.address?.trim()),
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "contact",
      label: "Website or phone",
      done: Boolean(input.website?.trim() || input.phone?.trim()),
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "courts",
      label: "Courts and court type",
      done: input.courts != null && Boolean(input.courtType?.trim()),
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "venue-type",
      label: "Venue type",
      done: Boolean(input.venueType?.trim()),
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "hours",
      label: "Opening hours",
      done: input.hasOpeningHours,
      href: `${base}/details`,
      weight: "essential",
    },
    {
      id: "image",
      label: "Primary image",
      done: input.imageCount > 0,
      href: `${base}/images`,
      weight: "trust",
    },
    {
      id: "gallery",
      label: "Gallery",
      done: input.imageCount > 1,
      href: `${base}/images`,
      weight: "optional",
    },
    {
      id: "socials",
      label: "Social links",
      done: input.socialCount > 0,
      href: `${base}/socials`,
      weight: "optional",
    },
    {
      id: "coaching-desc",
      label: "Coaching description",
      done: input.hasCoachingDescription,
      href: `${base}/details`,
      weight: "trust",
    },
    {
      id: "coaches",
      label: "Active coaches",
      done: input.activeCoachCount > 0,
      href: `${base}/coaches`,
      weight: "booking",
    },
    {
      id: "coach-availability",
      label: "Coach availability visible",
      done: input.hasCoachAvailability,
      href: `${base}/coaches`,
      weight: "booking",
    },
  ];

  const groups: CompletionGroup[] = [
    {
      id: "essential",
      title: "Essential venue details",
      items: items.filter((item) => item.weight === "essential"),
    },
    {
      id: "trust",
      title: "Trust and discovery",
      items: items.filter(
        (item) => item.weight === "trust" || item.weight === "optional"
      ),
    },
    {
      id: "booking",
      title: "Coach and booking readiness",
      items: items.filter((item) => item.weight === "booking"),
    },
  ];

  const weighted = items.filter((item) => item.weight !== "optional");
  const completedWeighted = weighted.filter((item) => item.done).length;
  const isComplete = completedWeighted / weighted.length >= COMPLETE_THRESHOLD;

  const badges: VenueBadge[] = [];
  if (input.isVerified) badges.push({ id: "verified", label: "Verified venue" });
  if (isComplete) badges.push({ id: "complete", label: "Complete profile" });
  if (input.activeCoachCount > 0) {
    badges.push({ id: "active_coaches", label: "Active coaches" });
  }
  if (input.hasCoachAvailability) {
    badges.push({ id: "booking_availability", label: "Booking availability" });
  }

  return {
    groups,
    items,
    isComplete,
    badges,
    completedWeighted,
    weightedTotal: weighted.length,
  };
}
