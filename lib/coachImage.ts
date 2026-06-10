export const COACH_PLACEHOLDER_IMAGE = "/images/coach-placeholder.png";

/** Resolved coach image URL for display, falling back to the shared placeholder. */
export function coachDisplayImageUrl(url?: string | null): string {
  const trimmed = url?.trim();
  return trimmed || COACH_PLACEHOLDER_IMAGE;
}