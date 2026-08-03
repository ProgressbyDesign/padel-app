import {
  VENUE_APPLICATION_COUNTRIES,
  VENUE_APPLICATION_MODES,
  VENUE_RELATIONSHIPS,
  type VenueApplicationCountry,
  type VenueApplicationMode,
  type VenueRelationshipValue,
} from "./constants";

export type VenueRoleInput = {
  relationship_to_venue: string;
  phone: string;
};

export type VenueChoiceInput = {
  application_mode: string;
  target_venue_id: string;
  proposed_venue_name: string;
  proposed_country: string;
  proposed_city: string;
  proposed_address: string;
  proposed_website: string;
};

export type VenueConfirmationInput = {
  supporting_note: string;
};

function isMode(value: string): value is VenueApplicationMode {
  return VENUE_APPLICATION_MODES.some((option) => option.value === value);
}

function isRelationship(value: string): value is VenueRelationshipValue {
  return VENUE_RELATIONSHIPS.some((option) => option.value === value);
}

export function isVenueApplicationCountry(
  value: string
): value is VenueApplicationCountry {
  return (VENUE_APPLICATION_COUNTRIES as readonly string[]).includes(value);
}

export function isValidVenueUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function validateVenueRoleDraft(
  input: VenueRoleInput
): Record<string, string> {
  const errors: Record<string, string> = {};
  const phone = input.phone.trim();
  if (
    input.relationship_to_venue &&
    !isRelationship(input.relationship_to_venue)
  ) {
    errors.relationship_to_venue = "Choose a valid relationship.";
  }
  if (phone && (phone.length < 5 || phone.length > 40)) {
    errors.phone = "Phone must be between 5 and 40 characters.";
  }
  return errors;
}

export function validateVenueRoleForSubmit(
  input: VenueRoleInput
): Record<string, string> {
  const errors = validateVenueRoleDraft(input);
  if (!isRelationship(input.relationship_to_venue)) {
    errors.relationship_to_venue = "Tell us how you are connected to the venue.";
  }
  if (!input.phone.trim()) {
    errors.phone = "Enter a contact phone number.";
  }
  return errors;
}

export function validateVenueChoiceDraft(
  input: VenueChoiceInput
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.application_mode === "claim_existing") {
    errors.application_mode =
      "Public venue claiming is no longer available. Submit your venue details instead.";
    return errors;
  }
  if (input.application_mode && !isMode(input.application_mode)) {
    errors.application_mode = "Choose how you want to continue.";
  }

  if (input.application_mode === "create_new") {
    const name = input.proposed_venue_name.trim();
    const city = input.proposed_city.trim();
    const address = input.proposed_address.trim();
    const website = input.proposed_website.trim();

    if (name && (name.length < 2 || name.length > 160)) {
      errors.proposed_venue_name = "Venue name must be between 2 and 160 characters.";
    }
    if (
      input.proposed_country &&
      !isVenueApplicationCountry(input.proposed_country)
    ) {
      errors.proposed_country = "Choose a supported country.";
    }
    if (city && (city.length < 2 || city.length > 120)) {
      errors.proposed_city = "City must be between 2 and 120 characters.";
    }
    if (address && address.length > 240) {
      errors.proposed_address = "Address must be 240 characters or fewer.";
    }
    if (website) {
      if (website.length > 2048) {
        errors.proposed_website = "Website is too long.";
      } else {
        try {
          const url = new URL(website);
          if (url.protocol !== "http:" && url.protocol !== "https:") {
            errors.proposed_website = "Enter a valid http(s) website.";
          }
        } catch {
          errors.proposed_website = "Enter a valid website URL.";
        }
      }
    }
  }

  return errors;
}

export function validateVenueChoiceForSubmit(
  input: VenueChoiceInput
): Record<string, string> {
  const errors = validateVenueChoiceDraft(input);
  if (input.application_mode === "claim_existing") {
    errors.application_mode =
      "Public venue claiming is no longer available. Submit your venue details instead.";
    return errors;
  }
  if (input.application_mode !== "create_new") {
    errors.application_mode = "Submit your venue details to continue.";
  }
  if (input.application_mode === "create_new") {
    if (!input.proposed_venue_name.trim()) {
      errors.proposed_venue_name = "Enter the venue name.";
    }
    if (!isVenueApplicationCountry(input.proposed_country)) {
      errors.proposed_country = "Choose a supported country.";
    }
    if (!input.proposed_city.trim()) {
      errors.proposed_city = "Enter the city.";
    }
  }
  return errors;
}

export function validateVenueConfirmationDraft(
  input: VenueConfirmationInput
): Record<string, string> {
  const errors: Record<string, string> = {};
  const note = input.supporting_note.trim();
  if (note.length > 1000) {
    errors.supporting_note = "Supporting note must be 1000 characters or fewer.";
  }
  return errors;
}

export function parseVenueRolePayload(input: VenueRoleInput) {
  return {
    relationship_to_venue: isRelationship(input.relationship_to_venue)
      ? input.relationship_to_venue
      : null,
    phone: input.phone.trim() || null,
  };
}

export function parseVenueChoicePayload(input: VenueChoiceInput) {
  const mode = isMode(input.application_mode) ? input.application_mode : null;
  if (mode === "claim_existing") {
    // Rejected by validation for self-service; keep shape for type safety.
    return {
      application_mode: mode,
      target_venue_id: isValidVenueUuid(input.target_venue_id)
        ? input.target_venue_id
        : null,
      proposed_venue_name: null,
      proposed_country: null,
      proposed_city: null,
      proposed_address: null,
      proposed_website: null,
    };
  }
  if (mode === "create_new") {
    return {
      application_mode: mode,
      target_venue_id: null,
      proposed_venue_name: input.proposed_venue_name.trim() || null,
      proposed_country: isVenueApplicationCountry(input.proposed_country)
        ? input.proposed_country
        : null,
      proposed_city: input.proposed_city.trim() || null,
      proposed_address: input.proposed_address.trim() || null,
      proposed_website: input.proposed_website.trim() || null,
    };
  }
  return {
    application_mode: null,
    target_venue_id: null,
    proposed_venue_name: null,
    proposed_country: null,
    proposed_city: null,
    proposed_address: null,
    proposed_website: null,
  };
}
