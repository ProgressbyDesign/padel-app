"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  saveCoachApplicationStepOne,
  saveCoachApplicationStepThree,
  setCoachApplicationStep,
  submitCoachApplication,
} from "@/app/account/applications/coach/actions";
import { replaceCoachApplicationLocations } from "@/app/account/applications/coach/location-actions";
import {
  ErrorSummary,
  RequiredIndicator,
  RequiredLegend,
  fieldAccessibility,
  focusFirstInvalidField,
} from "@/components/forms/FormField";
import WithdrawCoachApplicationButton from "@/components/account/applications/WithdrawCoachApplicationButton";
import {
  APPLICATION_COUNTRIES,
  AUDIENCES,
  CITY_SUGGESTIONS_BY_COUNTRY,
  COACH_APPLICATION_MODE_LABELS,
  COACH_APPLICATION_STEPS,
  COACH_APPLICATION_TOTAL_STEPS,
  COACHING_OUTCOMES,
  COACHING_ROLES,
  MAX_APPLICATION_LOCATIONS,
  PLAYER_LEVELS,
  type ApplicationCountry,
} from "@/lib/coachProfileApplication/constants";
import type {
  CoachApplicationLocationInput,
  CoachApplicationWithLocations,
} from "@/lib/coachProfileApplication/types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10";

const cardSelected =
  "border-primary bg-primary text-accent";
const cardIdle =
  "border-primary/15 bg-white text-primary hover:border-primary/30 hover:bg-surface";

type WizardProps = {
  initial: CoachApplicationWithLocations;
  verifiedEmail: string;
};

function emptyLocation(): CoachApplicationLocationInput {
  return { country: "Spain", city: "", is_primary: true };
}

export default function CoachApplicationWizard({
  initial,
  verifiedEmail,
}: WizardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(
    Math.min(Math.max(initial.application.current_step, 1), 4)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState(initial.application.full_name ?? "");
  const [phone, setPhone] = useState(initial.application.phone ?? "");
  const [coachingRole, setCoachingRole] = useState(
    initial.application.coaching_role ?? ""
  );
  const [coachingRoleOther, setCoachingRoleOther] = useState(
    initial.application.coaching_role_other ?? ""
  );
  const [experienceYears, setExperienceYears] = useState(
    initial.application.experience_years === null
      ? ""
      : String(initial.application.experience_years)
  );

  const [locations, setLocations] = useState<CoachApplicationLocationInput[]>(
    initial.locations.length > 0
      ? initial.locations.map((row) => ({
          country: row.country,
          city: row.city,
          is_primary: row.is_primary,
        }))
      : [emptyLocation()]
  );

  const [playerLevels, setPlayerLevels] = useState<string[]>(
    initial.application.player_levels
  );
  const [audiences, setAudiences] = useState<string[]>(
    initial.application.audiences
  );
  const [outcomes, setOutcomes] = useState<string[]>(
    initial.application.outcomes
  );
  const [description, setDescription] = useState(
    initial.application.description ?? ""
  );
  const [introductionEnabled, setIntroductionEnabled] = useState(
    Boolean(initial.application.description?.trim())
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(
    initial.application.status === "submitted" ||
      initial.application.status === "under_review" ||
      initial.application.status === "approved"
  );
  const [submittedAt, setSubmittedAt] = useState(
    initial.application.submitted_at
  );

  const stepMeta = COACH_APPLICATION_STEPS[step - 1];
  const progress = (step / COACH_APPLICATION_TOTAL_STEPS) * 100;

  function clearFeedback() {
    setMessage(null);
    setError(null);
    setFieldErrors({});
  }

  function toggleValue(
    values: string[],
    value: string,
    setter: (next: string[]) => void
  ) {
    setter(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value]
    );
  }

  function updateLocation(
    index: number,
    patch: Partial<CoachApplicationLocationInput>
  ) {
    setLocations((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    );
  }

  function setPrimaryLocation(index: number) {
    setLocations((rows) =>
      rows.map((row, rowIndex) => ({
        ...row,
        is_primary: rowIndex === index,
      }))
    );
  }

  function addLocation() {
    if (locations.length >= MAX_APPLICATION_LOCATIONS) return;
    setLocations((rows) => [
      ...rows,
      { country: "Spain", city: "", is_primary: rows.length === 0 },
    ]);
  }

  function removeLocation(index: number) {
    setLocations((rows) => {
      if (rows.length <= 1) return rows;
      const next = rows.filter((_, rowIndex) => rowIndex !== index);
      if (!next.some((row) => row.is_primary) && next[0]) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next;
    });
  }

  function goToStep(next: number) {
    clearFeedback();
    setStep(next);
    startTransition(async () => {
      await setCoachApplicationStep({
        applicationId: initial.application.id,
        step: next,
      });
      router.refresh();
    });
  }

  function saveStepOne(options: { nextStep?: number; exit?: boolean }) {
    clearFeedback();
    startTransition(async () => {
      const result = await saveCoachApplicationStepOne({
        applicationId: initial.application.id,
        values: {
          full_name: fullName,
          phone,
          coaching_role: coachingRole,
          coaching_role_other: coachingRoleOther,
          experience_years: experienceYears,
        },
        nextStep: options.nextStep,
        exit: options.exit,
      });
      if (result.status === "error") {
        setError(result.message);
        setFieldErrors(result.fieldErrors);
        focusFirstInvalidField(result.fieldErrors);
        return;
      }
      setMessage(result.message);
      if (options.exit) {
        router.push("/account/applications");
        router.refresh();
        return;
      }
      if (options.nextStep) setStep(options.nextStep);
      router.refresh();
    });
  }

  function saveStepTwo(options: {
    nextStep?: number;
    exit?: boolean;
    requireAtLeastOne?: boolean;
  }) {
    clearFeedback();
    startTransition(async () => {
      const result = await replaceCoachApplicationLocations({
        applicationId: initial.application.id,
        locations,
        nextStep: options.nextStep,
        exit: options.exit,
        requireAtLeastOne: options.requireAtLeastOne,
      });
      if (result.status === "error") {
        setError(result.message);
        setFieldErrors(result.fieldErrors);
        focusFirstInvalidField(result.fieldErrors);
        return;
      }
      setMessage(result.message);
      if (options.exit) {
        router.push("/account/applications");
        router.refresh();
        return;
      }
      if (options.nextStep) setStep(options.nextStep);
      router.refresh();
    });
  }

  function saveStepThree(options: { nextStep?: number; exit?: boolean }) {
    clearFeedback();
    startTransition(async () => {
      const result = await saveCoachApplicationStepThree({
        applicationId: initial.application.id,
        values: {
          player_levels: playerLevels,
          audiences,
          outcomes,
          description: introductionEnabled ? description : "",
        },
        nextStep: options.nextStep,
        exit: options.exit,
      });
      if (result.status === "error") {
        setError(result.message);
        setFieldErrors(result.fieldErrors);
        focusFirstInvalidField(result.fieldErrors);
        return;
      }
      setMessage(result.message);
      if (options.exit) {
        router.push("/account/applications");
        router.refresh();
        return;
      }
      if (options.nextStep) setStep(options.nextStep);
      router.refresh();
    });
  }

  function handleSubmit() {
    clearFeedback();
    startTransition(async () => {
      const result = await submitCoachApplication({
        applicationId: initial.application.id,
        termsAccepted,
        privacyAccepted,
      });
      if (result.status === "error") {
        setError(result.message);
        setFieldErrors(result.fieldErrors);
        focusFirstInvalidField(result.fieldErrors);
        return;
      }
      setSubmitted(true);
      setSubmittedAt(new Date().toISOString());
      setMessage(result.message);
      router.refresh();
    });
  }

  const duplicateLocationIndexes = (() => {
    const seen = new Map<string, number>();
    const dupes = new Set<number>();
    locations.forEach((location, index) => {
      const key = `${location.country.trim().toLowerCase()}::${location.city.trim().toLowerCase()}`;
      if (!location.city.trim()) return;
      const first = seen.get(key);
      if (first !== undefined) {
        dupes.add(first);
        dupes.add(index);
      } else {
        seen.set(key, index);
      }
    });
    return dupes;
  })();

  if (submitted) {
    const dateLabel = submittedAt
      ? new Date(submittedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Just now";
    const coachId = initial.application.coach_id;
    const isApproved = initial.application.status === "approved";

    return (
      <section className="rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          {isApproved ? "Application approved" : "Application submitted"}
        </p>
        <h2 className="mt-3 text-2xl text-primary">
          {isApproved
            ? "Your coach profile is ready to manage"
            : "Submitted — we will review shortly"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-primary/65">
          {isApproved
            ? "Approval seeds your coach profile from this application. Finish images, venues, and availability next."
            : `Submitted ${dateLabel}. We email updates to your verified account address. Editing is locked while under review.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {isApproved && coachId ? (
            <a
              href={`/account/coaches/${coachId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
            >
              Open coach profile
            </a>
          ) : null}
          <Link
            href="/account/personal"
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              isApproved && coachId
                ? "border border-primary/15 text-primary hover:bg-surface"
                : "bg-primary text-accent hover:bg-primary/90"
            }`}
          >
            Back to account
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {initial.application.application_mode === "claim_existing" &&
      initial.targetCoach ? (
        <section className="rounded-[24px] border border-primary/10 bg-surface/50 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
            {COACH_APPLICATION_MODE_LABELS.claim_existing}
          </p>
          <div className="mt-3 flex gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-primary/10">
              {initial.targetCoach.image_url ? (
                <Image
                  src={initial.targetCoach.image_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-primary">
                Claiming {initial.targetCoach.name || "coach profile"}
              </p>
              <p className="mt-1 text-sm text-primary/60">
                {[
                  initial.targetCoach.primaryLocation,
                  initial.targetCoach.venueName,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Existing public profile"}
              </p>
            </div>
          </div>
        </section>
      ) : null}
      {initial.application.status === "changes_requested" ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800/70">
            Changes requested
          </p>
          <p className="mt-2 text-sm leading-6">
            Update the highlighted feedback below, then resubmit from Review.
          </p>
          {initial.application.review_note ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
              {initial.application.review_note}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <WithdrawCoachApplicationButton
          applicationId={initial.application.id}
        />
      </div>
      <div className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
              Step {step} of {COACH_APPLICATION_TOTAL_STEPS}
            </p>
            <h2 className="mt-2 text-2xl text-primary">
              {stepMeta.label}
            </h2>
          </div>
        </div>
        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-primary/10"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={COACH_APPLICATION_TOTAL_STEPS}
          aria-valuenow={step}
          aria-label={`Step ${step} of ${COACH_APPLICATION_TOTAL_STEPS}`}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="mt-4 flex flex-wrap gap-2">
          {COACH_APPLICATION_STEPS.map((item) => (
            <li key={item.step}>
              <button
                type="button"
                disabled={pending}
                onClick={() => goToStep(item.step)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  item.step === step
                    ? "bg-primary text-accent"
                    : "bg-surface text-primary/65 hover:text-primary"
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {pending ? (
        <p className="rounded-xl border border-primary/10 bg-surface px-4 py-3 text-sm text-primary/70" role="status">
          Saving…
        </p>
      ) : null}
      <ErrorSummary errors={fieldErrors} title={error ?? undefined} />
      {error && Object.keys(fieldErrors).length === 0 ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {message && !pending ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {message}
        </p>
      ) : null}
      <RequiredLegend />

      {step === 1 ? (
        <section className="space-y-5 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-7">
          <label
            className="block text-sm font-medium text-primary"
            htmlFor="full_name"
          >
            Full name
            <RequiredIndicator />
            <input
              className={inputClass}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              {...fieldAccessibility("full_name", fieldErrors.full_name)}
            />
            {fieldErrors.full_name ? (
              <span
                id="full_name-error"
                className="mt-1.5 block text-sm text-red-700"
              >
                {fieldErrors.full_name}
              </span>
            ) : null}
          </label>

          <div>
            <p className="text-sm font-medium text-primary">Verified email</p>
            <p className="mt-1.5 rounded-xl border border-primary/10 bg-surface px-3.5 py-3 text-base text-primary/80">
              {verifiedEmail || "Not available"}
            </p>
            <p className="mt-1.5 text-xs text-primary/50">
              From your account — used for application updates.
            </p>
          </div>

          <label
            className="block text-sm font-medium text-primary"
            htmlFor="phone"
          >
            Phone
            <RequiredIndicator />
            <input
              className={inputClass}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              inputMode="tel"
              placeholder="+34 …"
              {...fieldAccessibility("phone", fieldErrors.phone)}
            />
            {fieldErrors.phone ? (
              <span id="phone-error" className="mt-1.5 block text-sm text-red-700">
                {fieldErrors.phone}
              </span>
            ) : null}
          </label>

          <fieldset id="coaching_role" tabIndex={-1}>
            <legend className="text-sm font-medium text-primary">
              Coaching role
              <RequiredIndicator />
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {COACHING_ROLES.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setCoachingRole(role.value)}
                  className={`rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition ${
                    coachingRole === role.value ? cardSelected : cardIdle
                  }`}
                  aria-pressed={coachingRole === role.value}
                >
                  {role.label}
                </button>
              ))}
            </div>
            {fieldErrors.coaching_role ? (
              <p id="coaching_role-error" className="mt-2 text-sm text-red-700">
                {fieldErrors.coaching_role}
              </p>
            ) : null}
          </fieldset>

          {coachingRole === "other" ? (
            <label
              className="block text-sm font-medium text-primary"
              htmlFor="coaching_role_other"
            >
              Describe your role
              <RequiredIndicator />
              <input
                className={inputClass}
                value={coachingRoleOther}
                onChange={(event) => setCoachingRoleOther(event.target.value)}
                {...fieldAccessibility(
                  "coaching_role_other",
                  fieldErrors.coaching_role_other
                )}
              />
              {fieldErrors.coaching_role_other ? (
                <span
                  id="coaching_role_other-error"
                  className="mt-1.5 block text-sm text-red-700"
                >
                  {fieldErrors.coaching_role_other}
                </span>
              ) : null}
            </label>
          ) : null}

          <label
            className="block text-sm font-medium text-primary"
            htmlFor="experience_years"
          >
            Years of coaching experience
            <RequiredIndicator />
            <input
              className={inputClass}
              type="number"
              min={0}
              max={60}
              value={experienceYears}
              onChange={(event) => setExperienceYears(event.target.value)}
              {...fieldAccessibility(
                "experience_years",
                fieldErrors.experience_years
              )}
            />
            {fieldErrors.experience_years ? (
              <span
                id="experience_years-error"
                className="mt-1.5 block text-sm text-red-700"
              >
                {fieldErrors.experience_years}
              </span>
            ) : null}
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => saveStepOne({ nextStep: 2 })}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save and continue"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => saveStepOne({ exit: true })}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save and exit"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-5 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-7">
          <p className="text-sm leading-6 text-primary/65">
            Add cities where you coach. Mark one as primary — it appears first on
            your public profile.
          </p>
          {fieldErrors.locations ? (
            <p className="text-sm text-red-700" role="alert">
              {fieldErrors.locations}
            </p>
          ) : null}
          {duplicateLocationIndexes.size > 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
              Duplicate city and country pairs are highlighted. Remove or change
              one before saving.
            </p>
          ) : null}

          <ul className="space-y-4">
            {locations.map((location, index) => {
              const country = location.country as ApplicationCountry;
              const suggestions =
                CITY_SUGGESTIONS_BY_COUNTRY[country] ?? [];
              const listId = `city-suggestions-${index}`;
              const isDuplicate = duplicateLocationIndexes.has(index);
              return (
                <li
                  key={`location-${index}`}
                  className={`rounded-2xl border p-4 ${
                    location.is_primary
                      ? "border-primary/30 bg-primary/[0.04]"
                      : isDuplicate
                        ? "border-amber-300 bg-amber-50/70"
                        : "border-primary/10 bg-surface/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-primary">
                      Location {index + 1}
                      {location.is_primary ? (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary/50">
                          Primary
                        </span>
                      ) : null}
                    </p>
                    {locations.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeLocation(index)}
                        className="text-sm font-semibold text-primary/60 transition hover:text-primary"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-primary">
                      Country
                      <select
                        className={inputClass}
                        value={location.country}
                        onChange={(event) =>
                          updateLocation(index, { country: event.target.value })
                        }
                        aria-invalid={Boolean(
                          fieldErrors[`locations.${index}.country`]
                        )}
                      >
                        {APPLICATION_COUNTRIES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      {fieldErrors[`locations.${index}.country`] ? (
                        <span className="mt-1.5 block text-sm text-red-700">
                          {fieldErrors[`locations.${index}.country`]}
                        </span>
                      ) : null}
                    </label>

                    <label className="block text-sm font-medium text-primary">
                      City
                      <input
                        className={inputClass}
                        value={location.city}
                        list={listId}
                        onChange={(event) =>
                          updateLocation(index, { city: event.target.value })
                        }
                        aria-invalid={Boolean(
                          fieldErrors[`locations.${index}.city`] || isDuplicate
                        )}
                      />
                      <datalist id={listId}>
                        {suggestions.map((city) => (
                          <option key={city} value={city} />
                        ))}
                      </datalist>
                      {fieldErrors[`locations.${index}.city`] ? (
                        <span className="mt-1.5 block text-sm text-red-700">
                          {fieldErrors[`locations.${index}.city`]}
                        </span>
                      ) : isDuplicate ? (
                        <span className="mt-1.5 block text-sm text-amber-800">
                          Same city and country as another location.
                        </span>
                      ) : null}
                    </label>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-primary/10 bg-white px-3.5 py-3 text-sm text-primary">
                    <input
                      type="radio"
                      className="mt-1"
                      name="primary-location"
                      checked={location.is_primary}
                      onChange={() => setPrimaryLocation(index)}
                    />
                    <span>
                      <span className="font-semibold">Use as primary location</span>
                      <span className="mt-0.5 block text-xs text-primary/55">
                        Shown first to players on your profile.
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {locations.length < MAX_APPLICATION_LOCATIONS ? (
            <button
              type="button"
              onClick={addLocation}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dashed border-primary/25 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
            >
              + Add another location
            </button>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => goToStep(1)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                saveStepTwo({ nextStep: 3, requireAtLeastOne: true })
              }
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-60"
            >
              Save and continue
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => saveStepTwo({ exit: true })}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface disabled:opacity-60"
            >
              Save and exit
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-6 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-7">
          <fieldset>
            <legend className="text-sm font-medium text-primary">
              Player levels
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {PLAYER_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  aria-pressed={playerLevels.includes(level.value)}
                  onClick={() =>
                    toggleValue(playerLevels, level.value, setPlayerLevels)
                  }
                  className={`rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
                    playerLevels.includes(level.value) ? cardSelected : cardIdle
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
            {fieldErrors.player_levels ? (
              <p className="mt-2 text-sm text-red-700">{fieldErrors.player_levels}</p>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-primary">Audiences</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {AUDIENCES.map((audience) => (
                <button
                  key={audience.value}
                  type="button"
                  aria-pressed={audiences.includes(audience.value)}
                  onClick={() =>
                    toggleValue(audiences, audience.value, setAudiences)
                  }
                  className={`rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
                    audiences.includes(audience.value) ? cardSelected : cardIdle
                  }`}
                >
                  {audience.label}
                </button>
              ))}
            </div>
            {fieldErrors.audiences ? (
              <p className="mt-2 text-sm text-red-700">{fieldErrors.audiences}</p>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-primary">
              Coaching outcomes
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {COACHING_OUTCOMES.map((outcome) => (
                <button
                  key={outcome.value}
                  type="button"
                  aria-pressed={outcomes.includes(outcome.value)}
                  onClick={() =>
                    toggleValue(outcomes, outcome.value, setOutcomes)
                  }
                  className={`rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition ${
                    outcomes.includes(outcome.value) ? cardSelected : cardIdle
                  }`}
                >
                  {outcome.label}
                </button>
              ))}
            </div>
            {fieldErrors.outcomes ? (
              <p className="mt-2 text-sm text-red-700">{fieldErrors.outcomes}</p>
            ) : null}
          </fieldset>

          <div>
            <p className="text-sm font-medium text-primary">
              Introduction{" "}
              <span className="font-normal text-primary/55">(optional)</span>
            </p>
            <p className="mt-1 text-xs text-primary/55">
              Style, session structure, and what players improve.
            </p>
            {!introductionEnabled ? (
              <button
                type="button"
                onClick={() => setIntroductionEnabled(true)}
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-dashed border-primary/25 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
              >
                Add an introduction
              </button>
            ) : (
              <div className="mt-3">
                <textarea
                  className={`${inputClass} min-h-36 resize-y`}
                  value={description}
                  maxLength={500}
                  onChange={(event) => setDescription(event.target.value)}
                  {...fieldAccessibility("description", fieldErrors.description)}
                />
                <span className="mt-1.5 block text-xs text-primary/50">
                  {Math.max(0, 500 - description.length)} characters remaining
                </span>
                {fieldErrors.description ? (
                  <span
                    id="description-error"
                    className="mt-1.5 block text-sm text-red-700"
                  >
                    {fieldErrors.description}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setIntroductionEnabled(false);
                    setDescription("");
                  }}
                  className="mt-3 text-sm font-semibold text-primary/65 transition hover:text-primary"
                >
                  Remove introduction
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => goToStep(2)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => saveStepThree({ nextStep: 4 })}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-60"
            >
              Save and continue
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => saveStepThree({ exit: true })}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface disabled:opacity-60"
            >
              Save and exit
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-5 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-7">
          <p className="text-sm leading-6 text-primary/65">
            Check everything below. After submit, your application is locked until
            review finishes.
          </p>
          <ReviewBlock
            title="About you"
            onEdit={() => goToStep(1)}
            lines={[
              `Application: ${
                COACH_APPLICATION_MODE_LABELS[
                  initial.application.application_mode
                ]
              }`,
              initial.application.application_mode === "claim_existing" &&
              initial.targetCoach
                ? `Claiming: ${initial.targetCoach.name || "coach profile"}`
                : null,
              `Name: ${fullName || "Not set"}`,
              `Email: ${verifiedEmail || "Not available"}`,
              `Phone: ${phone || "Not set"}`,
              `Role: ${
                COACHING_ROLES.find((role) => role.value === coachingRole)?.label ??
                "Not set"
              }`,
              coachingRole === "other" && coachingRoleOther
                ? `Other role: ${coachingRoleOther}`
                : null,
              `Experience: ${
                experienceYears ? `${experienceYears} years` : "Not set"
              }`,
            ]}
          />
          <ReviewBlock
            title="Locations"
            onEdit={() => goToStep(2)}
            lines={
              locations.length === 0
                ? ["No locations yet"]
                : [
                    ...locations.map(
                      (location) =>
                        `${location.city || "City"}, ${location.country}${
                          location.is_primary ? " — primary" : ""
                        }`
                    ),
                    duplicateLocationIndexes.size > 0
                      ? "Warning: duplicate city/country pairs still listed."
                      : null,
                  ]
            }
          />
          <ReviewBlock
            title="Coaching"
            onEdit={() => goToStep(3)}
            lines={[
              `Levels: ${
                playerLevels.length
                  ? playerLevels
                      .map(
                        (value) =>
                          PLAYER_LEVELS.find((level) => level.value === value)
                            ?.label ?? value
                      )
                      .join(", ")
                  : "None selected"
              }`,
              `Audiences: ${
                audiences.length
                  ? audiences
                      .map(
                        (value) =>
                          AUDIENCES.find((item) => item.value === value)?.label ??
                          value
                      )
                      .join(", ")
                  : "None selected"
              }`,
              `Outcomes: ${
                outcomes.length
                  ? outcomes
                      .map(
                        (value) =>
                          COACHING_OUTCOMES.find((item) => item.value === value)
                            ?.label ?? value
                      )
                      .join(", ")
                  : "None selected"
              }`,
              `Introduction: ${
                introductionEnabled && description.trim()
                  ? description
                  : "Not added (optional)"
              }`,
            ]}
          />

          <div className="space-y-3 rounded-2xl border border-primary/10 bg-surface/50 p-4">
            <label className="flex items-start gap-3 text-sm text-primary">
              <input
                type="checkbox"
                className="mt-1"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>
                I confirm that the information provided is accurate.
                {fieldErrors.terms ? (
                  <span className="mt-1 block text-red-700">{fieldErrors.terms}</span>
                ) : null}
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-primary">
              <input
                type="checkbox"
                className="mt-1"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
              />
              <span>
                I agree to the partner terms and privacy policy.
                <span className="mt-1 block text-xs text-primary/55">
                  Dedicated terms and privacy pages are not published yet. By
                  continuing you confirm you understand partner listing reviews
                  and how we use application details to contact you.
                </span>
                {fieldErrors.privacy ? (
                  <span className="mt-1 block text-red-700">
                    {fieldErrors.privacy}
                  </span>
                ) : null}
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => goToStep(3)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleSubmit}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-60"
            >
              Submit application
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => saveStepThree({ exit: true })}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface disabled:opacity-60"
            >
              Save and exit
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ReviewBlock({
  title,
  lines,
  onEdit,
}: {
  title: string;
  lines: Array<string | null>;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base text-primary">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-sm font-semibold text-primary/65 transition hover:text-primary"
        >
          Edit
        </button>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm leading-6 text-primary/75 whitespace-pre-wrap">
        {lines.filter(Boolean).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function StartCoachApplicationButton() {
  return (
    <Link
      href="/account/applications/coach"
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
    >
      Start coach application
    </Link>
  );
}
