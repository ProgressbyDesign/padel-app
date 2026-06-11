export function joinDotLabels(labels: string[]): string {
  return labels.filter((label) => label.trim()).join(" \u00b7 ");
}

export function formatCoachAudienceLabel(audience: string[]): string | null {
  const normalized = audience.map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  const hasAdults = normalized.includes("adults");
  const hasJuniors = normalized.includes("juniors");

  if (hasAdults && hasJuniors) return "Adults & Juniors";
  if (hasAdults) return "Adults";
  if (hasJuniors) return "Juniors";
  return null;
}

export function buildCoachAttributeLabels(options: {
  audience?: string[];
  travelAvailable?: boolean;
  max?: number;
}): string[] {
  const max = options.max ?? 2;
  const labels: string[] = [];

  const audienceLabel = formatCoachAudienceLabel(options.audience ?? []);
  if (audienceLabel) labels.push(audienceLabel);
  if (options.travelAvailable) labels.push("Travels to you");

  return labels.slice(0, max);
}

function looksLikeOutcomeDescription(text: string): boolean {
  if (text.length > 48) return true;
  if (/[.!?]/.test(text) && text.split(/\s+/).length > 6) return true;
  return false;
}

/** Short outcome label for listing cards — never a long description. */
export function primaryCoachFocus(options: {
  outcomeTags?: string[];
  primaryOutcome?: string | null;
}): string {
  const fromTag = options.outcomeTags?.map((tag) => tag.trim()).find(Boolean);
  if (fromTag && !looksLikeOutcomeDescription(fromTag)) return fromTag;

  const primary = options.primaryOutcome?.trim();
  if (primary && !looksLikeOutcomeDescription(primary)) return primary;

  return "Padel coaching";
}

export function formatDistanceMiles(miles: number): string {
  if (miles === 1) return "1 mile away";
  return `${miles} miles away`;
}

export function formatVenueCourtsLabel(courts?: number | null): string | null {
  if (typeof courts !== "number" || courts <= 0 || Number.isNaN(courts)) return null;
  return `${courts} court${courts === 1 ? "" : "s"} available`;
}

export function buildVenueSecondaryAttributes(options: {
  coachingAvailable?: boolean | null;
  courtType?: string | null;
  max?: number;
}): string[] {
  const max = options.max ?? 2;
  const labels: string[] = [];

  if (options.coachingAvailable) labels.push("Coaching");

  const courtType = options.courtType?.trim();
  if (courtType) {
    const value = courtType.toLowerCase();
    if (value.includes("indoor")) labels.push("Indoor");
    else if (value.includes("outdoor")) labels.push("Outdoor");
    else labels.push(courtType);
  }

  return labels.slice(0, max);
}