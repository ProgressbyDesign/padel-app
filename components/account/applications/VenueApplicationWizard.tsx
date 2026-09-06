"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createVenueApplicationDraft,
  saveVenueApplicationConfirmation,
  saveVenueApplicationRole,
  saveVenueApplicationVenue,
  setVenueApplicationStep,
  submitVenueApplication,
} from "@/app/account/applications/venue/actions";
import {
  ErrorSummary,
  RequiredIndicator,
  RequiredLegend,
  fieldAccessibility,
  focusFirstInvalidField,
} from "@/components/forms/FormField";
import {
  VENUE_APPLICATION_COUNTRIES,
  VENUE_APPLICATION_STEPS,
  VENUE_APPLICATION_TOTAL_STEPS,
  VENUE_RELATIONSHIPS,
  venueApplicationModeLabel,
  venueRelationshipLabel,
} from "@/lib/venueProfileApplication/constants";
import type { VenueApplicationWithVenue } from "@/lib/venueProfileApplication/types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10";
const cardSelected = "border-primary bg-primary text-accent";
const cardIdle =
  "border-primary/15 bg-white text-primary hover:border-primary/30 hover:bg-surface";

type WizardProps = {
  initial: VenueApplicationWithVenue;
  verifiedEmail: string;
};

export default function VenueApplicationWizard({
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

  const [relationship, setRelationship] = useState(
    initial.application.relationship_to_venue ?? ""
  );
  const [phone, setPhone] = useState(initial.application.phone ?? "");
  const wasHistoricalClaim =
    initial.application.application_mode === "claim_existing";
  const [proposedName, setProposedName] = useState(
    initial.application.proposed_venue_name ??
      (wasHistoricalClaim ? initial.targetVenue?.name ?? "" : "")
  );
  const [proposedCountry, setProposedCountry] = useState<string>(
    initial.application.proposed_country ??
      initial.targetVenue?.country ??
      VENUE_APPLICATION_COUNTRIES[0]
  );
  const [proposedCity, setProposedCity] = useState(
    initial.application.proposed_city ??
      (wasHistoricalClaim ? initial.targetVenue?.city ?? "" : "")
  );
  const [proposedAddress, setProposedAddress] = useState(
    initial.application.proposed_address ?? ""
  );
  const [proposedWebsite, setProposedWebsite] = useState(
    initial.application.proposed_website ??
      (wasHistoricalClaim ? initial.targetVenue?.website ?? "" : "")
  );
  const [supportingNote, setSupportingNote] = useState(
    initial.application.supporting_note ?? ""
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

  const stepMeta = VENUE_APPLICATION_STEPS[step - 1];
  const progress = (step / VENUE_APPLICATION_TOTAL_STEPS) * 100;

  function clearFeedback() {
    setMessage(null);
    setError(null);
    setFieldErrors({});
  }

  function finishSave(
    result: Awaited<ReturnType<typeof saveVenueApplicationRole>>,
    options: { nextStep?: number; exit?: boolean }
  ) {
    if (result.status === "error") {
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      focusFirstInvalidField(result.fieldErrors);
      return;
    }
    setMessage(result.message);
    if (options.exit) {
      router.push("/account/personal");
      router.refresh();
      return;
    }
    if (options.nextStep) setStep(options.nextStep);
    router.refresh();
  }

  function goToStep(next: number) {
    clearFeedback();
    setStep(next);
    startTransition(async () => {
      const result = await setVenueApplicationStep({
        applicationId: initial.application.id,
        step: next,
      });
      if (result.status === "error") {
        setError(result.message);
        setFieldErrors(result.fieldErrors);
        return;
      }
      router.refresh();
    });
  }

  function saveRole(options: { nextStep?: number; exit?: boolean }) {
    clearFeedback();
    startTransition(async () => {
      const result = await saveVenueApplicationRole({
        applicationId: initial.application.id,
        values: {
          relationship_to_venue: relationship,
          phone,
        },
        nextStep: options.nextStep,
        exit: options.exit,
      });
      finishSave(result, options);
    });
  }

  function saveVenue(options: { nextStep?: number; exit?: boolean }) {
    clearFeedback();
    startTransition(async () => {
      const result = await saveVenueApplicationVenue({
        applicationId: initial.application.id,
        values: {
          application_mode: "create_new",
          target_venue_id: "",
          proposed_venue_name: proposedName,
          proposed_country: proposedCountry,
          proposed_city: proposedCity,
          proposed_address: proposedAddress,
          proposed_website: proposedWebsite,
        },
        nextStep: options.nextStep,
        exit: options.exit,
      });
      finishSave(result, options);
    });
  }

  function saveConfirmation(options: {
    nextStep?: number;
    exit?: boolean;
  }) {
    clearFeedback();
    startTransition(async () => {
      const result = await saveVenueApplicationConfirmation({
        applicationId: initial.application.id,
        values: { supporting_note: supportingNote },
        nextStep: options.nextStep,
        exit: options.exit,
      });
      finishSave(result, options);
    });
  }

  function handleSubmit() {
    clearFeedback();
    startTransition(async () => {
      const result = await submitVenueApplication({
        applicationId: initial.application.id,
        termsAccepted,
        privacyAccepted,
      });
      if (result.status === "error") {
        setError(result.message);
        setFieldErrors(result.fieldErrors);
        return;
      }
      setSubmitted(true);
      setSubmittedAt(new Date().toISOString());
      setMessage(result.message);
      router.refresh();
    });
  }

  const venueSummary = [
    proposedName || "Venue name not set",
    [proposedCity, proposedCountry].filter(Boolean).join(", "),
    proposedAddress,
    proposedWebsite,
  ]
    .filter(Boolean)
    .join(" · ");

  if (submitted) {
    const dateLabel = submittedAt
      ? new Date(submittedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Just now";
    const venueId = initial.application.approved_venue_id;
    const isApproved = initial.application.status === "approved";

    return (
      <section className="rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          {isApproved ? "Application approved" : "Application submitted"}
        </p>
        <h2 className="mt-3 text-2xl text-primary">
          {isApproved
            ? "Your venue is ready to manage"
            : "Submitted — we will review shortly"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-primary/65">
          {isApproved
            ? "Membership was created from this application. Continue completing venue details from your dashboard."
            : `Submitted ${dateLabel}. We review your relationship to the venue and email updates to your verified address.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {isApproved && venueId ? (
            <a
              href={`/account/venues/${venueId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
            >
              Open venue dashboard
            </a>
          ) : null}
          <a
            href="/account"
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              isApproved && venueId
                ? "border border-primary/15 text-primary hover:bg-surface"
                : "bg-primary text-accent hover:bg-primary/90"
            }`}
          >
            Back to account
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {initial.application.status === "changes_requested" &&
      initial.application.review_note ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800/70">
            Changes requested
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {initial.application.review_note}
          </p>
        </div>
      ) : null}
      <div className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Step {step} of {VENUE_APPLICATION_TOTAL_STEPS}
        </p>
        <h2 className="mt-2 text-2xl text-primary">
          {stepMeta.label}
        </h2>
        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-primary/10"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={VENUE_APPLICATION_TOTAL_STEPS}
          aria-valuenow={step}
          aria-label={`Step ${step} of ${VENUE_APPLICATION_TOTAL_STEPS}`}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="mt-4 flex flex-wrap gap-2">
          {VENUE_APPLICATION_STEPS.map((item) => (
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

      <ErrorSummary errors={fieldErrors} title={error ?? undefined} />
      {error && Object.keys(fieldErrors).length === 0 ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          {message}
        </p>
      ) : null}
      <RequiredLegend />

      {step === 1 ? (
        <section className="space-y-5 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-7">
          <div>
            <p className="text-sm font-medium text-primary">Verified email</p>
            <p className="mt-1.5 rounded-xl border border-primary/10 bg-surface px-3.5 py-3 text-base text-primary/80">
              {verifiedEmail || "Not available"}
            </p>
            <p className="mt-1.5 text-xs text-primary/50">
              We will use your verified account email for application updates.
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-primary">
              Your relationship to the venue
              <RequiredIndicator />
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {VENUE_RELATIONSHIPS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRelationship(option.value)}
                  className={`rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition ${
                    relationship === option.value ? cardSelected : cardIdle
                  }`}
                  aria-pressed={relationship === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {fieldErrors.relationship_to_venue ? (
              <p className="mt-2 text-sm text-red-700">
                {fieldErrors.relationship_to_venue}
              </p>
            ) : null}
          </fieldset>

          <p className="rounded-2xl border border-primary/10 bg-surface/60 p-4 text-sm leading-6 text-primary/70">
            This form is for owners, managers, or authorised representatives —
            not for “I coach here.” Coaching at a venue is a coach–venue
            relationship, managed from your coach profile after approval.
          </p>

          <label className="block text-sm font-medium text-primary" htmlFor="phone">
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

          <WizardActions
            pending={pending}
            onContinue={() => saveRole({ nextStep: 2 })}
            onExit={() => saveRole({ exit: true })}
          />
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-5 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-7">
          {wasHistoricalClaim ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <p className="text-sm font-semibold">
                Public venue claiming is no longer available
              </p>
              <p className="mt-1 text-sm leading-6">
                Submit your venue details below to continue this application.
              </p>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-medium text-primary">
              Submit your venue details
            </h3>
            <p className="mt-1 text-xs text-primary/55">
              Tell us about your venue. We will review the details before
              publishing.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Venue name"
                value={proposedName}
                onChange={setProposedName}
                error={fieldErrors.proposed_venue_name}
              />
              <label className="block text-sm font-medium text-primary">
                Country
                <select
                  className={inputClass}
                  value={proposedCountry}
                  onChange={(event) => setProposedCountry(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.proposed_country)}
                >
                  {VENUE_APPLICATION_COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                {fieldErrors.proposed_country ? (
                  <span className="mt-1.5 block text-sm text-red-700">
                    {fieldErrors.proposed_country}
                  </span>
                ) : null}
              </label>
              <Field
                label="City"
                value={proposedCity}
                onChange={setProposedCity}
                error={fieldErrors.proposed_city}
              />
              <Field
                label="Address (optional)"
                value={proposedAddress}
                onChange={setProposedAddress}
                error={fieldErrors.proposed_address}
                autoComplete="street-address"
              />
              <div className="sm:col-span-2">
                <Field
                  label="Website (optional)"
                  value={proposedWebsite}
                  onChange={setProposedWebsite}
                  error={fieldErrors.proposed_website}
                  placeholder="https://…"
                  inputMode="url"
                />
              </div>
            </div>
          </div>

          <WizardActions
            pending={pending}
            onBack={() => goToStep(1)}
            onContinue={() => saveVenue({ nextStep: 3 })}
            onExit={() => saveVenue({ exit: true })}
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-5 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-7">
          <ReviewBlock
            title="Your role"
            lines={[
              venueRelationshipLabel(relationship),
              phone || "Phone not set",
              verifiedEmail || "Email not available",
            ]}
          />
          <ReviewBlock
            title="Venue"
            lines={[venueApplicationModeLabel("create_new"), venueSummary]}
          />

          <label className="block text-sm font-medium text-primary">
            Supporting note (optional)
            <span className="mt-1 block text-xs font-normal text-primary/55">
              Add anything that can help us confirm your relationship to the
              venue.
            </span>
            <textarea
              className={`${inputClass} min-h-36 resize-y`}
              value={supportingNote}
              maxLength={1000}
              onChange={(event) => setSupportingNote(event.target.value)}
              aria-invalid={Boolean(fieldErrors.supporting_note)}
            />
            <span className="mt-1.5 block text-xs text-primary/50">
              {Math.max(0, 1000 - supportingNote.length)} characters remaining
            </span>
            {fieldErrors.supporting_note ? (
              <span className="mt-1.5 block text-sm text-red-700">
                {fieldErrors.supporting_note}
              </span>
            ) : null}
          </label>

          <WizardActions
            pending={pending}
            onBack={() => goToStep(2)}
            onContinue={() => saveConfirmation({ nextStep: 4 })}
            onExit={() => saveConfirmation({ exit: true })}
          />
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-5 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-7">
          <ReviewBlock
            title="Your role"
            onEdit={() => goToStep(1)}
            lines={[
              venueRelationshipLabel(relationship),
              phone || "Phone not set",
              verifiedEmail || "Email not available",
            ]}
          />
          <ReviewBlock
            title="Venue"
            onEdit={() => goToStep(2)}
            lines={[venueApplicationModeLabel("create_new"), venueSummary]}
          />
          <ReviewBlock
            title="Supporting note"
            onEdit={() => goToStep(3)}
            lines={[supportingNote || "No supporting note added"]}
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
                I confirm that the information provided is accurate and that I
                am authorised to represent this venue.
                {fieldErrors.terms ? (
                  <span className="mt-1 block text-red-700">
                    {fieldErrors.terms}
                  </span>
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
                  continuing you confirm you understand venue listing reviews
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
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface disabled:opacity-60"
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleSubmit}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Submitting…" : "Submit application"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => saveConfirmation({ exit: true })}
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

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "url";
}) {
  return (
    <label className="block text-sm font-medium text-primary">
      {label}
      <input
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
      />
      {error ? (
        <span className="mt-1.5 block text-sm text-red-700">{error}</span>
      ) : null}
    </label>
  );
}

function ReviewBlock({
  title,
  lines,
  onEdit,
}: {
  title: string;
  lines: Array<string | null>;
  onEdit?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base text-primary">{title}</h3>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-sm font-semibold text-primary/65 transition hover:text-primary"
          >
            Edit
          </button>
        ) : null}
      </div>
      <ul className="mt-3 space-y-1.5 whitespace-pre-wrap text-sm leading-6 text-primary/75">
        {lines.filter(Boolean).map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function WizardActions({
  pending,
  onBack,
  onContinue,
  onExit,
}: {
  pending: boolean;
  onBack?: () => void;
  onContinue: () => void;
  onExit: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 pt-2">
      {onBack ? (
        <button
          type="button"
          disabled={pending}
          onClick={onBack}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface disabled:opacity-60"
        >
          Back
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={onContinue}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save and continue"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onExit}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save and exit"}
      </button>
    </div>
  );
}

export function StartVenueApplicationButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error ? (
        <p className="mb-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createVenueApplicationDraft();
            if (result.status === "error") {
              setError(result.message);
              return;
            }
            router.push("/account/applications/venue");
            router.refresh();
          });
        }}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Starting…" : "Start venue application"}
      </button>
    </div>
  );
}
