"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Pencil, X } from "lucide-react";
import { submitEnquiry } from "@/app/actions/enquiries";
import { parseAge, type EnquirySubmitPayload } from "@/lib/enquiryPayload";
import { filterCountryLabels, getCountryOptions } from "@/lib/countriesForEnquiry";

const ENQUIRY_DRAFT_KEY = "enquiry_draft";

/**
 * Set `NEXT_PUBLIC_ENQUIRY_DISABLE_LOCAL_STORAGE=true` in `.env.local` to skip draft persistence
 * while debugging (restart dev server after changing). Remove the line to restore localStorage.
 */
const ENQUIRY_SKIP_LOCAL_STORAGE =
  process.env.NEXT_PUBLIC_ENQUIRY_DISABLE_LOCAL_STORAGE === "true";

const STEP_LABELS = [
  "Basic details",
  "Player profile",
  "Training goals",
  "Training preferences",
  "Budget & accommodation",
  "Additional information",
  "Review & submit",
] as const;

const TOTAL_STEPS = STEP_LABELS.length;

const PLAYING_LEVELS = [
  "Beginner",
  "Improver",
  "Intermediate",
  "Advanced",
  "Competitive / Tournament Player",
] as const;

const PLAYING_DURATION = ["< 6 months", "6–12 months", "1–3 years", "3+ years"] as const;

const MAIN_GOAL_OPTIONS = [
  "Improve general level",
  "Compete in tournaments",
  "Train like a professional",
  "Junior development",
  "Fitness & lifestyle",
  "Coaching certification",
] as const;

const PREFERRED_DURATION = ["1 week", "2 weeks", "1 month", "3+ months"] as const;

const TRAINING_TYPES = [
  "1:1 Coaching",
  "Group Training",
  "Academy Program",
  "Unsure (need guidance)",
] as const;

const BUDGET_RANGES = ["£300–£500", "£500–£1,000", "£1,000–£2,000", "£2,000+"] as const;

const ACCOMMODATION_OPTS = ["Yes", "No", "Maybe"] as const;

const YES_NO = ["Yes", "No"] as const;

const inputBase =
  "mt-1.5 w-full rounded-xl border border-primary/10 bg-white px-3 py-2.5 text-base text-primary outline-none transition focus:border-primary/25 focus:ring-1 focus:ring-primary/20 sm:text-sm";

const sectionTitle = "text-lg font-semibold text-primary";
const helperText = "mt-1 text-xs text-primary/60";
const sectionBlock = "space-y-6";

export type EnquiryModalProps = {
  open: boolean;
  onClose: () => void;
  coachId?: string | null;
  venueId?: string | null;
};

type Draft = {
  full_name: string;
  email: string;
  phone: string;
  age: string;
  nationality: string;
  current_location_country: string;
  current_location_city: string;
  playing_level: string;
  playing_duration: string;
  main_goals: string[];
  goals_detail: string;
  preferred_destinations: string[];
  preferred_duration: string;
  preferred_start_date: string;
  training_type: string;
  budget_range: string;
  accommodation: string;
  trained_abroad: string;
  injuries: string;
  anything_else: string;
  wants_personalised_recommendation: boolean;
};

const emptyDraft = (): Draft => ({
  full_name: "",
  email: "",
  phone: "",
  age: "",
  nationality: "",
  current_location_country: "",
  current_location_city: "",
  playing_level: "",
  playing_duration: "",
  main_goals: [],
  goals_detail: "",
  preferred_destinations: [],
  preferred_duration: "",
  preferred_start_date: "",
  training_type: "",
  budget_range: "",
  accommodation: "",
  trained_abroad: "",
  injuries: "",
  anything_else: "",
  wants_personalised_recommendation: false,
});

function mergeStoredDraft(raw: unknown): Draft {
  const base = emptyDraft();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const str = (key: string) => (typeof o[key] === "string" ? (o[key] as string) : "");
  return {
    full_name: str("full_name") || base.full_name,
    email: str("email") || base.email,
    phone: str("phone") || base.phone,
    age: str("age") || base.age,
    nationality: str("nationality") || base.nationality,
    current_location_country: str("current_location_country") || base.current_location_country,
    current_location_city: str("current_location_city") || base.current_location_city,
    playing_level: str("playing_level") || base.playing_level,
    playing_duration: str("playing_duration") || base.playing_duration,
    main_goals: Array.isArray(o.main_goals)
      ? (o.main_goals as unknown[]).filter((x): x is string => typeof x === "string")
      : base.main_goals,
    goals_detail: str("goals_detail") || base.goals_detail,
    preferred_destinations: Array.isArray(o.preferred_destinations)
      ? (o.preferred_destinations as unknown[]).filter((x): x is string => typeof x === "string")
      : base.preferred_destinations,
    preferred_duration: str("preferred_duration") || base.preferred_duration,
    preferred_start_date: str("preferred_start_date") || base.preferred_start_date,
    training_type: str("training_type") || base.training_type,
    budget_range: str("budget_range") || base.budget_range,
    accommodation: str("accommodation") || base.accommodation,
    trained_abroad: str("trained_abroad") || base.trained_abroad,
    injuries: str("injuries") || base.injuries,
    anything_else: str("anything_else") || base.anything_else,
    wants_personalised_recommendation:
      typeof o.wants_personalised_recommendation === "boolean"
        ? o.wants_personalised_recommendation
        : base.wants_personalised_recommendation,
  };
}

function draftHasMeaningfulInput(d: Draft): boolean {
  if (d.wants_personalised_recommendation) return true;
  const entries = Object.entries(d).filter(([k]) => k !== "wants_personalised_recommendation");
  return entries.some(([, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim().length > 0;
    return false;
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateStep0(d: Draft): string | null {
  if (!d.full_name.trim()) return "Please enter your name.";
  if (!d.email.trim()) return "Please enter your email.";
  if (!EMAIL_RE.test(d.email.trim())) return "Please enter a valid email address.";
  return null;
}

function pillClass(active: boolean) {
  return [
    "rounded-full border px-3 py-2 text-left text-sm font-medium transition",
    active
      ? "border-primary bg-primary text-white shadow-sm"
      : "border-primary/15 bg-white text-primary hover:border-primary/25 hover:bg-surface/80",
  ].join(" ");
}

function RadioGrid({
  name,
  value,
  onChange,
  options,
  autofocusFirst = false,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  autofocusFirst?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={name}>
      {options.map((opt, i) => (
        <label
          key={opt}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
            value === opt
              ? "border-primary/35 bg-primary/[0.07] ring-1 ring-primary/15"
              : "border-primary/10 bg-white hover:border-primary/18"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            data-autofocus={autofocusFirst && i === 0 ? "" : undefined}
            className="mt-0.5 h-4 w-4 shrink-0 border-primary/25 text-primary"
          />
          <span className="text-sm leading-snug text-primary">{opt}</span>
        </label>
      ))}
    </div>
  );
}

function draftToPayload(
  draft: Draft,
  coachId: string | null,
  venueId: string | null
): EnquirySubmitPayload {
  return {
    coachId,
    venueId,
    full_name: draft.full_name.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim() || null,
    age: parseAge(draft.age),
    nationality: draft.nationality.trim() || null,
    current_location_country: draft.current_location_country.trim() || null,
    current_location_city: draft.current_location_city.trim() || null,
    playing_level: draft.playing_level.trim() || null,
    playing_duration: draft.playing_duration.trim() || null,
    main_goals: [...draft.main_goals],
    goals_detail: draft.goals_detail.trim() || null,
    preferred_destinations: [...draft.preferred_destinations],
    preferred_duration: draft.preferred_duration.trim() || null,
    preferred_start_date: draft.preferred_start_date.trim() || null,
    training_type: draft.training_type.trim() || null,
    budget_range: draft.budget_range.trim() || null,
    accommodation: draft.accommodation.trim() || null,
    trained_abroad: draft.trained_abroad.trim() || null,
    injuries: draft.injuries.trim() || null,
    anything_else: draft.anything_else.trim() || null,
    wants_personalised_recommendation: draft.wants_personalised_recommendation,
  };
}

type SummaryRowProps = { label: string; value: string; empty?: string };

function SummaryRow({ label, value, empty = "—" }: SummaryRowProps) {
  const show = value.trim();
  return (
    <div className="flex flex-col gap-0.5 border-b border-primary/8 py-2 last:border-0 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-primary/50 sm:w-40">{label}</dt>
      <dd className="min-w-0 text-sm text-primary">{show || empty}</dd>
    </div>
  );
}

export default function EnquiryModal({ open, onClose, coachId, venueId }: EnquiryModalProps) {
  const titleId = useId();
  const countries = useMemo(() => getCountryOptions(), []);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [destinationInput, setDestinationInput] = useState("");
  const [step0Error, setStep0Error] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  /** Avoid persisting before localStorage has been read on open (prevents empty draft overwriting saved data). */
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const handleCloseRef = useRef<() => void>(() => {});

  const destinationSuggestions = useMemo(
    () => filterCountryLabels(destinationInput, 8),
    [destinationInput]
  );

  const resetFormState = useCallback(() => {
    setStep(0);
    setDraft(emptyDraft());
    setDestinationInput("");
    setStep0Error(null);
    setSubmitting(false);
    setSubmitError(null);
    setSuccess(false);
  }, []);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setStorageHydrated(false);
    } else if (ENQUIRY_SKIP_LOCAL_STORAGE) {
      setStorageHydrated(true);
    } else {
      try {
        const raw = localStorage.getItem(ENQUIRY_DRAFT_KEY);
        if (raw) {
          const merged = mergeStoredDraft(JSON.parse(raw));
          setDraft((prev) => {
            const prevMeaningful = draftHasMeaningfulInput(prev);
            const mergedMeaningful = draftHasMeaningfulInput(merged);
            if (prevMeaningful && !mergedMeaningful) return prev;
            const prevBasics = Boolean(prev.full_name.trim() && prev.email.trim());
            const mergedBasics = Boolean(merged.full_name.trim() && merged.email.trim());
            if (prevBasics && !mergedBasics) return prev;
            return merged;
          });
        }
      } catch {
        /* ignore */
      }
      setStorageHydrated(true);
    }
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || success || !storageHydrated || ENQUIRY_SKIP_LOCAL_STORAGE) return;
    try {
      localStorage.setItem(ENQUIRY_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, open, success, storageHydrated]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") handleCloseRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || success) return;
    const el = bodyScrollRef.current;
    el?.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => {
      const focusEl = el?.querySelector<HTMLElement>("[data-autofocus]");
      focusEl?.focus();
    });
  }, [step, open, success]);

  const handleClose = useCallback(() => {
    if (!success && draftHasMeaningfulInput(draft)) {
      const ok = window.confirm(
        ENQUIRY_SKIP_LOCAL_STORAGE
          ? "Close the form? Unsaved changes will be lost."
          : "Close the form? Your answers are saved on this device — you can continue later from this browser."
      );
      if (!ok) return;
    }
    onClose();
  }, [draft, onClose, success]);

  useEffect(() => {
    handleCloseRef.current = handleClose;
  }, [handleClose]);

  const handleSuccessClose = useCallback(() => {
    if (ENQUIRY_SKIP_LOCAL_STORAGE) {
      resetFormState();
      onClose();
      return;
    }
    try {
      localStorage.removeItem(ENQUIRY_DRAFT_KEY);
    } catch {
      /* ignore */
    }
    resetFormState();
    onClose();
  }, [onClose, resetFormState]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const toggleGoal = (g: string) => {
    setDraft((d) => ({
      ...d,
      main_goals: d.main_goals.includes(g) ? d.main_goals.filter((x) => x !== g) : [...d.main_goals, g],
    }));
  };

  const addDestination = (label: string) => {
    const t = label.trim();
    if (!t) return;
    setDraft((d) => ({
      ...d,
      preferred_destinations: d.preferred_destinations.includes(t)
        ? d.preferred_destinations
        : [...d.preferred_destinations, t],
    }));
    setDestinationInput("");
  };

  const removeDestination = (label: string) => {
    setDraft((d) => ({
      ...d,
      preferred_destinations: d.preferred_destinations.filter((x) => x !== label),
    }));
  };

  const onDestinationKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = destinationInput.trim();
    if (!q) return;
    const exact = countries.find((c) => c.label.toLowerCase() === q.toLowerCase());
    if (exact) {
      addDestination(exact.label);
      return;
    }
    const sug = filterCountryLabels(q, 1)[0];
    if (sug) addDestination(sug);
    else addDestination(q);
  };

  const goNext = () => {
    if (step === 0) {
      const err = validateStep0(draft);
      if (err) {
        setStep0Error(err);
        return;
      }
      setStep0Error(null);
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    setStep0Error(null);
    setSubmitError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleFinalSubmit = async () => {
    const err0 = validateStep0(draft);
    if (err0) {
      setStep(0);
      setStep0Error(err0);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const payload = draftToPayload(draft, coachId?.trim() || null, venueId?.trim() || null);
    try {
      const res = await submitEnquiry(payload);
      if (!res.ok) {
        setSubmitError(res.message);
        return;
      }
      if (!ENQUIRY_SKIP_LOCAL_STORAGE) {
        try {
          localStorage.removeItem(ENQUIRY_DRAFT_KEY);
        } catch {
          /* ignore */
        }
      }
      setDraft(emptyDraft());
      setStep(0);
      setSuccess(true);
    } catch (e) {
      console.error(e);
      setSubmitError(
        e instanceof Error ? e.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const countrySelect = (
    value: string,
    onChange: (v: string) => void,
    id: string,
    placeholder: string
  ) => (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputBase}
    >
      <option value="">{placeholder}</option>
      {countries.map((c) => (
        <option key={c.code} value={c.label}>
          {c.label}
        </option>
      ))}
    </select>
  );

  const step0Blocked = validateStep0(draft) !== null;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-primary/40 backdrop-blur-[2px] transition-opacity duration-200"
        aria-label="Close dialog"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92dvh,820px)] w-full max-w-2xl flex-col rounded-t-3xl border border-primary/12 bg-white shadow-[0_-8px_40px_rgba(0,60,60,0.12)] transition duration-200 ease-out lg:max-w-3xl sm:max-h-[90vh] sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-primary/10 px-5 pb-4 pt-5 sm:px-6">
          <div className="min-w-0">
            {!success ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">About 2 minutes</p>
            ) : null}
            <h2 id={titleId} className="mt-1 text-lg font-semibold text-primary sm:text-xl">
              {success ? "Enquiry sent" : STEP_LABELS[step]}
            </h2>
            {!success ? (
              <div className="mt-3 flex gap-1" aria-hidden>
                {STEP_LABELS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                      i <= step ? "bg-primary" : "bg-primary/15"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={success ? handleSuccessClose : handleClose}
            className="rounded-full p-2 text-primary/60 transition hover:bg-primary/5 hover:text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div
          ref={bodyScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
        >
          {success ? (
            <div className="space-y-4 text-center">
              <p className="text-base font-medium leading-relaxed text-primary">
                Thanks — we&apos;ll match you with the right coach shortly.
              </p>
              <p className="text-sm text-primary/70">
                Our team reads every enquiry. You&apos;ll hear from us by email if we need any extra detail.
              </p>
              <ul className="mx-auto max-w-sm space-y-2 text-left text-sm text-primary/75">
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">1.</span>
                  <span>Watch your inbox (and spam folder) for a reply.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">2.</span>
                  <span>Add any court preferences or schedule constraints when we follow up.</span>
                </li>
              </ul>
              <button
                type="button"
                onClick={handleSuccessClose}
                className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary/90 sm:w-auto sm:px-8"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-6 transition-opacity duration-200">
              {step === 0 ? (
                <div className={sectionBlock}>
                  <p className={helperText}>How we can reach you about this enquiry.</p>
                  <label className="block text-sm font-medium text-primary">
                    Full name <span className="text-red-600">*</span>
                    <input
                      data-autofocus
                      autoComplete="name"
                      value={draft.full_name}
                      onChange={(e) => update("full_name", e.target.value)}
                      className={inputBase}
                      placeholder="Alex García"
                    />
                  </label>
                  <label className="block text-sm font-medium text-primary">
                    Email address <span className="text-red-600">*</span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={draft.email}
                      onChange={(e) => update("email", e.target.value)}
                      className={inputBase}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="block text-sm font-medium text-primary">
                    Phone number <span className="text-primary/45">(optional)</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={draft.phone}
                      onChange={(e) => update("phone", e.target.value.replace(/[^\d+\s()-]/g, ""))}
                      className={inputBase}
                      placeholder="+44 …"
                    />
                  </label>
                  {step0Error ? <p className="text-sm font-medium text-red-600">{step0Error}</p> : null}
                </div>
              ) : null}

              {step === 1 ? (
                <div className={sectionBlock}>
                  <div>
                    <p className={sectionTitle}>About you</p>
                    <p className={helperText}>Tell us a bit about your background (all optional except where noted).</p>
                  </div>
                  <label className="block text-sm font-medium text-primary">
                    Age <span className="text-primary/45">(optional)</span>
                    <input
                      data-autofocus
                      type="number"
                      min={1}
                      max={120}
                      inputMode="numeric"
                      value={draft.age}
                      onChange={(e) => update("age", e.target.value)}
                      className={inputBase}
                      placeholder="e.g. 34"
                    />
                  </label>
                  <div>
                    <label htmlFor="nationality" className="block text-sm font-medium text-primary">
                      Nationality <span className="text-primary/45">(optional)</span>
                    </label>
                    {countrySelect(draft.nationality, (v) => update("nationality", v), "nationality", "Select country")}
                  </div>
                  <div>
                    <label htmlFor="loc-country" className="block text-sm font-medium text-primary">
                      Current location — country <span className="text-primary/45">(optional)</span>
                    </label>
                    {countrySelect(
                      draft.current_location_country,
                      (v) => update("current_location_country", v),
                      "loc-country",
                      "Select country"
                    )}
                  </div>
                  <label className="block text-sm font-medium text-primary">
                    Current location — city <span className="text-primary/45">(optional)</span>
                    <input
                      value={draft.current_location_city}
                      onChange={(e) => update("current_location_city", e.target.value)}
                      className={inputBase}
                      placeholder="e.g. London"
                    />
                  </label>
                  <div>
                    <p className={sectionTitle}>Playing level</p>
                    <p className={helperText}>Select one.</p>
                    <div className="mt-3">
                      <RadioGrid
                        name="playing_level"
                        value={draft.playing_level}
                        onChange={(v) => update("playing_level", v)}
                        options={PLAYING_LEVELS}
                        autofocusFirst
                      />
                    </div>
                  </div>
                  <div>
                    <p className={sectionTitle}>How long have you been playing padel?</p>
                    <div className="mt-3">
                      <RadioGrid
                        name="playing_duration"
                        value={draft.playing_duration}
                        onChange={(v) => update("playing_duration", v)}
                        options={PLAYING_DURATION}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className={sectionBlock}>
                  <div>
                    <p className={sectionTitle}>Training goals</p>
                    <p className={helperText}>What is your main goal? Select all that apply.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {MAIN_GOAL_OPTIONS.map((opt, i) => (
                        <button
                          key={opt}
                          type="button"
                          data-autofocus={i === 0 ? "" : undefined}
                          onClick={() => toggleGoal(opt)}
                          className={pillClass(draft.main_goals.includes(opt))}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block text-sm font-medium text-primary">
                    Describe your goals in more detail <span className="text-primary/45">(optional)</span>
                    <textarea
                      value={draft.goals_detail}
                      onChange={(e) => update("goals_detail", e.target.value)}
                      rows={4}
                      className={inputBase + " mt-1.5 min-h-[5rem] resize-y"}
                      placeholder="Short summary…"
                    />
                  </label>
                </div>
              ) : null}

              {step === 3 ? (
                <div className={sectionBlock}>
                  <div>
                    <p className={sectionTitle}>Preferred training destination(s)</p>
                    <p className={helperText}>
                      Type a country, pick a suggestion, press Enter to add. Remove with ✕.
                    </p>
                    <div className="relative mt-2">
                      <input
                        data-autofocus
                        value={destinationInput}
                        onChange={(e) => setDestinationInput(e.target.value)}
                        onKeyDown={onDestinationKeyDown}
                        className={inputBase.replace("mt-1.5 ", "")}
                        placeholder="Spain, Portugal, Sweden…"
                        autoComplete="off"
                      />
                      {destinationSuggestions.length > 0 && destinationInput.trim() ? (
                        <ul
                          className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-primary/10 bg-white py-1 shadow-lg"
                          role="listbox"
                        >
                          {destinationSuggestions.map((s) => (
                            <li key={s}>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface"
                                onClick={() => addDestination(s)}
                              >
                                {s}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {draft.preferred_destinations.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Selected destinations">
                        {draft.preferred_destinations.map((d) => (
                          <li
                            key={d}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-secondary/10 pl-3 pr-1 text-xs font-semibold text-primary"
                          >
                            {d}
                            <button
                              type="button"
                              onClick={() => removeDestination(d)}
                              className="rounded-full p-1 text-primary/60 hover:bg-primary/10 hover:text-primary"
                              aria-label={`Remove ${d}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div>
                    <p className={sectionTitle}>Preferred training duration</p>
                    <div className="mt-3">
                      <RadioGrid
                        name="preferred_duration"
                        value={draft.preferred_duration}
                        onChange={(v) => update("preferred_duration", v)}
                        options={PREFERRED_DURATION}
                      />
                    </div>
                  </div>
                  <label className="block text-sm font-medium text-primary">
                    Preferred start date <span className="text-primary/45">(optional)</span>
                    <input
                      type="date"
                      value={draft.preferred_start_date}
                      onChange={(e) => update("preferred_start_date", e.target.value)}
                      className={inputBase}
                    />
                  </label>
                  <div>
                    <p className={sectionTitle}>Type of training</p>
                    <div className="mt-3">
                      <RadioGrid
                        name="training_type"
                        value={draft.training_type}
                        onChange={(v) => update("training_type", v)}
                        options={TRAINING_TYPES}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className={sectionBlock}>
                  <div>
                    <p className={sectionTitle}>Approximate budget (per week)</p>
                    <div className="mt-3">
                      <RadioGrid
                        name="budget_range"
                        value={draft.budget_range}
                        onChange={(v) => update("budget_range", v)}
                        options={BUDGET_RANGES}
                        autofocusFirst
                      />
                    </div>
                  </div>
                  <div>
                    <p className={sectionTitle}>Do you need accommodation included?</p>
                    <div className="mt-3">
                      <RadioGrid
                        name="accommodation"
                        value={draft.accommodation}
                        onChange={(v) => update("accommodation", v)}
                        options={ACCOMMODATION_OPTS}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 5 ? (
                <div className={sectionBlock}>
                  <div>
                    <p className={sectionTitle}>Have you trained abroad before?</p>
                    <div className="mt-3">
                      <RadioGrid
                        name="trained_abroad"
                        value={draft.trained_abroad}
                        onChange={(v) => update("trained_abroad", v)}
                        options={YES_NO}
                        autofocusFirst
                      />
                    </div>
                  </div>
                  <label className="block text-sm font-medium text-primary">
                    Any injuries or physical considerations? <span className="text-primary/45">(optional)</span>
                    <textarea
                      value={draft.injuries}
                      onChange={(e) => update("injuries", e.target.value)}
                      rows={3}
                      className={inputBase + " mt-1.5 min-h-[4.5rem] resize-y"}
                    />
                  </label>
                  <label className="block text-sm font-medium text-primary">
                    Anything else we should know? <span className="text-primary/45">(optional)</span>
                    <textarea
                      value={draft.anything_else}
                      onChange={(e) => update("anything_else", e.target.value)}
                      rows={3}
                      className={inputBase + " mt-1.5 min-h-[4.5rem] resize-y"}
                    />
                  </label>
                  <div className="rounded-xl border border-primary/10 bg-surface/60 px-4 py-4">
                    <p className={helperText}>Optional — we can tailor recommendations if you&apos;d like help from our team.</p>
                    <label className="mt-3 flex cursor-pointer gap-3 text-sm text-primary">
                      <input
                        type="checkbox"
                        checked={draft.wants_personalised_recommendation}
                        onChange={(e) => update("wants_personalised_recommendation", e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-primary/25 text-primary"
                      />
                      <span>I&apos;d like a personalised recommendation from Padel Pathways</span>
                    </label>
                  </div>
                </div>
              ) : null}

              {step === 6 ? (
                <div className={sectionBlock}>
                  <p className={helperText}>
                    Check everything looks right. Use <strong className="font-semibold text-primary">Edit</strong> to jump
                    back to a section.
                  </p>

                  <section className="rounded-2xl border border-primary/10 bg-surface/50 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-primary">1. Basic details</h3>
                      <button
                        type="button"
                        onClick={() => setStep(0)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </button>
                    </div>
                    <dl>
                      <SummaryRow label="Full name" value={draft.full_name} />
                      <SummaryRow label="Email" value={draft.email} />
                      <SummaryRow label="Phone" value={draft.phone} />
                    </dl>
                  </section>

                  <section className="rounded-2xl border border-primary/10 bg-surface/50 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-primary">2. Player profile</h3>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </button>
                    </div>
                    <dl>
                      <SummaryRow label="Age" value={draft.age} />
                      <SummaryRow label="Nationality" value={draft.nationality} />
                      <SummaryRow
                        label="Location"
                        value={[draft.current_location_city, draft.current_location_country].filter(Boolean).join(", ")}
                      />
                      <SummaryRow label="Playing level" value={draft.playing_level} />
                      <SummaryRow label="Playing duration" value={draft.playing_duration} />
                    </dl>
                  </section>

                  <section className="rounded-2xl border border-primary/10 bg-surface/50 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-primary">3. Training goals</h3>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </button>
                    </div>
                    <dl>
                      <SummaryRow label="Main goals" value={draft.main_goals.join(", ")} />
                      <SummaryRow label="Details" value={draft.goals_detail} />
                    </dl>
                  </section>

                  <section className="rounded-2xl border border-primary/10 bg-surface/50 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-primary">4. Training preferences</h3>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </button>
                    </div>
                    <dl>
                      <SummaryRow label="Destinations" value={draft.preferred_destinations.join(", ")} />
                      <SummaryRow label="Duration" value={draft.preferred_duration} />
                      <SummaryRow label="Start date" value={draft.preferred_start_date} />
                      <SummaryRow label="Training type" value={draft.training_type} />
                    </dl>
                  </section>

                  <section className="rounded-2xl border border-primary/10 bg-surface/50 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-primary">5. Budget & accommodation</h3>
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </button>
                    </div>
                    <dl>
                      <SummaryRow label="Budget (per week)" value={draft.budget_range} />
                      <SummaryRow label="Accommodation" value={draft.accommodation} />
                    </dl>
                  </section>

                  <section className="rounded-2xl border border-primary/10 bg-surface/50 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-primary">6. Additional information</h3>
                      <button
                        type="button"
                        onClick={() => setStep(5)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </button>
                    </div>
                    <dl>
                      <SummaryRow label="Trained abroad" value={draft.trained_abroad} />
                      <SummaryRow label="Injuries / considerations" value={draft.injuries} />
                      <SummaryRow label="Other" value={draft.anything_else} />
                    </dl>
                    <p className="mt-3 text-sm text-primary">
                      <span className="font-semibold">Personalised recommendation: </span>
                      {draft.wants_personalised_recommendation
                        ? "Yes — from Padel Pathways."
                        : "Not requested."}
                    </p>
                  </section>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {!success ? (
          <footer className="flex shrink-0 flex-col gap-2 border-t border-primary/10 px-5 py-4 sm:px-6">
            {submitError && step === TOTAL_STEPS - 1 ? (
              <p className="text-center text-sm font-medium text-red-600 sm:text-right" role="alert">
                {submitError}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <div className="flex gap-2">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="rounded-xl border border-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-primary/70 transition hover:text-primary"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div>
                {step < TOTAL_STEPS - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={step === 0 && step0Blocked}
                    className="w-full rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleFinalSubmit}
                    className="w-full rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {submitting ? "Sending…" : "Send enquiry"}
                  </button>
                )}
              </div>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
