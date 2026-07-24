import type { PostgrestError } from "@supabase/supabase-js";

const DUPLICATE_MESSAGE =
  "This coach and venue already have a current relationship or request.";
const PRIMARY_CONFLICT_MESSAGE =
  "Another venue is currently set as primary. Refresh and try again.";
const GENERIC_MESSAGE = "That relationship change could not be completed.";

/** Map known unique/check failures to safe UI copy. Logs codes server-side. */
export function coachVenueMutationErrorMessage(
  error: PostgrestError | null | undefined,
  fallback = GENERIC_MESSAGE
): string {
  if (!error) return fallback;

  const code = error.code ?? "";
  const details = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();

  if (process.env.NODE_ENV === "development") {
    console.error("[coach_venues]", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }

  if (code === "23505") {
    if (
      details.includes("primary") ||
      details.includes("is_primary") ||
      details.includes("one_primary")
    ) {
      return PRIMARY_CONFLICT_MESSAGE;
    }
    return DUPLICATE_MESSAGE;
  }

  if (
    details.includes("primary") &&
    (details.includes("unique") || details.includes("duplicate"))
  ) {
    return PRIMARY_CONFLICT_MESSAGE;
  }

  if (
    details.includes("duplicate") ||
    details.includes("already") ||
    details.includes("current")
  ) {
    return DUPLICATE_MESSAGE;
  }

  return fallback;
}
