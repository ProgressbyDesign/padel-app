import type { PostgrestError } from "@supabase/supabase-js";

const STALE_SLOT =
  "This time is no longer available. Please choose another session.";
const DUPLICATE =
  "You have already requested this session.";
const RELATIONSHIP_UNAVAILABLE =
  "This coach is no longer accepting requests at this venue.";
const OVERLAP_ACCEPT =
  "This time has already been confirmed for another session.";
const STALE_ACCEPT =
  "This slot is no longer available in your schedule.";
const HISTORICAL =
  "This request can no longer be changed.";
const AUTH =
  "Please sign in again to continue.";
const GENERIC = "That booking change could not be completed.";

export function bookingMutationErrorMessage(
  error: PostgrestError | null | undefined,
  fallback = GENERIC
): string {
  if (!error) return fallback;

  if (process.env.NODE_ENV === "development") {
    console.error("[coach_booking_requests]", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }

  const blob = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();

  if (blob.includes("auth") || blob.includes("jwt") || blob.includes("session")) {
    return AUTH;
  }
  if (
    blob.includes("duplicate") ||
    blob.includes("already requested") ||
    (error.code === "23505" && blob.includes("request"))
  ) {
    return DUPLICATE;
  }
  if (
    blob.includes("overlap") ||
    blob.includes("exclude") ||
    error.code === "23P01"
  ) {
    return OVERLAP_ACCEPT;
  }
  if (
    blob.includes("no longer available") ||
    blob.includes("not available") ||
    blob.includes("slot") ||
    blob.includes("availability")
  ) {
    if (blob.includes("accept") || blob.includes("schedule")) return STALE_ACCEPT;
    return STALE_SLOT;
  }
  if (
    blob.includes("relationship") ||
    blob.includes("public") ||
    blob.includes("active")
  ) {
    return RELATIONSHIP_UNAVAILABLE;
  }
  if (
    blob.includes("historical") ||
    blob.includes("cannot be changed") ||
    blob.includes("immutable")
  ) {
    return HISTORICAL;
  }

  return fallback;
}

export const BOOKING_ERROR_COPY = {
  STALE_SLOT,
  DUPLICATE,
  RELATIONSHIP_UNAVAILABLE,
  OVERLAP_ACCEPT,
  STALE_ACCEPT,
  HISTORICAL,
  AUTH,
} as const;
