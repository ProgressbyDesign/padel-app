"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveCoachApplicationWithExisting,
  createAndApproveCoachApplication,
  declineCoachApplication,
  requestCoachApplicationChanges,
  searchCoachesForApprovalAction,
  startCoachApplicationReview,
} from "@/app/admin/(ops)/applications/coach-actions";
import { coachingRoleLabel } from "@/lib/coachProfileApplication/constants";
import type {
  AdminCoachApplication,
  AdminCoachSearchResult,
} from "@/lib/admin/applicationQueries";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/10";

export default function CoachApplicationReviewPanel({
  application,
}: {
  application: AdminCoachApplication;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [note, setNote] = useState(application.review_note ?? "");
  const [search, setSearch] = useState(application.full_name ?? "");
  const [results, setResults] = useState<AdminCoachSearchResult[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState(application.coach_id ?? "");
  const [name, setName] = useState(application.full_name ?? "");
  const [role, setRole] = useState(
    application.coaching_role === "other"
      ? application.coaching_role_other ?? ""
      : coachingRoleLabel(application.coaching_role)
  );
  const [description, setDescription] = useState(application.description ?? "");
  const [experienceYears, setExperienceYears] = useState(
    application.experience_years === null ? "" : String(application.experience_years)
  );
  const [phone, setPhone] = useState(application.phone ?? "");
  const reviewable =
    application.status === "submitted" || application.status === "under_review";

  function run(
    action: () => Promise<{ ok: boolean; message: string; entityId?: string }>
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      setIsError(!result.ok);
      if (result.entityId && !result.ok) setSelectedCoachId(result.entityId);
      if (result.ok) router.refresh();
    });
  }

  function searchCoaches() {
    setMessage(null);
    startTransition(async () => {
      const result = await searchCoachesForApprovalAction(search);
      if (!result.ok) {
        setIsError(true);
        setMessage(result.message);
        return;
      }
      setResults(result.coaches);
      setIsError(false);
      if (result.coaches.length === 0) setMessage("No matching coaches found.");
    });
  }

  return (
    <aside className="space-y-5">
      <section className="rounded-[24px] border border-primary/10 bg-white p-5">
        <h2 className="text-lg">Review controls</h2>
        {application.status === "submitted" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => startCoachApplicationReview(application.id))}
            className="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-50"
          >
            Start review
          </button>
        ) : null}

        {reviewable ? (
          <div className="mt-5">
            <label className="text-sm font-semibold">
              Review note
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                maxLength={2000}
                className={inputClass}
                placeholder="Required for changes or decline"
              />
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={pending || !note.trim()}
                onClick={() =>
                  run(() => requestCoachApplicationChanges(application.id, note))
                }
                className="min-h-10 rounded-xl border border-primary/15 px-3 py-2 text-sm font-semibold disabled:opacity-40"
              >
                Request changes
              </button>
              <button
                type="button"
                disabled={pending || !note.trim()}
                onClick={() => run(() => declineCoachApplication(application.id, note))}
                className="min-h-10 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-40"
              >
                Decline
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <p
            className={`mt-4 rounded-xl p-3 text-sm ${
              isError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
            }`}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </section>

      {reviewable ? (
        <>
          <section className="rounded-[24px] border border-primary/10 bg-white p-5">
            <h2 className="text-lg">Approve with existing coach</h2>
            <div className="mt-4 flex gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-primary/15 px-3 py-2.5 text-sm"
                placeholder="Search coach name"
              />
              <button
                type="button"
                disabled={pending || search.trim().length < 2}
                onClick={searchCoaches}
                className="rounded-xl border border-primary/15 px-4 text-sm font-semibold disabled:opacity-40"
              >
                Search
              </button>
            </div>
            {results.length ? (
              <div className="mt-3 space-y-2">
                {results.map((coach) => (
                  <label
                    key={coach.id}
                    className="flex cursor-pointer gap-3 rounded-xl border border-primary/10 p-3"
                  >
                    <input
                      type="radio"
                      name="coach"
                      checked={selectedCoachId === coach.id}
                      onChange={() => setSelectedCoachId(coach.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{coach.name}</span>
                      <span className="block truncate text-xs text-primary/50">
                        {[coach.role, coach.experience_years === null ? null : `${coach.experience_years} years`]
                          .filter(Boolean)
                          .join(" · ") || "Existing profile"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            {selectedCoachId ? (
              <p className="mt-3 break-all text-xs text-primary/50">
                Selected: {selectedCoachId}
              </p>
            ) : null}
            <button
              type="button"
              disabled={pending || !selectedCoachId}
              onClick={() =>
                run(() =>
                  approveCoachApplicationWithExisting(
                    application.id,
                    selectedCoachId
                  )
                )
              }
              className="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-40"
            >
              Approve selected coach
            </button>
          </section>

          <section className="rounded-[24px] border border-primary/10 bg-white p-5">
            <h2 className="text-lg">Create and approve coach</h2>
            <p className="mt-2 text-xs leading-5 text-primary/50">
              Review these profile fields before creating the approved coach.
            </p>
            <div className="mt-4 space-y-3">
              <Field label="Name" value={name} setValue={setName} />
              <Field label="Role" value={role} setValue={setRole} />
              <label className="block text-sm font-semibold">
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-semibold">
                Experience years
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={experienceYears}
                  onChange={(event) => setExperienceYears(event.target.value)}
                  className={inputClass}
                />
              </label>
              <Field label="Phone" value={phone} setValue={setPhone} />
            </div>
            <button
              type="button"
              disabled={pending || name.trim().length < 2}
              onClick={() =>
                run(() =>
                  createAndApproveCoachApplication({
                    applicationId: application.id,
                    name,
                    role,
                    description,
                    experienceYears:
                      experienceYears.trim() === ""
                        ? null
                        : Number(experienceYears),
                    phone,
                  })
                )
              }
              className="mt-5 min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-40"
            >
              Create coach and approve
            </button>
          </section>
        </>
      ) : null}
    </aside>
  );
}

function Field({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={inputClass}
      />
    </label>
  );
}
