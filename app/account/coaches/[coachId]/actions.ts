"use server";

import { revalidatePath } from "next/cache";
import {
  COACH_PROFILE_OUTCOME_OPTIONS,
  isPlayerLevelValue,
  type CoachDetailsField,
  type CoachDetailsFormValues,
  type CoachDetailsUpdateState,
} from "@/lib/coachManagement";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";

function optional(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

async function requireCoachMembership(coachId: string): Promise<string | null> {
  if (!isValidCoachId(coachId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("coach_memberships")
    .select("coach_id")
    .eq("coach_id", coachId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError || !membership) return null;
  return userId;
}

function validateValues(
  values: CoachDetailsFormValues
): Partial<Record<CoachDetailsField, string>> {
  const errors: Partial<Record<CoachDetailsField, string>> = {};
  const name = values.name.trim();
  const role = values.role.trim();
  const description = values.description.trim();
  const phone = values.phone.trim();
  const email = values.email.trim();

  if (!name || name.length < 2 || name.length > 120) {
    errors.name = "Name must be between 2 and 120 characters.";
  }
  if (role.length > 120) {
    errors.role = "Role must be 120 characters or fewer.";
  }
  if (description.length > 2000) {
    errors.description = "Description must be 2000 characters or fewer.";
  }
  if (phone && (phone.length < 5 || phone.length > 40)) {
    errors.phone = "Phone must be between 5 and 40 characters.";
  }
  if (email && (email.length < 5 || email.length > 160 || !email.includes("@"))) {
    errors.email = "Enter a valid public contact email, or leave it blank.";
  }

  if (values.experience_years.trim()) {
    const years = Number(values.experience_years);
    if (!Number.isInteger(years) || years < 0 || years > 60) {
      errors.experience_years = "Experience must be a whole number from 0 to 60.";
    }
  }

  if (values.price_from.trim()) {
    const price = Number(values.price_from);
    if (!Number.isInteger(price) || price < 0 || price > 10000) {
      errors.price_from = "Price must be a whole number from 0 to 10000.";
    }
  }

  const invalidLevels = values.player_levels.filter(
    (value) => !isPlayerLevelValue(value)
  );
  if (invalidLevels.length > 0) {
    errors.player_levels = "Remove unsupported player levels.";
  }

  const invalidOutcomes = values.outcomes.filter(
    (value) =>
      !COACH_PROFILE_OUTCOME_OPTIONS.some((option) => option.value === value)
  );
  if (invalidOutcomes.length > 0) {
    errors.outcomes = "Remove unsupported coaching outcomes.";
  }

  return errors;
}

function revalidateCoachPaths(coachId: string) {
  revalidatePath(`/account/coaches/${coachId}`);
  revalidatePath(`/account/coaches/${coachId}/details`);
  revalidatePath(`/coach/${coachId}`);
  revalidatePath("/coaches");
  revalidatePath("/account");
}

export async function updateManagedCoachDetailsAction(
  coachId: string,
  previousState: CoachDetailsUpdateState,
  formData: FormData
): Promise<CoachDetailsUpdateState> {
  const values: CoachDetailsFormValues = {
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? ""),
    description: String(formData.get("description") ?? ""),
    experience_years: String(formData.get("experience_years") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    travel_available: formData.get("travel_available") === "true",
    price_from: String(formData.get("price_from") ?? ""),
    audience_adults: formData.get("audience_adults") === "true",
    audience_juniors: formData.get("audience_juniors") === "true",
    player_levels: formData
      .getAll("player_levels")
      .map((value) => String(value))
      .filter(Boolean),
    outcomes: formData
      .getAll("outcomes")
      .map((value) => String(value))
      .filter(Boolean),
  };

  const baseState: CoachDetailsUpdateState = {
    ...previousState,
    values,
    revision: previousState.revision + 1,
  };

  const userId = await requireCoachMembership(coachId);
  if (!userId) {
    return {
      ...baseState,
      status: "error",
      message: "You do not have permission to edit this coach profile.",
      fieldErrors: {},
    };
  }

  const fieldErrors = validateValues(values);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ...baseState,
      status: "error",
      message: "Fix the highlighted fields before saving.",
      fieldErrors,
    };
  }

  const experienceRaw = values.experience_years.trim();
  const priceRaw = values.price_from.trim();
  const experienceYears = experienceRaw ? Number(experienceRaw) : null;
  const priceFrom = priceRaw ? Number(priceRaw) : null;
  const playerLevels = values.player_levels.filter(isPlayerLevelValue);

  const supabase = await createClient();
  const { error: coachError } = await supabase
    .from("coaches")
    .update({
      name: values.name.trim(),
      role: optional(values.role),
      description: optional(values.description),
      experience_years: experienceYears,
      phone: optional(values.phone),
      email: optional(values.email),
      travel_available: values.travel_available,
      price_from: priceFrom,
    })
    .eq("id", coachId);

  if (coachError) {
    return {
      ...baseState,
      status: "error",
      message: "We could not save the coach profile. Please try again.",
      fieldErrors: {},
    };
  }

  const { data: existingAttributes } = await supabase
    .from("coach_attributes")
    .select("id")
    .eq("coach_id", coachId)
    .maybeSingle();

  if (existingAttributes?.id) {
    const { error: attributeError } = await supabase
      .from("coach_attributes")
      .update({
        audience_adults: values.audience_adults,
        audience_juniors: values.audience_juniors,
        player_levels: playerLevels,
      })
      .eq("coach_id", coachId);

    if (attributeError) {
      return {
        ...baseState,
        status: "error",
        message: "Profile saved, but audience or level settings could not be updated.",
        fieldErrors: {},
      };
    }
  } else {
    const { error: attributeError } = await supabase
      .from("coach_attributes")
      .insert({
        coach_id: coachId,
        audience_adults: values.audience_adults,
        audience_juniors: values.audience_juniors,
        player_levels: playerLevels,
      });

    if (attributeError) {
      return {
        ...baseState,
        status: "error",
        message: "Profile saved, but audience or level settings could not be created.",
        fieldErrors: {},
      };
    }
  }

  const desiredOutcomes = COACH_PROFILE_OUTCOME_OPTIONS.filter((option) =>
    values.outcomes.includes(option.value)
  );

  const { data: existingOutcomes, error: outcomesLoadError } = await supabase
    .from("coach_outcomes")
    .select("id, outcome, outcome_key")
    .eq("coach_id", coachId);

  if (outcomesLoadError) {
    return {
      ...baseState,
      status: "error",
      message: "Profile saved, but coaching outcomes could not be updated.",
      fieldErrors: {},
    };
  }

  const existing = existingOutcomes ?? [];
  const desiredKeys = new Set<string>(
    desiredOutcomes.map((option) => option.value)
  );

  // Keep legacy free-text rows that are not mapped to controlled keys.
  const controlledExisting = existing.filter((row) => {
    const key = row.outcome_key ? String(row.outcome_key) : null;
    if (key) return true;
    const label = String(row.outcome).trim().toLowerCase();
    return COACH_PROFILE_OUTCOME_OPTIONS.some(
      (option) => option.label.toLowerCase() === label
    );
  });

  const toDelete = controlledExisting.filter((row) => {
    const key = row.outcome_key ? String(row.outcome_key) : null;
    if (key) return !desiredKeys.has(key);
    const label = String(row.outcome).trim().toLowerCase();
    const match = COACH_PROFILE_OUTCOME_OPTIONS.find(
      (option) => option.label.toLowerCase() === label
    );
    return match ? !desiredKeys.has(match.value) : false;
  });

  const existingKeys = new Set(
    controlledExisting
      .map((row) => {
        if (row.outcome_key) return String(row.outcome_key);
        const label = String(row.outcome).trim().toLowerCase();
        return (
          COACH_PROFILE_OUTCOME_OPTIONS.find(
            (option) => option.label.toLowerCase() === label
          )?.value ?? null
        );
      })
      .filter(Boolean) as string[]
  );

  const toInsert = desiredOutcomes.filter(
    (option) => !existingKeys.has(option.value)
  );

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("coach_outcomes")
      .delete()
      .eq("coach_id", coachId)
      .in(
        "id",
        toDelete.map((row) => row.id)
      );

    if (deleteError) {
      return {
        ...baseState,
        status: "error",
        message: "Profile saved, but coaching outcomes could not be updated.",
        fieldErrors: {},
      };
    }
  }

  // Sync outcome_key on remaining controlled rows that only have labels.
  for (const row of controlledExisting) {
    if (row.outcome_key) continue;
    const label = String(row.outcome).trim().toLowerCase();
    const match = COACH_PROFILE_OUTCOME_OPTIONS.find(
      (option) => option.label.toLowerCase() === label
    );
    if (!match || !desiredKeys.has(match.value)) continue;
    await supabase
      .from("coach_outcomes")
      .update({ outcome_key: match.value, outcome: match.label })
      .eq("id", row.id)
      .eq("coach_id", coachId);
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from("coach_outcomes").insert(
      toInsert.map((option) => ({
        coach_id: coachId,
        outcome: option.label,
        outcome_key: option.value,
      }))
    );

    if (insertError) {
      return {
        ...baseState,
        status: "error",
        message: "Profile saved, but coaching outcomes could not be updated.",
        fieldErrors: {},
      };
    }
  }

  revalidateCoachPaths(coachId);

  return {
    status: "success",
    message: "Coach details saved.",
    fieldErrors: {},
    revision: baseState.revision,
    values: {
      ...values,
      name: values.name.trim(),
      role: values.role.trim(),
      description: values.description.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      experience_years:
        experienceYears === null ? "" : String(experienceYears),
      price_from: priceFrom === null ? "" : String(priceFrom),
      player_levels: playerLevels,
      outcomes: values.outcomes.filter((value) =>
        COACH_PROFILE_OUTCOME_OPTIONS.some((option) => option.value === value)
      ),
    },
  };
}
