/** Shared shape for enquiry form → server insert */
export type EnquirySubmitPayload = {
  coachId?: string | null;
  venueId?: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  age: number | null;
  nationality: string | null;
  current_location_country: string | null;
  current_location_city: string | null;
  playing_level: string | null;
  playing_duration: string | null;
  main_goals: string[];
  goals_detail: string | null;
  preferred_destinations: string[];
  preferred_duration: string | null;
  preferred_start_date: string | null;
  training_type: string | null;
  budget_range: string | null;
  accommodation: string | null;
  trained_abroad: string | null;
  injuries: string | null;
  anything_else: string | null;
  wants_personalised_recommendation: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEnquiryPayload(p: EnquirySubmitPayload): string | null {
  const name = p.full_name?.trim() ?? "";
  const email = p.email?.trim() ?? "";
  if (!name) return "Please enter your name.";
  if (!email) return "Please enter your email.";
  if (!EMAIL_RE.test(email)) return "Please enter a valid email address.";
  const hasCoach = Boolean(p.coachId?.trim());
  const hasVenue = Boolean(p.venueId?.trim());
  if (hasCoach === hasVenue) return "Missing coach or venue reference.";
  return null;
}

export function parseAge(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 120) return null;
  return n;
}
