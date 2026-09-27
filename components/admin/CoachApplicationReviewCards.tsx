"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import CoachApplicationReviewPanel from "./CoachApplicationReviewPanel";
import {
  updateCoachApplicationApplicantDetails,
  updateCoachApplicationLocations,
  updateCoachApplicationCoachingProfile,
} from "@/app/admin/(ops)/applications/coach-edit-actions";
import {
  APPLICATION_COUNTRIES,
  AUDIENCES,
  COACHING_OUTCOMES,
  COACHING_ROLES,
  MAX_APPLICATION_LOCATIONS,
  PLAYER_LEVELS,
  coachingRoleLabel,
  optionLabel,
} from "@/lib/coachProfileApplication/constants";
import {
  canEditCoachApplication,
  type CoachApplicationEditResult,
} from "@/lib/admin/coachApplicationEditing";
import type {
  CoachApplicationLocationInput,
  CoachApplicationLocationRow,
  CoachClaimTargetSummary,
  CoachProfileApplicationRow,
} from "@/lib/coachProfileApplication/types";
import type {
  StepOneInput,
  StepThreeInput,
} from "@/lib/coachProfileApplication/validation";

type Card = "applicant" | "locations" | "profile";
const inputClass =
  "mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-primary/20 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/20 px-4 py-2 text-sm font-semibold disabled:opacity-40";

export default function CoachApplicationReviewCards({
  application,
  locations,
  targetCoach,
  canReview,
  beforeCards,
  afterCards,
}: {
  application: CoachProfileApplicationRow;
  locations: CoachApplicationLocationRow[];
  targetCoach: CoachClaimTargetSummary | null;
  canReview: boolean;
  beforeCards: ReactNode;
  afterCards: ReactNode;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Card | null>(null);
  const [pending, startTransition] = useTransition();
  const [reviewPending, setReviewPending] = useState(false);
  const [result, setResult] = useState<CoachApplicationEditResult | null>(null);
  const [version, setVersion] = useState(application.updated_at);
  const [details, setDetails] = useState<StepOneInput>(() =>
    applicantDraft(application),
  );
  const [profile, setProfile] = useState<StepThreeInput>(() =>
    profileDraft(application),
  );
  const [locationDraft, setLocationDraft] =
    useState<CoachApplicationLocationInput[]>(locations);
  const editable = canReview && canEditCoachApplication(application.status);
  const errors = result?.fieldErrors ?? {};

  function edit(card: Card) {
    setDetails(applicantDraft(application));
    setProfile(profileDraft(application));
    setLocationDraft(
      locations.map(({ country, city, is_primary }) => ({
        country,
        city,
        is_primary,
      })),
    );
    setVersion(application.updated_at);
    setResult(null);
    setActive(card);
  }

  function cancel() {
    setActive(null);
    setResult(null);
    // Refresh stale server data without ever writing the discarded draft.
    startTransition(() => router.refresh());
  }

  function save() {
    const input = { applicationId: application.id, updatedAt: version };
    setResult(null);
    startTransition(async () => {
      try {
        const response =
          active === "applicant"
            ? await updateCoachApplicationApplicantDetails({
                ...input,
                details,
              })
            : active === "locations"
              ? await updateCoachApplicationLocations({
                  ...input,
                  locations: locationDraft,
                })
              : await updateCoachApplicationCoachingProfile({
                  ...input,
                  profile,
                });
        setResult(response);
        if (response.ok) {
          setActive(null);
          router.refresh();
        }
      } catch {
        setResult({
          ok: false,
          message:
            "The save could not finish. Your edits are still here; please try again.",
        });
      }
    });
  }

  function card(title: string, id: Card, read: ReactNode, form: ReactNode) {
    const editing = active === id;
    return (
      <section className="min-w-0 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl">{title}</h2>
          {editable && !editing ? (
            <button
              type="button"
              aria-label={`Edit ${title.toLowerCase()}`}
              disabled={active !== null || pending || reviewPending}
              onClick={() => edit(id)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-primary/60 hover:bg-surface focus-visible:ring-2 disabled:opacity-30"
            >
              <Pencil size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="mt-5">
          {editing ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
            >
              <fieldset disabled={pending} className="min-w-0 space-y-5">
                {form}
                {result && !result.ok ? (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
                  >
                    {result.message}
                  </p>
                ) : null}
                <div className="flex flex-col-reverse gap-3 border-t border-primary/10 pt-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={cancel}
                    className={buttonClass}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`${buttonClass} bg-primary text-accent`}
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                </div>
              </fieldset>
            </form>
          ) : (
            read
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        {beforeCards}
        {result?.ok ? (
          <p role="status" className="text-sm text-emerald-800">
            {result.message}
          </p>
        ) : null}
        {card(
          "Applicant details",
          "applicant",
          <dl className="grid gap-5 sm:grid-cols-2">
            <ReadField label="Full name" value={application.full_name} />
            <ReadField
              label="Account email"
              value={application.applicant_email}
            />
            <ReadField label="Phone" value={application.phone} />
            <ReadField
              label="Role"
              value={coachingRoleLabel(application.coaching_role)}
            />
            {application.coaching_role === "other" ? (
              <ReadField
                label="Other role"
                value={application.coaching_role_other}
              />
            ) : null}
            <ReadField
              label="Experience"
              value={
                application.experience_years === null
                  ? null
                  : `${application.experience_years} years`
              }
            />
          </dl>,
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.full_name}>
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={details.full_name}
                  onChange={(e) =>
                    setDetails({ ...details, full_name: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Phone" error={errors.phone}>
                <input
                  type="tel"
                  required
                  maxLength={40}
                  value={details.phone}
                  onChange={(e) =>
                    setDetails({ ...details, phone: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Coaching role" error={errors.coaching_role}>
                <select
                  required
                  value={details.coaching_role}
                  onChange={(e) =>
                    setDetails({ ...details, coaching_role: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Choose a role</option>
                  {COACHING_ROLES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Years of coaching experience"
                error={errors.experience_years}
              >
                <input
                  required
                  type="number"
                  min={0}
                  max={60}
                  step={1}
                  value={details.experience_years}
                  onChange={(e) =>
                    setDetails({ ...details, experience_years: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              {details.coaching_role === "other" ? (
                <Field
                  label="Other coaching role"
                  error={errors.coaching_role_other}
                >
                  <input
                    required
                    maxLength={100}
                    value={details.coaching_role_other}
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        coaching_role_other: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </Field>
              ) : null}
            </div>
            <dl>
              <ReadField
                label="Account email (read-only)"
                value={application.applicant_email}
              />
            </dl>
          </>,
        )}
        {card(
          "Locations",
          "locations",
          locations.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {locations.map((location) => (
                <li
                  key={location.id}
                  className="break-words rounded-xl border border-primary/10 bg-surface/50 p-4 text-sm"
                >
                  <span className="font-semibold">
                    {location.city}, {location.country}
                  </span>
                  {location.is_primary ? (
                    <span className="ml-2 text-xs text-primary/60">
                      Primary
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-primary/60">No locations supplied.</p>
          ),
          <>
            {locationDraft.map((location, index) => (
              <div
                key={index}
                className="grid min-w-0 gap-3 rounded-xl border border-primary/15 p-4 sm:grid-cols-2"
              >
                <Field
                  label={`Country ${index + 1}`}
                  error={errors[`locations.${index}.country`]}
                >
                  <select
                    required
                    value={location.country}
                    onChange={(e) =>
                      setLocationDraft(
                        locationDraft.map((row, i) =>
                          i === index
                            ? { ...row, country: e.target.value }
                            : row,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    <option value="">Choose a country</option>
                    {APPLICATION_COUNTRIES.map((country) => (
                      <option key={country}>{country}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={`City ${index + 1}`}
                  error={errors[`locations.${index}.city`]}
                >
                  <input
                    required
                    maxLength={120}
                    value={location.city}
                    onChange={(e) =>
                      setLocationDraft(
                        locationDraft.map((row, i) =>
                          i === index ? { ...row, city: e.target.value } : row,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </Field>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="primary-location"
                    checked={location.is_primary}
                    onChange={() =>
                      setLocationDraft(
                        locationDraft.map((row, i) => ({
                          ...row,
                          is_primary: i === index,
                        })),
                      )
                    }
                  />
                  Primary location
                </label>
                <button
                  type="button"
                  aria-label={`Remove location ${index + 1}`}
                  disabled={locationDraft.length === 1}
                  className={`${buttonClass} sm:justify-self-end`}
                  onClick={() =>
                    setLocationDraft((rows) => {
                      const remaining = rows.filter((_, i) => i !== index);
                      return remaining.map((row, i) => ({
                        ...row,
                        is_primary: location.is_primary
                          ? i === 0
                          : row.is_primary,
                      }));
                    })
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Remove
                </button>
              </div>
            ))}
            {errors.locations ? (
              <p role="alert" className="text-sm text-red-800">
                {errors.locations}
              </p>
            ) : null}
            <button
              type="button"
              className={buttonClass}
              disabled={locationDraft.length >= MAX_APPLICATION_LOCATIONS}
              onClick={() =>
                setLocationDraft([
                  ...locationDraft,
                  {
                    country: "",
                    city: "",
                    is_primary: locationDraft.length === 0,
                  },
                ])
              }
            >
              <Plus size={16} aria-hidden="true" />
              Add location
            </button>
          </>,
        )}
        {card(
          "Coaching profile",
          "profile",
          <dl className="space-y-5">
            <ReadField
              label="Player levels"
              value={application.player_levels
                .map((value) => optionLabel(PLAYER_LEVELS, value))
                .join(", ")}
            />
            <ReadField
              label="Audiences"
              value={application.audiences
                .map((value) => optionLabel(AUDIENCES, value))
                .join(", ")}
            />
            <ReadField
              label="Outcomes"
              value={application.outcomes
                .map((value) => optionLabel(COACHING_OUTCOMES, value))
                .join(", ")}
            />
            <ReadField label="Description" value={application.description} />
          </dl>,
          <>
            <Choices
              label="Player levels"
              options={PLAYER_LEVELS}
              values={profile.player_levels}
              error={errors.player_levels}
              onChange={(values) =>
                setProfile({ ...profile, player_levels: values })
              }
            />
            <Choices
              label="Audiences"
              options={AUDIENCES}
              values={profile.audiences}
              error={errors.audiences}
              onChange={(values) =>
                setProfile({ ...profile, audiences: values })
              }
            />
            <Choices
              label="Outcomes"
              options={COACHING_OUTCOMES}
              values={profile.outcomes}
              error={errors.outcomes}
              onChange={(values) =>
                setProfile({ ...profile, outcomes: values })
              }
            />
            <Field
              label="Introduction (optional, 40–500 characters)"
              error={errors.description}
            >
              <textarea
                rows={5}
                maxLength={500}
                value={profile.description}
                onChange={(e) =>
                  setProfile({ ...profile, description: e.target.value })
                }
                className={inputClass}
              />
            </Field>
          </>,
        )}
        {afterCards}
      </div>
      <div className="min-w-0">
        {active ? (
          <p className="mb-3 text-sm text-primary/65">
            Save or cancel your card edit before making a review decision.
          </p>
        ) : null}
        <fieldset disabled={active !== null || pending} className="min-w-0">
          <CoachApplicationReviewPanel
            application={application}
            targetCoach={targetCoach}
            onBusyChange={setReviewPending}
          />
        </fieldset>
      </div>
    </div>
  );
}

function applicantDraft(application: CoachProfileApplicationRow): StepOneInput {
  return {
    full_name: application.full_name ?? "",
    phone: application.phone ?? "",
    coaching_role: application.coaching_role ?? "",
    coaching_role_other: application.coaching_role_other ?? "",
    experience_years: application.experience_years?.toString() ?? "",
  };
}
function profileDraft(application: CoachProfileApplicationRow): StepThreeInput {
  return {
    player_levels: [...application.player_levels],
    audiences: [...application.audiences],
    outcomes: [...application.outcomes],
    description: application.description ?? "",
  };
}
function ReadField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/50">
        {label}
      </dt>
      <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-primary/80">
        {value || "—"}
      </dd>
    </div>
  );
}
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0 text-sm font-semibold">
      {label}
      {children}
      {error ? (
        <span
          role="alert"
          className="mt-1 block text-sm font-normal text-red-800"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}
function Choices({
  label,
  options,
  values,
  error,
  onChange,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  values: string[];
  error?: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 items-center gap-3 rounded-xl border border-primary/15 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...values, option.value]
                    : values.filter((value) => value !== option.value),
                )
              }
            />
            {option.label}
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
