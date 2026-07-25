"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createVenueApplicationDraft,
  saveVenueApplicationConfirmation,
  saveVenueApplicationRole,
  saveVenueApplicationVenue,
  searchVenueApplicationTargets,
  setVenueApplicationStep,
  submitVenueApplication,
} from "@/app/account/applications/venue/actions";
import {
  VENUE_APPLICATION_COUNTRIES,
  VENUE_APPLICATION_MODES,
  VENUE_APPLICATION_STEPS,
  VENUE_APPLICATION_TOTAL_STEPS,
  VENUE_RELATIONSHIPS,
  venueApplicationModeLabel,
  venueRelationshipLabel,
} from "@/lib/venueProfileApplication/constants";
import type {
  VenueApplicationTargetVenue,
  VenueApplicationWithVenue,
} from "@/lib/venueProfileApplication/types";

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
  const [applicationMode, setApplicationMode] = useState(
    initial.application.application_mode ?? ""
  );
  const [targetVenueId, setTargetVenueId] = useState(
    initial.application.target_venue_id ?? ""
  );
  const [selectedVenue, setSelectedVenue] =
    useState<VenueApplicationTargetVenue | null>(initial.targetVenue);
  const [searchQuery, setSearchQuery] = useState(
    initial.targetVenue?.name ?? ""
  );
  const [searchResults, setSearchResults] = useState<
    VenueApplicationTargetVenue[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [proposeDuplicates, setProposeDuplicates] = useState<
    VenueApplicationTargetVenue[]
  >([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [proposedName, setProposedName] = useState(
    initial.application.proposed_venue_name ?? ""
  );
  const [proposedCountry, setProposedCountry] = useState<string>(
    initial.application.proposed_country ?? VENUE_APPLICATION_COUNTRIES[0]
  );
  const [proposedCity, setProposedCity] = useState(
    initial.application.proposed_city ?? ""
  );
  const [proposedAddress, setProposedAddress] = useState(
    initial.application.proposed_address ?? ""
  );
  const [proposedWebsite, setProposedWebsite] = useState(
    initial.application.proposed_website ?? ""
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

  useEffect(() => {
    if (applicationMode !== "claim_existing") return;

    const term = searchQuery.trim();
    if (term.length < 2) return;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        const result = await searchVenueApplicationTargets(term);
        if (cancelled) return;
        if (!result.ok) {
          setSearchResults([]);
          setSearchError(result.message);
          setSearching(false);
          return;
        }
        setSearchError(null);
        setSearchResults(result.venues);
        setSearching(false);
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [applicationMode, searchQuery]);

  useEffect(() => {
    if (applicationMode !== "create_new") return;

    const name = proposedName.trim();
    const city = proposedCity.trim();
    const country = proposedCountry.trim();
    if (name.length < 2 || city.length < 2 || !country) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        if (cancelled) return;
        setCheckingDuplicates(true);
        const result = await searchVenueApplicationTargets(name);
        if (cancelled) return;
        if (!result.ok) {
          setProposeDuplicates([]);
          setCheckingDuplicates(false);
          return;
        }
        const matches = result.venues.filter((venue) => {
          const sameName =
            (venue.name ?? "").trim().toLowerCase() === name.toLowerCase();
          const sameCity =
            (venue.city ?? "").trim().toLowerCase() === city.toLowerCase();
          const sameCountry =
            (venue.country ?? "").trim().toLowerCase() === country.toLowerCase();
          return sameName && sameCity && sameCountry;
        });
        setProposeDuplicates(matches);
        setCheckingDuplicates(false);
      });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [applicationMode, proposedName, proposedCity, proposedCountry]);

  const visibleProposeDuplicates =
    applicationMode === "create_new" ? proposeDuplicates : [];
  const showCheckingDuplicates =
    applicationMode === "create_new" && checkingDuplicates;

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
          application_mode: applicationMode,
          target_venue_id: targetVenueId,
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

  function changeMode(mode: string) {
    setApplicationMode(mode);
    if (mode === "claim_existing") {
      setProposedName("");
      setProposedCountry(VENUE_APPLICATION_COUNTRIES[0]);
      setProposedCity("");
      setProposedAddress("");
      setProposedWebsite("");
      return;
    }
    setTargetVenueId("");
    setSelectedVenue(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearching(false);
    setSearchError(null);
    setProposeDuplicates([]);
    setCheckingDuplicates(false);
  }

  function selectVenue(venue: VenueApplicationTargetVenue) {
    setTargetVenueId(venue.id);
    setSelectedVenue(venue);
    setSearchQuery(venue.name ?? "");
    setSearchResults([]);
    setSearching(false);
    setSearchError(null);
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

  const venueSummary =
    applicationMode === "claim_existing"
      ? selectedVenue
        ? venueLocationLabel(selectedVenue)
        : "Existing venue not selected"
      : [
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
        <h2 className="mt-3 text-2xl font-bold text-primary">
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
        <h2 className="mt-2 text-2xl font-bold text-primary">
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

      {error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}

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

          <label className="block text-sm font-medium text-primary">
            Phone
            <input
              className={inputClass}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              inputMode="tel"
              placeholder="+34 …"
              aria-invalid={Boolean(fieldErrors.phone)}
            />
            {fieldErrors.phone ? (
              <span className="mt-1.5 block text-sm text-red-700">
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
          <fieldset>
            <legend className="text-sm font-medium text-primary">
              Claim or propose?
            </legend>
            <p className="mt-1 text-xs text-primary/55">
              Claim links you to an existing listing. Propose creates a new
              venue for review.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {VENUE_APPLICATION_MODES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeMode(option.value)}
                  className={`rounded-xl border px-4 py-4 text-left transition ${
                    applicationMode === option.value ? cardSelected : cardIdle
                  }`}
                  aria-pressed={applicationMode === option.value}
                >
                  <span className="block text-sm font-semibold">
                    {option.label}
                  </span>
                  <span
                    className={`mt-1 block text-xs leading-5 ${
                      applicationMode === option.value
                        ? "text-accent/75"
                        : "text-primary/55"
                    }`}
                  >
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
            {fieldErrors.application_mode ? (
              <p className="mt-2 text-sm text-red-700">
                {fieldErrors.application_mode}
              </p>
            ) : null}
          </fieldset>

          {applicationMode === "claim_existing" ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-primary">
                Search by venue name, city, or country
                <input
                  className={inputClass}
                  value={searchQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSearchQuery(value);
                    if (value.trim().length < 2) {
                      setSearchResults([]);
                      setSearching(false);
                      setSearchError(null);
                    } else {
                      setSearching(true);
                    }
                    if (selectedVenue && value !== (selectedVenue.name ?? "")) {
                      setSelectedVenue(null);
                      setTargetVenueId("");
                    }
                  }}
                  placeholder="Start typing…"
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.target_venue_id)}
                />
              </label>
              {searching ? (
                <p className="text-sm text-primary/55">Searching venues…</p>
              ) : null}
              {searchError ? (
                <p className="text-sm text-red-700" role="alert">
                  {searchError}
                </p>
              ) : null}
              {fieldErrors.target_venue_id ? (
                <p className="text-sm text-red-700">
                  {fieldErrors.target_venue_id}
                </p>
              ) : null}
              {selectedVenue ? (
                <div className="rounded-2xl border border-primary bg-surface/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                    Selected venue
                  </p>
                  <p className="mt-2 text-sm font-bold text-primary">
                    {selectedVenue.name || "Unnamed venue"}
                  </p>
                  <p className="mt-1 text-sm text-primary/65">
                    {[selectedVenue.city, selectedVenue.country]
                      .filter(Boolean)
                      .join(", ") || "Location not available"}
                  </p>
                </div>
              ) : null}
              {searchResults.length > 0 ? (
                <ul className="space-y-2" aria-label="Venue search results">
                  {searchResults.map((venue) => (
                    <li key={venue.id}>
                      <button
                        type="button"
                        onClick={() => selectVenue(venue)}
                        className="w-full rounded-xl border border-primary/15 bg-white px-4 py-3 text-left transition hover:border-primary/30 hover:bg-surface"
                      >
                        <span className="block text-sm font-semibold text-primary">
                          {venue.name || "Unnamed venue"}
                        </span>
                        <span className="mt-1 block text-xs text-primary/55">
                          {[venue.city, venue.country]
                            .filter(Boolean)
                            .join(", ") || "Location not available"}
                        </span>
                        {venue.website?.trim() ? (
                          <span className="mt-1 block truncate text-xs text-primary/45">
                            {venue.website.trim()}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : searchQuery.trim().length >= 2 &&
                !searching &&
                !selectedVenue &&
                !searchError ? (
                <p className="text-sm text-primary/55">
                  No matching venues found. Try another search or propose a new
                  listing.
                </p>
              ) : null}
            </div>
          ) : null}

          {applicationMode === "create_new" ? (
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
              {showCheckingDuplicates ? (
                <p className="text-sm text-primary/55">Checking for similar listings…</p>
              ) : null}
              {visibleProposeDuplicates.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                  <p className="text-sm font-semibold">
                    A listing with this name, city, and country already exists
                  </p>
                  <p className="mt-1 text-sm leading-6">
                    Prefer claiming the existing venue instead of proposing a
                    duplicate.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {visibleProposeDuplicates.map((venue) => (
                      <li key={venue.id} className="text-sm">
                        <span className="font-semibold">
                          {venue.name || "Unnamed venue"}
                        </span>
                        <span className="text-amber-900/70">
                          {" "}
                          · {[venue.city, venue.country]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      const first = visibleProposeDuplicates[0];
                      changeMode("claim_existing");
                      if (first) {
                        setSearchQuery(first.name ?? "");
                        selectVenue(first);
                      }
                    }}
                    className="mt-3 text-sm font-semibold underline-offset-2 hover:underline"
                  >
                    Switch to claim existing
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

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
            lines={[venueApplicationModeLabel(applicationMode), venueSummary]}
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
            lines={[venueApplicationModeLabel(applicationMode), venueSummary]}
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

function venueLocationLabel(venue: VenueApplicationTargetVenue) {
  const location = [venue.city, venue.country].filter(Boolean).join(", ");
  return `${venue.name || "Unnamed venue"}${location ? ` · ${location}` : ""}`;
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
        <h3 className="text-base font-bold text-primary">{title}</h3>
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
