import type { CoachApplicationSubmitPayload } from "./types";
import { AVAILABILITY_OPTIONS } from "./constants";
import type { CoachApplicationDraft } from "./draft";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCoachApplicationStep(step: number, d: CoachApplicationDraft): string | null {
  switch (step) {
    case 0: {
      if (!d.service_type.trim()) return "Please select the type of service you offer.";
      if (!d.business_name.trim()) return "Please enter your business or brand name.";
      if (!d.contact_name.trim()) return "Please enter a contact name.";
      if (!d.email.trim()) return "Please enter an email address.";
      if (!EMAIL_RE.test(d.email.trim())) return "Please enter a valid email address.";
      if (!d.phone.trim()) return "Please enter a phone number (WhatsApp preferred).";
      return null;
    }
    case 1: {
      if (!d.based_in.trim()) return "Please tell us where you are based (city, country).";
      if (!d.multiple_locations.trim()) return "Please indicate whether you operate in multiple locations.";
      if (d.multiple_locations === "Yes" && !d.locations_list.trim()) {
        return "Please list all locations.";
      }
      return null;
    }
    case 2: {
      if (!d.services_offered.length) return "Select at least one service you offer.";
      if (!d.offering_description.trim()) return "Please describe your offering.";
      return null;
    }
    case 3: {
      if (!d.player_levels.length) return "Select at least one player level you cater for.";
      if (!d.player_types.length) return "Select at least one player type you specialise in.";
      return null;
    }
    case 4: {
      if (!d.price_range.trim()) return "Please select a typical price range.";
      if (!d.accommodation.trim()) return "Please indicate if you offer accommodation.";
      if (!d.full_packages.trim()) return "Please indicate if you offer full packages.";
      if (!d.availability.trim()) return "Please select when you are available for international players.";
      if (d.availability === AVAILABILITY_OPTIONS[1] && !d.seasonal_detail.trim()) {
        return "Please specify your seasonal availability.";
      }
      if (!d.capacity_per_week.trim()) return "Please estimate how many players you can accommodate per week.";
      return null;
    }
    case 5:
      return null;
    case 6: {
      if (!d.special_offer.trim()) return "Please indicate if you would like to promote a special offer.";
      if (d.special_offer === "Yes" && !d.special_offer_detail.trim()) {
        return "Please describe your special offer.";
      }
      if (!d.lead_delivery.trim()) return "Please select how you would like to receive leads.";
      if (!d.paid_leads.trim()) return "Please tell us your openness to paid leads or bookings.";
      if (!d.main_goal.trim()) return "Please select your main goal for joining Padel Pathways.";
      return null;
    }
    default:
      return null;
  }
}

export function validateCoachApplicationPayload(p: CoachApplicationSubmitPayload): string | null {
  const fake: CoachApplicationDraft = {
    service_type: p.service_type,
    business_name: p.business_name,
    contact_name: p.contact_name,
    email: p.email,
    phone: p.phone,
    based_in: p.based_in,
    multiple_locations: p.operates_multiple_locations ? "Yes" : "No",
    locations_list: p.additional_locations ?? "",
    services_offered: p.services_offered,
    offering_description: p.offering_description,
    player_levels: p.player_levels,
    player_types: p.player_types_specialty,
    price_range: p.price_range_per_week,
    accommodation: p.accommodation_offered ? "Yes" : "No",
    full_packages: p.full_packages_offered ? "Yes" : "No",
    availability: p.availability_type,
    seasonal_detail: p.seasonal_availability_detail ?? "",
    capacity_per_week: p.capacity_per_week,
    website_url: p.website_url ?? "",
    social_links: p.social_media_links ?? "",
    achievements: p.achievements ?? "",
    special_offer: p.special_offer_promoted ? "Yes" : "No",
    special_offer_detail: p.special_offer_description ?? "",
    lead_delivery: p.lead_delivery_preference,
    paid_leads: p.paid_leads_openness,
    main_goal: p.main_goal,
  };
  for (let s = 0; s < 7; s++) {
    const err = validateCoachApplicationStep(s, fake);
    if (err) return err;
  }
  return null;
}
