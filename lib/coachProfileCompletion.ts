import { optionLabel, PLAYER_LEVELS } from "@/lib/coachProfileApplication/constants";
import { coachOutcomeLabel } from "@/lib/coachManagement";

export type CoachCompletionInput = {
  name: string | null;
  role: string | null;
  description: string | null;
  experience_years: number | null;
  phone: string | null;
  email: string | null;
  /** @deprecated Pricing is tracked via pricingConfigured (availability settings). */
  price_from?: number | null;
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
  pricingConfigured?: boolean;
  hasFutureSession?: boolean;
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

export type CompletionGroupScore = {
  id: "essential" | "trust" | "booking";
  title: string;
  percent: number;
  done: number;
  total: number;
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

const GROUP_WEIGHTS = {
  essential: 0.5,
  trust: 0.2,
  booking: 0.3,
} as const;

function groupPercent(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

const WEIGHT_PRIORITY: CompletionItem["weight"][] = [
  "essential",
  "trust",
  "booking",
  "optional",
];

const COMPLETION_ACTION_LABELS: Record<string, string> = {
  "name-role": "Add your name and role",
  description: "Write a coaching introduction",
  experience: "Add your experience",
  "primary-location": "Set a primary location",
  audiences: "Choose adults / juniors",
  "player-levels": "Select player levels",
  outcomes: "Add coaching outcomes",
  "primary-image": "Add a primary profile image",
  contact: "Add a public contact method",
  "trust-venue": "Connect a confirmed venue",
  socials: "Add a social link",
  achievements: "Add an achievement",
  "additional-image": "Add another profile image",
  "booking-venue": "Connect an active venue",
  availability: "Set up availability",
  pricing: "Configure pricing",
  "future-session": "Add a future session",
  core: "Add name, city and country",
  address: "Add an address",
  courts: "Add courts and court type",
  "venue-type": "Set venue type",
  hours: "Set opening hours",
  image: "Add a primary image",
  gallery: "Add gallery images",
  "coaching-desc": "Add a coaching description",
  coaches: "Connect active coaches",
  "coach-availability": "Make coach availability visible",
};

export function nextRecommendedCompletionItem(
  items: CompletionItem[]
): CompletionItem | null {
  for (const weight of WEIGHT_PRIORITY) {
    const next = items.find((item) => item.weight === weight && !item.done);
    if (next) return next;
  }
  return null;
}

export function completionItemActionLabel(item: CompletionItem): string {
  return COMPLETION_ACTION_LABELS[item.id] ?? `Improve: ${item.label}`;
}

export function computeCompletionScores(groups: CompletionGroup[]): {
  groupScores: CompletionGroupScore[];
  overallPercent: number;
} {
  const groupScores: CompletionGroupScore[] = groups.map((group) => {
    const done = group.items.filter((item) => item.done).length;
    const total = group.items.length;
    return {
      id: group.id,
      title: group.title,
      percent: groupPercent(done, total),
      done,
      total,
    };
  });

  const byId = Object.fromEntries(
    groupScores.map((score) => [score.id, score.percent])
  ) as Record<CompletionGroup["id"], number>;

  const overallPercent = Math.round(
    GROUP_WEIGHTS.essential * (byId.essential ?? 0) +
      GROUP_WEIGHTS.trust * (byId.trust ?? 0) +
      GROUP_WEIGHTS.booking * (byId.booking ?? 0)
  );

  return { groupScores, overallPercent };
}

export function buildCoachCompletion(
  coachId: string,
  input: CoachCompletionInput
): {
  groups: CompletionGroup[];
  items: CompletionItem[];
  groupScores: CompletionGroupScore[];
  overallPercent: number;
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
  const hasActiveVenue = input.activeVenueCount > 0;
  const pricingConfigured = Boolean(input.pricingConfigured);
  const hasFutureSession = Boolean(input.hasFutureSession);

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
      id: "trust-venue",
      label: "Active confirmed venue",
      done: hasActiveVenue,
      href: `${base}/venues`,
      weight: "trust",
    },
    {
      id: "socials",
      label: "Social link",
      done: input.socialCount > 0,
      href: `${base}/socials`,
      weight: "trust",
    },
    {
      id: "achievements",
      label: "Achievement",
      done: input.achievementCount > 0,
      href: `${base}/achievements`,
      weight: "trust",
    },
    {
      id: "additional-image",
      label: "Additional image",
      done: input.imageCount > 1,
      href: `${base}/images`,
      weight: "trust",
    },
    {
      id: "booking-venue",
      label: "Active venue",
      done: hasActiveVenue,
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
      id: "pricing",
      label: "Configured pricing",
      done: pricingConfigured,
      href: `${base}/availability`,
      weight: "booking",
    },
    {
      id: "future-session",
      label: "At least one future session",
      done: hasFutureSession,
      href: `${base}/availability`,
      weight: "booking",
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
      items: items.filter((item) => item.weight === "trust"),
    },
    {
      id: "booking",
      title: "Booking readiness",
      items: items.filter((item) => item.weight === "booking"),
    },
  ];

  const { groupScores, overallPercent } = computeCompletionScores(groups);

  const essential = groups.find((group) => group.id === "essential")!.items;
  const weighted = items.filter((item) => item.weight !== "optional");
  const completedEssential = essential.filter((item) => item.done).length;
  const completedWeighted = weighted.filter((item) => item.done).length;
  const isComplete =
    completedEssential === essential.length &&
    completedWeighted / weighted.length >= COMPLETE_THRESHOLD;

  const badges: CoachBadge[] = [];
  if (input.is_approved) badges.push({ id: "verified", label: "Verified coach" });
  if (isComplete) badges.push({ id: "complete", label: "Complete profile" });
  if (hasActiveVenue) {
    badges.push({ id: "venue_confirmed", label: "Venue confirmed" });
  }
  if (input.availabilityLive) {
    badges.push({ id: "availability_live", label: "Availability live" });
  }

  return {
    groups,
    items,
    groupScores,
    overallPercent,
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
  groupScores: CompletionGroupScore[];
  overallPercent: number;
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
      weight: "trust",
    },
    {
      id: "socials",
      label: "Social links",
      done: input.socialCount > 0,
      href: `${base}/socials`,
      weight: "trust",
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
      items: items.filter((item) => item.weight === "trust"),
    },
    {
      id: "booking",
      title: "Coach and booking readiness",
      items: items.filter((item) => item.weight === "booking"),
    },
  ];

  const { groupScores, overallPercent } = computeCompletionScores(groups);

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
    groupScores,
    overallPercent,
    isComplete,
    badges,
    completedWeighted,
    weightedTotal: weighted.length,
  };
}
