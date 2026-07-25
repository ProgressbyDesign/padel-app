import { isSupportedCountry } from "@/lib/venueEditorOptions";
import { APPLICATION_COUNTRIES } from "@/lib/coachProfileApplication/constants";

export const MAX_COACH_LOCATIONS = 10;

export type CoachLocationRow = {
  id: string;
  coach_id: string;
  country: string;
  city: string;
  is_primary: boolean;
  created_at: string;
};

export function normalizeLocationCity(city: string): string {
  return city.trim().replace(/\s+/g, " ");
}

export function normalizeLocationCountry(country: string): string {
  return country.trim();
}

export function isAllowedCoachLocationCountry(country: string): boolean {
  return (
    isSupportedCountry(country) ||
    (APPLICATION_COUNTRIES as readonly string[]).includes(country)
  );
}

export function locationMutationErrorMessage(
  error: { code?: string; message?: string; details?: string; hint?: string } | null,
  fallback = "That location change could not be completed."
): string {
  if (!error) return fallback;
  const blob = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  if (error.code === "23505" || blob.includes("duplicate") || blob.includes("unique")) {
    return "This country and city is already on your profile.";
  }
  if (blob.includes("primary")) {
    return "Only one primary location is allowed. Choose another primary first.";
  }
  if (blob.includes("country") || blob.includes("supported")) {
    return "Choose a supported launch country.";
  }
  return fallback;
}

export function formatCoachLocationLabel(location: {
  city: string;
  country: string;
}): string {
  return [location.city, location.country].filter(Boolean).join(", ");
}

export function sortCoachLocations(
  locations: CoachLocationRow[]
): CoachLocationRow[] {
  return [...locations].sort((left, right) => {
    if (left.is_primary !== right.is_primary) {
      return left.is_primary ? -1 : 1;
    }
    return left.created_at.localeCompare(right.created_at);
  });
}
