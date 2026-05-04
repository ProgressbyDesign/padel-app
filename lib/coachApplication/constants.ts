/** Option lists and step metadata for the Join Padel Pathways application flow. */

export const JOIN_APPLICATION_DRAFT_KEY = "join_padel_pathways_application_draft";

export const STEP_SLUGS = [
  "business",
  "location",
  "services",
  "players",
  "pricing",
  "media",
  "partnership",
] as const;

export const STEP_LABELS = [
  "Business overview",
  "Location",
  "Services & offering",
  "Player fit",
  "Pricing & availability",
  "Media & credibility",
  "Leads & goals",
] as const;

export const TOTAL_STEPS = STEP_LABELS.length;

export const SERVICE_TYPES = [
  "Padel Coach (Individual)",
  "Padel Academy / Club",
  "Padel Holiday / Travel Operator",
] as const;

export const SERVICES_OFFERED_OPTIONS = [
  "1:1 Coaching",
  "Group Coaching",
  "Junior Programmes",
  "High Performance Training",
  "Beginner Courses",
  "Padel Holidays / Packages",
  "Tournaments / Camps",
] as const;

export const PLAYER_LEVELS = ["Beginner", "Intermediate", "Advanced", "Professional"] as const;

export const PLAYER_TYPES = [
  "Juniors",
  "Adults",
  "Competitive Players",
  "Social Players",
] as const;

export const PRICE_RANGES = ["£300–£500", "£500–£1,000", "£1,000–£2,000", "£2,000+"] as const;

export const AVAILABILITY_OPTIONS = ["Year-round", "Seasonal (please specify)"] as const;

export const LEAD_DELIVERY_OPTIONS = [
  "Direct introduction (email/WhatsApp)",
  "Receive player profiles first",
  "Both",
] as const;

export const PAID_LEADS_OPTIONS = [
  "Yes – Pay per lead",
  "Yes – Commission on bookings",
  "Not sure (open to discussion)",
  "No",
] as const;

export const MAIN_GOAL_OPTIONS = [
  "Get more international players",
  "Fill training camps",
  "Promote premium packages",
  "Build brand awareness",
] as const;

export const YES_NO = ["Yes", "No"] as const;
