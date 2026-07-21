"use server";

import { revalidatePath } from "next/cache";
import { parseStructuredOpeningHoursJson } from "@/lib/openingHours";
import { isValidVenueId } from "@/lib/queries/managedVenue";
import { createClient } from "@/lib/supabase/server";
import {
  isCourtTypeValue,
  isSupportedCountry,
  isVenueTypeValue,
} from "@/lib/venueEditorOptions";
import type {
  VenueFormField,
  VenueFormValues,
  VenueUpdateState,
} from "@/lib/venueManagement";

const MAX_COURTS = 100;

function rawText(formData: FormData, field: VenueFormField): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function valuesFromForm(formData: FormData): VenueFormValues {
  return {
    name: rawText(formData, "name"),
    address: rawText(formData, "address"),
    city: rawText(formData, "city"),
    country: rawText(formData, "country"),
    phone: rawText(formData, "phone"),
    website: rawText(formData, "website"),
    venue_type: rawText(formData, "venue_type"),
    courts: rawText(formData, "courts"),
    court_type: rawText(formData, "court_type"),
    coaching_available: formData.get("coaching_available") === "true",
    coaching_description: rawText(formData, "coaching_description"),
    price: rawText(formData, "price"),
    opening_hours_structured: rawText(
      formData,
      "opening_hours_structured"
    ),
  };
}

function optional(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function validateLength(
  values: VenueFormValues,
  field: VenueFormField,
  label: string,
  maximum: number,
  errors: Partial<Record<VenueFormField, string>>
) {
  if (typeof values[field] === "string" && values[field].trim().length > maximum) {
    errors[field] = `${label} must be ${maximum} characters or fewer.`;
  }
}

function validateHttpUrl(
  value: string,
  field: "website",
  label: string,
  errors: Partial<Record<VenueFormField, string>>
) {
  const normalized = value.trim();
  if (!normalized) return;
  if (normalized.length > 2048) {
    errors[field] = `${label} is too long.`;
    return;
  }

  try {
    const url = new URL(normalized);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      errors[field] = `${label} must be a valid http or https URL.`;
    }
  } catch {
    errors[field] = `${label} must be a valid http or https URL.`;
  }
}

function validate(values: VenueFormValues) {
  const fieldErrors: Partial<Record<VenueFormField, string>> = {};

  if (!values.name.trim()) fieldErrors.name = "Venue name is required.";
  if (!values.city.trim()) fieldErrors.city = "City is required.";
  if (!isSupportedCountry(values.country)) {
    fieldErrors.country = "Choose a supported country.";
  }
  if (!isCourtTypeValue(values.court_type)) {
    fieldErrors.court_type = "Choose Indoor, Outdoor, or both.";
  }
  if (!isVenueTypeValue(values.venue_type)) {
    fieldErrors.venue_type = "Choose a supported venue type.";
  }

  validateLength(values, "name", "Venue name", 120, fieldErrors);
  validateLength(values, "address", "Address", 300, fieldErrors);
  validateLength(values, "city", "City", 100, fieldErrors);
  validateLength(values, "phone", "Phone number", 40, fieldErrors);
  validateLength(
    values,
    "coaching_description",
    "Coaching description",
    1200,
    fieldErrors
  );
  validateLength(values, "price", "Price information", 120, fieldErrors);
  validateHttpUrl(values.website, "website", "Website", fieldErrors);

  const openingHoursResult = parseStructuredOpeningHoursJson(
    values.opening_hours_structured
  );
  if (!openingHoursResult.ok) {
    fieldErrors.opening_hours_structured = openingHoursResult.error;
  }

  const courtsText = values.courts.trim();
  let courts: number | null = null;
  if (courtsText) {
    const parsed = Number(courtsText);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_COURTS) {
      fieldErrors.courts = `Courts must be a whole number from 0 to ${MAX_COURTS}.`;
    } else {
      courts = parsed;
    }
  }

  return {
    fieldErrors,
    courts,
    openingHours: openingHoursResult.ok ? openingHoursResult.value : null,
  };
}

function failedState(
  previousState: VenueUpdateState,
  values: VenueFormValues,
  message: string,
  fieldErrors: Partial<Record<VenueFormField, string>> = {}
): VenueUpdateState {
  return {
    status: "error",
    message,
    fieldErrors,
    values,
    revision: previousState.revision + 1,
  };
}

export async function updateManagedVenueAction(
  venueId: string,
  previousState: VenueUpdateState,
  formData: FormData
): Promise<VenueUpdateState> {
  const values = valuesFromForm(formData);

  if (!isValidVenueId(venueId)) {
    return failedState(
      previousState,
      values,
      "You do not have permission to update this venue."
    );
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return failedState(previousState, values, "Your session has expired. Log in again.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("venue_memberships")
    .select("venue_id")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError || !membership) {
    return failedState(
      previousState,
      values,
      "You do not have permission to update this venue."
    );
  }

  const { fieldErrors, courts, openingHours } = validate(values);
  if (Object.keys(fieldErrors).length > 0) {
    return failedState(
      previousState,
      values,
      "Check the highlighted fields and try again.",
      fieldErrors
    );
  }
  if (!openingHours) {
    return failedState(
      previousState,
      values,
      "Check the opening hours and try again.",
      {
        opening_hours_structured:
          "Set valid opening hours for all seven days.",
      }
    );
  }

  const updatePayload = {
    name: values.name.trim(),
    address: optional(values.address),
    city: values.city.trim(),
    country: values.country,
    phone: optional(values.phone),
    website: optional(values.website),
    venue_type: values.venue_type,
    courts,
    court_type: values.court_type,
    coaching_available: values.coaching_available,
    coaching_description: optional(values.coaching_description),
    price: optional(values.price),
    opening_hours_structured: openingHours,
  };

  const { data: updatedVenue, error: updateError } = await supabase
    .from("venues")
    .update(updatePayload)
    .eq("id", venueId)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedVenue) {
    return failedState(
      previousState,
      values,
      "The venue could not be updated. Check your access and try again."
    );
  }

  const normalizedValues: VenueFormValues = {
    name: updatePayload.name,
    address: updatePayload.address ?? "",
    city: updatePayload.city,
    country: updatePayload.country,
    phone: updatePayload.phone ?? "",
    website: updatePayload.website ?? "",
    venue_type: updatePayload.venue_type,
    courts: updatePayload.courts === null ? "" : String(updatePayload.courts),
    court_type: updatePayload.court_type,
    coaching_available: updatePayload.coaching_available,
    coaching_description: updatePayload.coaching_description ?? "",
    price: updatePayload.price ?? "",
    opening_hours_structured: JSON.stringify(
      updatePayload.opening_hours_structured
    ),
  };

  revalidatePath(`/account/venues/${venueId}`);
  revalidatePath(`/account/venues/${venueId}/details`);
  revalidatePath(`/venue/${venueId}`);
  revalidatePath("/account");

  return {
    status: "success",
    message: "Venue information saved.",
    fieldErrors: {},
    values: normalizedValues,
    revision: previousState.revision + 1,
  };
}
