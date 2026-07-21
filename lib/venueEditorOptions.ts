export const SUPPORTED_COUNTRIES = [
  { value: "Spain", label: "Spain", code: "ES" },
  { value: "Italy", label: "Italy", code: "IT" },
  {
    value: "United Arab Emirates",
    label: "United Arab Emirates",
    code: "AE",
  },
  { value: "Sweden", label: "Sweden", code: "SE" },
  { value: "Germany", label: "Germany", code: "DE" },
  { value: "United Kingdom", label: "United Kingdom", code: "GB" },
  { value: "France", label: "France", code: "FR" },
  { value: "Netherlands", label: "Netherlands", code: "NL" },
  { value: "Portugal", label: "Portugal", code: "PT" },
  { value: "Belgium", label: "Belgium", code: "BE" },
] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number]["value"];

export const COURT_TYPE_VALUES = ["indoor", "outdoor", "mixed"] as const;
export type CourtTypeValue = (typeof COURT_TYPE_VALUES)[number];

export const VENUE_TYPE_OPTIONS = [
  {
    value: "casual_club",
    label: "Club & Social Venue",
    description:
      "A venue focused on recreational, community and social play.",
  },
  {
    value: "premium_training",
    label: "Training & Performance Venue",
    description:
      "A specialist venue focused on coaching, development and performance.",
  },
] as const;

export type VenueTypeValue = (typeof VENUE_TYPE_OPTIONS)[number]["value"];

export function isSupportedCountry(value: string): value is SupportedCountry {
  return SUPPORTED_COUNTRIES.some((option) => option.value === value);
}

export function isCourtTypeValue(value: string): value is CourtTypeValue {
  return (COURT_TYPE_VALUES as readonly string[]).includes(value);
}

export function isVenueTypeValue(value: string): value is VenueTypeValue {
  return VENUE_TYPE_OPTIONS.some((option) => option.value === value);
}
