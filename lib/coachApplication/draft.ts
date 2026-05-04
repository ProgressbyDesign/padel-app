import type { CoachApplicationSubmitPayload } from "./types";

/** Client-only draft (files kept in React state, not in localStorage). */
export type CoachApplicationDraft = {
  service_type: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  based_in: string;
  multiple_locations: string;
  locations_list: string;
  services_offered: string[];
  offering_description: string;
  player_levels: string[];
  player_types: string[];
  price_range: string;
  accommodation: string;
  full_packages: string;
  availability: string;
  seasonal_detail: string;
  capacity_per_week: string;
  website_url: string;
  social_links: string;
  achievements: string;
  special_offer: string;
  special_offer_detail: string;
  lead_delivery: string;
  paid_leads: string;
  main_goal: string;
};

export function emptyCoachApplicationDraft(): CoachApplicationDraft {
  return {
    service_type: "",
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    based_in: "",
    multiple_locations: "",
    locations_list: "",
    services_offered: [],
    offering_description: "",
    player_levels: [],
    player_types: [],
    price_range: "",
    accommodation: "",
    full_packages: "",
    availability: "",
    seasonal_detail: "",
    capacity_per_week: "",
    website_url: "",
    social_links: "",
    achievements: "",
    special_offer: "",
    special_offer_detail: "",
    lead_delivery: "",
    paid_leads: "",
    main_goal: "",
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export function mergeStoredCoachApplicationDraft(raw: unknown): CoachApplicationDraft {
  const base = emptyCoachApplicationDraft();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    service_type: str(o.service_type) || base.service_type,
    business_name: str(o.business_name) || base.business_name,
    contact_name: str(o.contact_name) || base.contact_name,
    email: str(o.email) || base.email,
    phone: str(o.phone) || base.phone,
    based_in: str(o.based_in) || base.based_in,
    multiple_locations: str(o.multiple_locations) || base.multiple_locations,
    locations_list: str(o.locations_list) || base.locations_list,
    services_offered: strArr(o.services_offered).length ? strArr(o.services_offered) : base.services_offered,
    offering_description: str(o.offering_description) || base.offering_description,
    player_levels: strArr(o.player_levels).length ? strArr(o.player_levels) : base.player_levels,
    player_types: strArr(o.player_types).length ? strArr(o.player_types) : base.player_types,
    price_range: str(o.price_range) || base.price_range,
    accommodation: str(o.accommodation) || base.accommodation,
    full_packages: str(o.full_packages) || base.full_packages,
    availability: str(o.availability) || base.availability,
    seasonal_detail: str(o.seasonal_detail) || base.seasonal_detail,
    capacity_per_week: str(o.capacity_per_week) || base.capacity_per_week,
    website_url: str(o.website_url) || base.website_url,
    social_links: str(o.social_links) || base.social_links,
    achievements: str(o.achievements) || base.achievements,
    special_offer: str(o.special_offer) || base.special_offer,
    special_offer_detail: str(o.special_offer_detail) || base.special_offer_detail,
    lead_delivery: str(o.lead_delivery) || base.lead_delivery,
    paid_leads: str(o.paid_leads) || base.paid_leads,
    main_goal: str(o.main_goal) || base.main_goal,
  };
}

export function draftHasMeaningfulInput(d: CoachApplicationDraft): boolean {
  const { services_offered, player_levels, player_types, ...rest } = d;
  if (services_offered.length || player_levels.length || player_types.length) return true;
  return Object.values(rest).some((v) => (typeof v === "string" ? v.trim().length > 0 : false));
}

function ynToBool(s: string): boolean {
  return s.trim().toLowerCase() === "yes";
}

export function draftToSubmitPayload(
  d: CoachApplicationDraft,
  media_attachments: CoachApplicationSubmitPayload["media_attachments"]
): CoachApplicationSubmitPayload {
  const seasonal =
    d.availability.trim() === "Seasonal (please specify)" ? d.seasonal_detail.trim() || null : null;

  return {
    service_type: d.service_type.trim(),
    business_name: d.business_name.trim(),
    contact_name: d.contact_name.trim(),
    email: d.email.trim(),
    phone: d.phone.trim(),
    based_in: d.based_in.trim(),
    operates_multiple_locations: ynToBool(d.multiple_locations),
    additional_locations:
      ynToBool(d.multiple_locations) && d.locations_list.trim() ? d.locations_list.trim() : null,
    services_offered: [...d.services_offered],
    offering_description: d.offering_description.trim(),
    player_levels: [...d.player_levels],
    player_types_specialty: [...d.player_types],
    price_range_per_week: d.price_range.trim(),
    accommodation_offered: ynToBool(d.accommodation),
    full_packages_offered: ynToBool(d.full_packages),
    availability_type: d.availability.trim(),
    seasonal_availability_detail: seasonal,
    capacity_per_week: d.capacity_per_week.trim(),
    website_url: d.website_url.trim() || null,
    social_media_links: d.social_links.trim() || null,
    media_attachments,
    achievements: d.achievements.trim() || null,
    special_offer_promoted: ynToBool(d.special_offer),
    special_offer_description:
      ynToBool(d.special_offer) && d.special_offer_detail.trim() ? d.special_offer_detail.trim() : null,
    lead_delivery_preference: d.lead_delivery.trim(),
    paid_leads_openness: d.paid_leads.trim(),
    main_goal: d.main_goal.trim(),
  };
}
