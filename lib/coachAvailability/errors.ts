import type { PostgrestError } from "@supabase/supabase-js";

const OVERLAP_MESSAGE =
  "This time overlaps availability you already have at this or another venue.";
const GENERIC_MESSAGE = "That availability change could not be saved.";

export function availabilityMutationErrorMessage(
  error: PostgrestError | null | undefined,
  fallback = GENERIC_MESSAGE
): string {
  if (!error) return fallback;

  if (process.env.NODE_ENV === "development") {
    console.error("[coach_availability]", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }

  const blob = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();

  if (
    blob.includes("overlap") ||
    blob.includes("overlapping") ||
    blob.includes("exclude") ||
    error.code === "23P01" ||
    error.code === "23505"
  ) {
    return OVERLAP_MESSAGE;
  }

  if (blob.includes("timezone") || blob.includes("time zone")) {
    return "Choose a valid IANA timezone.";
  }

  if (blob.includes("slot") || blob.includes("duration")) {
    return "Choose a session duration between 15 and 240 minutes in 15-minute steps.";
  }

  if (blob.includes("active") && blob.includes("relationship")) {
    return "Availability can only be edited for active venue relationships.";
  }

  return fallback;
}
