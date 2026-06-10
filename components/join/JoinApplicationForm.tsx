"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { submitCoachApplication } from "@/app/actions/coachApplications";
import {
  AVAILABILITY_OPTIONS,
  JOIN_APPLICATION_DRAFT_KEY,
  LEAD_DELIVERY_OPTIONS,
  MAIN_GOAL_OPTIONS,
  PAID_LEADS_OPTIONS,
  PLAYER_LEVELS,
  PLAYER_TYPES,
  PRICE_RANGES,
  SERVICE_TYPES,
  SERVICES_OFFERED_OPTIONS,
  STEP_LABELS,
  TOTAL_STEPS,
  YES_NO,
  draftHasMeaningfulInput,
  draftToSubmitPayload,
  emptyCoachApplicationDraft,
  mergeStoredCoachApplicationDraft,
  validateCoachApplicationStep,
  type CoachApplicationDraft,
  type CoachApplicationMediaAttachment,
} from "@/lib/coachApplication";

const inputBase =
  "mt-1.5 w-full rounded-xl border border-primary/10 bg-white px-3 py-2.5 text-base text-primary outline-none transition focus:border-primary/25 focus:ring-1 focus:ring-primary/20 sm:text-sm";

const labelClass = "block text-sm font-medium text-primary";

function pillClass(active: boolean) {
  return [
    "rounded-full border px-3 py-2 text-left text-sm font-medium transition",
    active
      ? "border-primary bg-primary text-white shadow-sm"
      : "border-primary/15 bg-white text-primary hover:border-primary/25 hover:bg-surface/80",
  ].join(" ");
}

const MAX_MEDIA_FILES = 6;
const MAX_MEDIA_BYTES = 2 * 1024 * 1024;

async function filesToMediaAttachments(files: File[]): Promise<CoachApplicationMediaAttachment[]> {
  const slice = files.slice(0, MAX_MEDIA_FILES);
  const out: CoachApplicationMediaAttachment[] = [];
  for (const file of slice) {
    if (file.size > MAX_MEDIA_BYTES) continue;
    const data_base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = r.result as string;
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(file);
    });
    out.push({
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      data_base64,
    });
  }
  return out;
}

function RadioGrid({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <label key={opt} className={pillClass(value === opt)}>
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="sr-only"
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

function CheckboxGrid({
  name,
  values,
  onToggle,
  options,
}: {
  name: string;
  values: string[];
  onToggle: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={name}>
      {options.map((opt) => {
        const active = values.includes(opt);
        return (
          <label key={opt} className={pillClass(active)}>
            <input
              type="checkbox"
              name={`${name}-${opt}`}
              checked={active}
              onChange={() => onToggle(opt)}
              className="sr-only"
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
}

export default function JoinApplicationForm() {
  const formId = useId();
  const topRef = useRef<HTMLDivElement>(null);
  const skipScrollRef = useRef(true);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CoachApplicationDraft>(emptyCoachApplicationDraft);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(JOIN_APPLICATION_DRAFT_KEY);
      if (raw) setDraft(mergeStoredCoachApplicationDraft(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
    setStorageHydrated(true);
  }, []);

  useEffect(() => {
    if (!storageHydrated || success) return;
    try {
      localStorage.setItem(JOIN_APPLICATION_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, storageHydrated, success]);

  useEffect(() => {
    if (!draftHasMeaningfulInput(draft) || success) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [draft, success]);

  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const update = useCallback(<K extends keyof CoachApplicationDraft>(key: K, value: CoachApplicationDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const toggleInArray = useCallback((key: "services_offered" | "player_levels" | "player_types", opt: string) => {
    setDraft((d) => {
      const arr = d[key];
      const next = arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt];
      return { ...d, [key]: next };
    });
  }, []);

  const progressPct = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  const goNext = () => {
    const err = validateCoachApplicationStep(step, draft);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    setStepError(null);
    setSubmitError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    const err = validateCoachApplicationStep(step, draft);
    if (err) {
      setStepError(err);
      return;
    }
    for (let s = 0; s < TOTAL_STEPS; s++) {
      const e = validateCoachApplicationStep(s, draft);
      if (e) {
        setStep(s);
        setStepError(e);
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      let media_attachments: CoachApplicationMediaAttachment[] = [];
      try {
        media_attachments = await filesToMediaAttachments(mediaFiles);
      } catch {
        media_attachments = [];
      }
      const payload = draftToSubmitPayload(draft, media_attachments);
      const res = await submitCoachApplication(payload);
      if (!res.ok) {
        setSubmitError(res.message);
        return;
      }
      try {
        localStorage.removeItem(JOIN_APPLICATION_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setSuccess(true);
    } catch (e) {
      console.error(e);
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div
        className="rounded-2xl border border-primary/10 bg-white px-6 py-12 text-center shadow-sm sm:px-10"
        role="status"
      >
        <p className="text-lg font-semibold text-primary">Thanks — we&apos;ll review your application</p>
        <p className="mt-3 text-primary/70">
          We&apos;ll get back to you shortly. If you need anything in the meantime, use the contact page.
        </p>
      </div>
    );
  }

  return (
    <div ref={topRef} className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-primary/60">
          <span>{STEP_LABELS[step]}</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {stepError ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {stepError}
        </p>
      ) : null}
      {submitError ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {submitError}
        </p>
      ) : null}

      <div className="space-y-8">
        {step === 0 ? (
          <>
            <fieldset>
              <legend className={labelClass}>What type of service do you offer?</legend>
              <p className="mt-1 text-xs text-primary/60">Required</p>
              <div className="mt-3">
                <RadioGrid
                  name={`${formId}-service`}
                  value={draft.service_type}
                  onChange={(v) => update("service_type", v)}
                  options={SERVICE_TYPES}
                />
              </div>
            </fieldset>
            <label className={labelClass}>
              Business / brand name
              <input
                value={draft.business_name}
                onChange={(e) => update("business_name", e.target.value)}
                className={inputBase}
                autoComplete="organization"
                required
              />
            </label>
            <label className={labelClass}>
              Contact name
              <input
                value={draft.contact_name}
                onChange={(e) => update("contact_name", e.target.value)}
                className={inputBase}
                autoComplete="name"
                required
              />
            </label>
            <label className={labelClass}>
              Email address
              <input
                type="email"
                value={draft.email}
                onChange={(e) => update("email", e.target.value)}
                className={inputBase}
                autoComplete="email"
                required
              />
            </label>
            <label className={labelClass}>
              Phone number (WhatsApp preferred)
              <input
                type="tel"
                value={draft.phone}
                onChange={(e) => update("phone", e.target.value)}
                className={inputBase}
                autoComplete="tel"
                required
              />
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <label className={labelClass}>
              Where are you based? <span className="font-normal text-primary/50">(city, country)</span>
              <input
                value={draft.based_in}
                onChange={(e) => update("based_in", e.target.value)}
                className={inputBase}
                placeholder="e.g. Marbella, Spain"
              />
            </label>
            <fieldset>
              <legend className={labelClass}>Do you operate in multiple locations?</legend>
              <div className="mt-3">
                <RadioGrid
                  name={`${formId}-multi`}
                  value={draft.multiple_locations}
                  onChange={(v) => update("multiple_locations", v)}
                  options={YES_NO}
                />
              </div>
            </fieldset>
            {draft.multiple_locations === "Yes" ? (
              <label className={labelClass}>
                List all locations
                <textarea
                  value={draft.locations_list}
                  onChange={(e) => update("locations_list", e.target.value)}
                  rows={4}
                  className={inputBase + " min-h-[6rem] resize-y"}
                />
              </label>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <fieldset>
              <legend className={labelClass}>What services do you offer?</legend>
              <p className="mt-1 text-xs text-primary/60">Select all that apply</p>
              <div className="mt-3">
                <CheckboxGrid
                  name={`${formId}-services`}
                  values={draft.services_offered}
                  onToggle={(v) => toggleInArray("services_offered", v)}
                  options={SERVICES_OFFERED_OPTIONS}
                />
              </div>
            </fieldset>
            <label className={labelClass}>
              Describe your offering
              <span className="mt-1 block text-xs font-normal text-primary/60">
                Programmes, structure, experience — what makes you different?
              </span>
              <textarea
                value={draft.offering_description}
                onChange={(e) => update("offering_description", e.target.value)}
                rows={6}
                className={inputBase + " min-h-[8rem] resize-y"}
              />
            </label>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <fieldset>
              <legend className={labelClass}>What player levels do you cater for?</legend>
              <p className="mt-1 text-xs text-primary/60">Select all that apply</p>
              <div className="mt-3">
                <CheckboxGrid
                  name={`${formId}-levels`}
                  values={draft.player_levels}
                  onToggle={(v) => toggleInArray("player_levels", v)}
                  options={PLAYER_LEVELS}
                />
              </div>
            </fieldset>
            <fieldset>
              <legend className={labelClass}>What type of players do you specialise in?</legend>
              <p className="mt-1 text-xs text-primary/60">Select all that apply</p>
              <div className="mt-3">
                <CheckboxGrid
                  name={`${formId}-ptypes`}
                  values={draft.player_types}
                  onToggle={(v) => toggleInArray("player_types", v)}
                  options={PLAYER_TYPES}
                />
              </div>
            </fieldset>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <fieldset>
              <legend className={labelClass}>Typical price range (per week)</legend>
              <div className="mt-3">
                <RadioGrid
                  name={`${formId}-price`}
                  value={draft.price_range}
                  onChange={(v) => update("price_range", v)}
                  options={PRICE_RANGES}
                />
              </div>
            </fieldset>
            <fieldset>
              <legend className={labelClass}>Do you offer accommodation?</legend>
              <div className="mt-3">
                <RadioGrid
                  name={`${formId}-acc`}
                  value={draft.accommodation}
                  onChange={(v) => update("accommodation", v)}
                  options={YES_NO}
                />
              </div>
            </fieldset>
            <fieldset>
              <legend className={labelClass}>Do you offer full packages (training + accommodation)?</legend>
              <div className="mt-3">
                <RadioGrid
                  name={`${formId}-pkg`}
                  value={draft.full_packages}
                  onChange={(v) => update("full_packages", v)}
                  options={YES_NO}
                />
              </div>
            </fieldset>
            <fieldset>
              <legend className={labelClass}>When are you available for international players?</legend>
              <div className="mt-3">
                <RadioGrid
                  name={`${formId}-avail`}
                  value={draft.availability}
                  onChange={(v) => update("availability", v)}
                  options={AVAILABILITY_OPTIONS}
                />
              </div>
            </fieldset>
            {draft.availability === AVAILABILITY_OPTIONS[1] ? (
              <label className={labelClass}>
                Specify your season(s)
                <textarea
                  value={draft.seasonal_detail}
                  onChange={(e) => update("seasonal_detail", e.target.value)}
                  rows={3}
                  className={inputBase + " min-h-[4rem] resize-y"}
                />
              </label>
            ) : null}
            <label className={labelClass}>
              How many players can you accommodate per week?
              <input
                value={draft.capacity_per_week}
                onChange={(e) => update("capacity_per_week", e.target.value)}
                className={inputBase}
                inputMode="numeric"
                placeholder="e.g. 8"
              />
            </label>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <p className="text-sm text-primary/70">
              Optional fields — add what you have. Uploads are not saved in your browser draft; re-select files if you
              refresh the page.
            </p>
            <label className={labelClass}>
              Website URL
              <input
                value={draft.website_url}
                onChange={(e) => update("website_url", e.target.value)}
                className={inputBase}
                placeholder="https://"
                inputMode="url"
              />
            </label>
            <label className={labelClass}>
              Instagram / social links
              <input
                value={draft.social_links}
                onChange={(e) => update("social_links", e.target.value)}
                className={inputBase}
                placeholder="@handle or full URLs"
              />
            </label>
            <label className={labelClass}>
              Photos or videos of your facility or coaching
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => setMediaFiles(Array.from(e.target.files ?? []))}
                className="mt-2 block w-full text-sm text-primary/80 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
              />
              <span className="mt-1 block text-xs text-primary/55">
                Up to {MAX_MEDIA_FILES} files, {Math.round(MAX_MEDIA_BYTES / (1024 * 1024))} MB each. Skipped if larger —
                you can still submit.
              </span>
            </label>
            <label className={labelClass}>
              Notable achievements, certifications, or players coached
              <textarea
                value={draft.achievements}
                onChange={(e) => update("achievements", e.target.value)}
                rows={5}
                className={inputBase + " min-h-[6rem] resize-y"}
              />
            </label>
          </>
        ) : null}

        {step === 6 ? (
          <>
            <fieldset>
              <legend className={labelClass}>Would you like to promote a special offer to our player database?</legend>
              <div className="mt-3">
                <RadioGrid
                  name={`${formId}-offer`}
                  value={draft.special_offer}
                  onChange={(v) => update("special_offer", v)}
                  options={YES_NO}
                />
              </div>
            </fieldset>
            {draft.special_offer === "Yes" ? (
              <label className={labelClass}>
                Describe your offer
                <textarea
                  value={draft.special_offer_detail}
                  onChange={(e) => update("special_offer_detail", e.target.value)}
                  rows={4}
                  className={inputBase + " min-h-[5rem] resize-y"}
                  placeholder="e.g. discount, free session, package deal"
                />
              </label>
            ) : null}
            <fieldset>
              <legend className={labelClass}>How would you like to receive player leads?</legend>
              <div className="mt-3 space-y-2">
                <RadioGrid
                  name={`${formId}-leads`}
                  value={draft.lead_delivery}
                  onChange={(v) => update("lead_delivery", v)}
                  options={LEAD_DELIVERY_OPTIONS}
                />
              </div>
            </fieldset>
            <fieldset>
              <legend className={labelClass}>Are you open to paying for qualified leads or bookings?</legend>
              <div className="mt-3 space-y-2">
                <RadioGrid
                  name={`${formId}-paid`}
                  value={draft.paid_leads}
                  onChange={(v) => update("paid_leads", v)}
                  options={PAID_LEADS_OPTIONS}
                />
              </div>
            </fieldset>
            <fieldset>
              <legend className={labelClass}>What is your main goal joining Padel Pathways?</legend>
              <div className="mt-3">
                <RadioGrid
                  name={`${formId}-goal`}
                  value={draft.main_goal}
                  onChange={(v) => update("main_goal", v)}
                  options={MAIN_GOAL_OPTIONS}
                />
              </div>
            </fieldset>
          </>
        ) : null}
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-primary/10 pt-6 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || submitting}
          className="rounded-xl border border-primary/15 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>
        {step < TOTAL_STEPS - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={submitting}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        )}
      </div>
    </div>
  );
}
