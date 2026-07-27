"use server";

import { revalidatePath } from "next/cache";
import {
  isValidSlotDuration,
} from "@/lib/coachAvailability/constants";
import { availabilityMutationErrorMessage } from "@/lib/coachAvailability/errors";
import {
  parseOptionalMoneyPair,
  validateSessionOverrideMinor,
} from "@/lib/coachAvailability/pricing";
import type { AvailabilityActionResult } from "@/lib/coachAvailability/types";
import {
  compareHm,
  isValidDateYmd,
  isValidIanaTimeZone,
  isValidTimeHm,
  minutesBetweenHm,
  zonedLocalToUtc,
} from "@/lib/coachAvailability/timezone";
import { getAdminAccount } from "@/lib/auth/adminSession";
import {
  loadActiveCoachVenueForPair,
  loadAvailabilitySettings,
} from "@/lib/queries/coachAvailability";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";

async function authorizeCoachOrAdmin(coachId: string): Promise<string | null> {
  if (!isValidCoachId(coachId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;

  const admin = await getAdminAccount();
  if (admin) return userId;

  const { data: membership, error: membershipError } = await supabase
    .from("coach_memberships")
    .select("coach_id")
    .eq("coach_id", coachId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError || !membership) return null;
  return userId;
}

async function requireActiveRelationship(coachId: string, relationshipId: string) {
  return loadActiveCoachVenueForPair(coachId, relationshipId);
}

function revalidateAvailability(
  coachId: string,
  venueId: string,
  relationshipId: string
) {
  revalidatePath("/account");
  revalidatePath(`/account/coaches/${coachId}`);
  revalidatePath(`/account/coaches/${coachId}/availability`);
  revalidatePath(`/account/coaches/${coachId}/availability/${relationshipId}`);
  revalidatePath(`/account/venues/${venueId}`);
  revalidatePath(`/account/venues/${venueId}/schedule`);
  revalidatePath(`/account/venues/${venueId}/sessions`);
  revalidatePath(`/account/venues/${venueId}/coaches`);
  revalidatePath(`/account/venues/${venueId}/coaches/${coachId}/availability`);
  revalidatePath(`/coach/${coachId}`);
  revalidatePath(`/book/coach/${coachId}`);
  revalidatePath(`/venue/${venueId}`);
  revalidatePath("/admin/relationships");
}

export async function saveCoachAvailabilitySettings(input: {
  coachId: string;
  relationshipId: string;
  timezone: string;
  defaultSlotDurationMinutes: number;
  isPublic: boolean;
  currency: string;
  defaultHourlyRate: string;
}): Promise<AvailabilityActionResult> {
  const userId = await authorizeCoachOrAdmin(input.coachId);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };

  const relationship = await requireActiveRelationship(
    input.coachId,
    input.relationshipId
  );
  if (!relationship) {
    return {
      ok: false,
      message: "Availability can only be edited for active venue relationships.",
    };
  }

  if (!isValidIanaTimeZone(input.timezone)) {
    return { ok: false, message: "Choose a valid IANA timezone." };
  }
  if (!isValidSlotDuration(input.defaultSlotDurationMinutes)) {
    return {
      ok: false,
      message: "Choose a session duration between 15 and 240 minutes in 15-minute steps.",
    };
  }

  const pricing = parseOptionalMoneyPair({
    currency: input.currency,
    amount: input.defaultHourlyRate,
  });
  if (!pricing.ok) {
    return { ok: false, message: pricing.message };
  }

  const payload = {
    coach_venue_id: input.relationshipId,
    timezone: input.timezone,
    default_slot_duration_minutes: input.defaultSlotDurationMinutes,
    is_public: input.isPublic,
    currency: pricing.currency,
    default_hourly_rate_minor: pricing.minor,
  };

  const supabase = await createClient();
  const existing = await loadAvailabilitySettings(input.relationshipId);
  const { error } = existing
    ? await supabase
        .from("coach_venue_availability_settings")
        .update({
          timezone: payload.timezone,
          default_slot_duration_minutes: payload.default_slot_duration_minutes,
          is_public: payload.is_public,
          currency: payload.currency,
          default_hourly_rate_minor: payload.default_hourly_rate_minor,
        })
        .eq("coach_venue_id", input.relationshipId)
    : await supabase.from("coach_venue_availability_settings").insert(payload);

  if (error) {
    return { ok: false, message: availabilityMutationErrorMessage(error) };
  }

  revalidateAvailability(
    input.coachId,
    relationship.venueId,
    input.relationshipId
  );
  return { ok: true, message: "Availability settings saved." };
}

/** Publish an existing schedule without changing timezone, duration, or pricing. */
export async function makeCoachAvailabilityPublic(input: {
  coachId: string;
  relationshipId: string;
}): Promise<AvailabilityActionResult> {
  const userId = await authorizeCoachOrAdmin(input.coachId);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };

  const relationship = await requireActiveRelationship(
    input.coachId,
    input.relationshipId
  );
  if (!relationship) {
    return {
      ok: false,
      message: "Availability can only be edited for active venue relationships.",
    };
  }

  const existing = await loadAvailabilitySettings(input.relationshipId);
  if (!existing) {
    return {
      ok: false,
      message: "Set up availability settings before making them public.",
    };
  }
  if (existing.is_public) {
    return { ok: true, message: "Availability is already public." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_venue_availability_settings")
    .update({ is_public: true })
    .eq("coach_venue_id", input.relationshipId);

  if (error) {
    return { ok: false, message: availabilityMutationErrorMessage(error) };
  }

  revalidateAvailability(
    input.coachId,
    relationship.venueId,
    input.relationshipId
  );
  return { ok: true, message: "Availability is now public." };
}

function validateRuleFields(input: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  validFrom: string;
  validUntil: string | null;
}): string | null {
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 1 || input.dayOfWeek > 7) {
    return "Choose a valid day of the week.";
  }
  if (!isValidTimeHm(input.startTime) || !isValidTimeHm(input.endTime)) {
    return "Enter valid start and end times.";
  }
  if (compareHm(input.startTime, input.endTime) >= 0) {
    return "End time must be after start time.";
  }
  if (!isValidSlotDuration(input.slotDurationMinutes)) {
    return "Choose a valid session duration.";
  }
  if (minutesBetweenHm(input.startTime, input.endTime) < input.slotDurationMinutes) {
    return "The time window must fit at least one full session.";
  }
  if (!isValidDateYmd(input.validFrom)) {
    return "Choose a valid start date.";
  }
  if (input.validUntil) {
    if (!isValidDateYmd(input.validUntil)) {
      return "Choose a valid end date.";
    }
    if (input.validUntil < input.validFrom) {
      return "Valid until cannot be before valid from.";
    }
  }
  return null;
}

export async function createCoachAvailabilityRule(input: {
  coachId: string;
  relationshipId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  priceOverrideMinor?: number | null;
}): Promise<AvailabilityActionResult> {
  const userId = await authorizeCoachOrAdmin(input.coachId);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };

  const relationship = await requireActiveRelationship(
    input.coachId,
    input.relationshipId
  );
  if (!relationship) {
    return {
      ok: false,
      message: "Availability can only be edited for active venue relationships.",
    };
  }

  const validationError = validateRuleFields(input);
  if (validationError) return { ok: false, message: validationError };

  const priceOverrideMinor = input.priceOverrideMinor ?? null;
  const overrideError = validateSessionOverrideMinor(priceOverrideMinor);
  if (overrideError) return { ok: false, message: overrideError };

  const settings = await loadAvailabilitySettings(input.relationshipId);
  if (!settings) {
    return {
      ok: false,
      message: "Save availability settings before adding weekly hours.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("coach_availability_rules").insert({
    coach_venue_id: input.relationshipId,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    slot_duration_minutes: input.slotDurationMinutes,
    valid_from: input.validFrom,
    valid_until: input.validUntil,
    is_active: input.isActive,
    price_override_minor: priceOverrideMinor,
  });

  if (error) {
    return { ok: false, message: availabilityMutationErrorMessage(error) };
  }

  revalidateAvailability(
    input.coachId,
    relationship.venueId,
    input.relationshipId
  );
  return { ok: true, message: "Weekly hours added." };
}

export async function updateCoachAvailabilityRule(input: {
  coachId: string;
  relationshipId: string;
  ruleId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  priceOverrideMinor?: number | null;
}): Promise<AvailabilityActionResult> {
  const userId = await authorizeCoachOrAdmin(input.coachId);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };

  const relationship = await requireActiveRelationship(
    input.coachId,
    input.relationshipId
  );
  if (!relationship) {
    return {
      ok: false,
      message: "Availability can only be edited for active venue relationships.",
    };
  }

  const validationError = validateRuleFields(input);
  if (validationError) return { ok: false, message: validationError };

  const priceOverrideMinor = input.priceOverrideMinor ?? null;
  const overrideError = validateSessionOverrideMinor(priceOverrideMinor);
  if (overrideError) return { ok: false, message: overrideError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_availability_rules")
    .update({
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: input.endTime,
      slot_duration_minutes: input.slotDurationMinutes,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      is_active: input.isActive,
      price_override_minor: priceOverrideMinor,
    })
    .eq("id", input.ruleId)
    .eq("coach_venue_id", input.relationshipId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: availabilityMutationErrorMessage(error, "The rule could not be updated."),
    };
  }

  revalidateAvailability(
    input.coachId,
    relationship.venueId,
    input.relationshipId
  );
  return { ok: true, message: "Weekly hours updated." };
}

export async function deleteCoachAvailabilityRule(input: {
  coachId: string;
  relationshipId: string;
  ruleId: string;
}): Promise<AvailabilityActionResult> {
  const userId = await authorizeCoachOrAdmin(input.coachId);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };

  const relationship = await requireActiveRelationship(
    input.coachId,
    input.relationshipId
  );
  if (!relationship) {
    return {
      ok: false,
      message: "Availability can only be edited for active venue relationships.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_availability_rules")
    .delete()
    .eq("id", input.ruleId)
    .eq("coach_venue_id", input.relationshipId);

  if (error) {
    return { ok: false, message: availabilityMutationErrorMessage(error) };
  }

  revalidateAvailability(
    input.coachId,
    relationship.venueId,
    input.relationshipId
  );
  return { ok: true, message: "Weekly hours removed." };
}

export async function toggleCoachAvailabilityRule(input: {
  coachId: string;
  relationshipId: string;
  ruleId: string;
  isActive: boolean;
}): Promise<AvailabilityActionResult> {
  const userId = await authorizeCoachOrAdmin(input.coachId);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };

  const relationship = await requireActiveRelationship(
    input.coachId,
    input.relationshipId
  );
  if (!relationship) {
    return {
      ok: false,
      message: "Availability can only be edited for active venue relationships.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_availability_rules")
    .update({ is_active: input.isActive })
    .eq("id", input.ruleId)
    .eq("coach_venue_id", input.relationshipId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: availabilityMutationErrorMessage(error, "The rule could not be updated."),
    };
  }

  revalidateAvailability(
    input.coachId,
    relationship.venueId,
    input.relationshipId
  );
  return {
    ok: true,
    message: input.isActive ? "Weekly hours activated." : "Weekly hours paused.",
  };
}

export async function createCoachAvailabilityException(input: {
  coachId: string;
  relationshipId: string;
  exceptionType: "unavailable" | "available";
  dateYmd: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  slotDurationMinutes: number | null;
  priceOverrideMinor?: number | null;
}): Promise<AvailabilityActionResult> {
  const userId = await authorizeCoachOrAdmin(input.coachId);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };

  const relationship = await requireActiveRelationship(
    input.coachId,
    input.relationshipId
  );
  if (!relationship) {
    return {
      ok: false,
      message: "Availability can only be edited for active venue relationships.",
    };
  }

  const settings = await loadAvailabilitySettings(input.relationshipId);
  if (!settings) {
    return {
      ok: false,
      message: "Save availability settings before adding exceptions.",
    };
  }

  if (!isValidDateYmd(input.dateYmd)) {
    return { ok: false, message: "Choose a valid date." };
  }

  const startTime = input.allDay ? "00:00" : input.startTime;
  const endTime = input.allDay ? "23:59" : input.endTime;
  if (!isValidTimeHm(startTime) || !isValidTimeHm(endTime)) {
    return { ok: false, message: "Enter valid start and end times." };
  }
  if (compareHm(startTime, endTime) >= 0 && !input.allDay) {
    return { ok: false, message: "End time must be after start time." };
  }

  const priceOverrideMinor =
    input.exceptionType === "unavailable" ? null : (input.priceOverrideMinor ?? null);
  const overrideError = validateSessionOverrideMinor(priceOverrideMinor);
  if (overrideError) return { ok: false, message: overrideError };

  if (input.exceptionType === "unavailable") {
    if (input.slotDurationMinutes != null) {
      return {
        ok: false,
        message: "Time off does not use a session duration.",
      };
    }
  } else {
    if (
      input.slotDurationMinutes == null ||
      !isValidSlotDuration(input.slotDurationMinutes)
    ) {
      return {
        ok: false,
        message: "Extra availability requires a valid session duration.",
      };
    }
    if (minutesBetweenHm(startTime, endTime) < input.slotDurationMinutes) {
      return {
        ok: false,
        message: "The time window must fit at least one full session.",
      };
    }
  }

  let startsAt: Date;
  let endsAt: Date;
  try {
    startsAt = zonedLocalToUtc(input.dateYmd, startTime, settings.timezone);
    endsAt = input.allDay
      ? zonedLocalToUtc(
          input.dateYmd,
          "23:59",
          settings.timezone
        )
      : zonedLocalToUtc(input.dateYmd, endTime, settings.timezone);
    if (input.allDay) {
      // Inclusive end of day: add 59 seconds conceptually by using next minute exclusive
      endsAt = new Date(endsAt.getTime() + 60_000);
    }
  } catch {
    return { ok: false, message: "Unable to convert that date and time." };
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, message: "End time must be after start time." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("coach_availability_exceptions").insert({
    coach_venue_id: input.relationshipId,
    exception_type: input.exceptionType,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    slot_duration_minutes:
      input.exceptionType === "unavailable" ? null : input.slotDurationMinutes,
    price_override_minor: priceOverrideMinor,
  });

  if (error) {
    return { ok: false, message: availabilityMutationErrorMessage(error) };
  }

  revalidateAvailability(
    input.coachId,
    relationship.venueId,
    input.relationshipId
  );
  return {
    ok: true,
    message:
      input.exceptionType === "unavailable"
        ? "Time off added."
        : "Extra availability added.",
  };
}

export async function deleteCoachAvailabilityException(input: {
  coachId: string;
  relationshipId: string;
  exceptionId: string;
}): Promise<AvailabilityActionResult> {
  const userId = await authorizeCoachOrAdmin(input.coachId);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };

  const relationship = await requireActiveRelationship(
    input.coachId,
    input.relationshipId
  );
  if (!relationship) {
    return {
      ok: false,
      message: "Availability can only be edited for active venue relationships.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_availability_exceptions")
    .delete()
    .eq("id", input.exceptionId)
    .eq("coach_venue_id", input.relationshipId);

  if (error) {
    return { ok: false, message: availabilityMutationErrorMessage(error) };
  }

  revalidateAvailability(
    input.coachId,
    relationship.venueId,
    input.relationshipId
  );
  return { ok: true, message: "Exception removed." };
}
