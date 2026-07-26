"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createCoachApplicationDraft,
  searchClaimableCoachesAction,
} from "@/app/account/applications/coach/actions";
import type { CoachClaimTargetSummary } from "@/lib/coachProfileApplication/types";
import { ErrorSummary } from "@/components/forms/FormField";

export default function CoachApplicationEntry({
  initialMode,
  initialCoachId,
  initialTarget,
}: {
  initialMode?: "create_new" | "claim_existing" | null;
  initialCoachId?: string | null;
  initialTarget?: CoachClaimTargetSummary | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"create_new" | "claim_existing" | null>(
    initialMode ?? null
  );
  const [searchQuery, setSearchQuery] = useState(
    initialTarget?.name?.trim() ?? ""
  );
  const [searchResults, setSearchResults] = useState<CoachClaimTargetSummary[]>(
    []
  );
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CoachClaimTargetSummary | null>(
    initialTarget && !initialTarget.is_claimed ? initialTarget : null
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const canSearch =
    mode === "claim_existing" && searchQuery.trim().length >= 2 && !selected;
  const visibleResults = canSearch ? searchResults : [];

  useEffect(() => {
    if (!canSearch) return;
    const q = searchQuery.trim();
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setSearching(true);
      void searchClaimableCoachesAction(q).then((result) => {
        if (cancelled) return;
        setSearching(false);
        if (!result.ok) {
          setSearchError(result.message);
          setSearchResults([]);
          return;
        }
        setSearchError(null);
        setSearchResults(result.coaches);
      });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [canSearch, searchQuery]);

  function startDraft() {
    setError(null);
    setFieldErrors({});
    if (!mode) {
      setFieldErrors({ mode: "Choose how you want to apply." });
      return;
    }
    if (mode === "claim_existing" && !selected) {
      setFieldErrors({
        target_coach_id: "Select a coach profile from the search results.",
      });
      return;
    }

    startTransition(async () => {
      const result = await createCoachApplicationDraft({
        mode,
        targetCoachId: mode === "claim_existing" ? selected?.id : null,
      });
      if (result.status === "error") {
        setError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.push("/account/applications/coach");
      router.refresh();
    });
  }

  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-6 sm:p-7">
      <h2 className="text-xl font-bold text-primary">Start your application</h2>
      <p className="mt-2 text-sm leading-6 text-primary/65">
        Choose whether to claim an existing profile or create a new one. Progress
        saves to your account.
      </p>

      {error || Object.keys(fieldErrors).length > 0 ? (
        <div className="mt-4">
          <ErrorSummary
            title={error ?? "Fix the highlighted fields before continuing."}
            errors={fieldErrors}
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setMode("claim_existing");
            setFieldErrors({});
          }}
          className={`rounded-xl border px-4 py-4 text-left transition ${
            mode === "claim_existing"
              ? "border-primary bg-primary text-accent"
              : "border-primary/15 bg-white hover:border-primary/30"
          }`}
          aria-pressed={mode === "claim_existing"}
        >
          <span className="block text-sm font-semibold">
            Claim an existing profile
          </span>
          <span
            className={`mt-1 block text-xs leading-5 ${
              mode === "claim_existing" ? "text-accent/75" : "text-primary/55"
            }`}
          >
            Choose this if Padel Pathways already has a profile for you.
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("create_new");
            setSelected(null);
            setSearchResults([]);
            setFieldErrors({});
          }}
          className={`rounded-xl border px-4 py-4 text-left transition ${
            mode === "create_new"
              ? "border-primary bg-primary text-accent"
              : "border-primary/15 bg-white hover:border-primary/30"
          }`}
          aria-pressed={mode === "create_new"}
        >
          <span className="block text-sm font-semibold">Create a new profile</span>
          <span
            className={`mt-1 block text-xs leading-5 ${
              mode === "create_new" ? "text-accent/75" : "text-primary/55"
            }`}
          >
            Choose this if you cannot find an existing profile.
          </span>
        </button>
      </div>
      {fieldErrors.mode ? (
        <p className="mt-2 text-sm text-red-700">{fieldErrors.mode}</p>
      ) : null}

      {mode === "claim_existing" ? (
        <div className="mt-6 space-y-3">
          <label className="block text-sm font-semibold text-primary">
            Search by coach name, city, or country
            <input
              className="mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/10"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                if (selected) setSelected(null);
              }}
              placeholder="Start typing…"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.target_coach_id)}
            />
          </label>
          {searching ? (
            <p className="text-sm text-primary/55">Searching coaches…</p>
          ) : null}
          {searchError ? (
            <p className="text-sm text-red-700" role="alert">
              {searchError}
            </p>
          ) : null}
          {fieldErrors.target_coach_id ? (
            <p className="text-sm text-red-700">{fieldErrors.target_coach_id}</p>
          ) : null}

          {selected ? (
            <div className="rounded-2xl border border-primary bg-surface/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                Selected profile
              </p>
              <div className="mt-3 flex gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-primary/10">
                  {selected.image_url ? (
                    <Image
                      src={selected.image_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-primary">
                    {selected.name || "Coach"}
                  </p>
                  <p className="mt-0.5 text-xs text-primary/60">
                    {[selected.role, selected.primaryLocation, selected.venueName]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-primary/70 underline-offset-2 hover:underline"
                onClick={() => {
                  setSelected(null);
                  setSearchQuery("");
                }}
              >
                Choose another profile
              </button>
            </div>
          ) : null}

          {!selected && visibleResults.length > 0 ? (
            <ul className="space-y-2" aria-label="Coach search results">
              {visibleResults.map((coach) => (
                <li key={coach.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(coach);
                      setSearchQuery(coach.name ?? "");
                      setSearchResults([]);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-primary/15 bg-white px-3 py-3 text-left transition hover:border-primary/30 hover:bg-surface"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-primary/10">
                      {coach.image_url ? (
                        <Image
                          src={coach.image_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : null}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-primary">
                        {coach.name || "Coach"}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-primary/55">
                        {[coach.role, coach.primaryLocation, coach.venueName]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-primary">
                      Claim profile
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        <button
          type="button"
          disabled={pending || !mode || (mode === "claim_existing" && !selected)}
          onClick={startDraft}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-60"
        >
          {pending
            ? "Starting…"
            : mode === "claim_existing"
              ? "Continue with this profile"
              : "Start application"}
        </button>
        {initialCoachId && !initialTarget ? (
          <p className="mt-3 text-sm text-amber-800">
            That profile is already claimed or unavailable. Search for another
            unclaimed profile, or create a new one.
          </p>
        ) : null}
      </div>
    </section>
  );
}
