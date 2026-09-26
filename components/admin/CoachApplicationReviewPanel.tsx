"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveCoachApplication,
  approveCoachApplicationWithExisting,
  approveCoachClaim,
  declineCoachApplication,
  requestCoachApplicationChanges,
  type AdminApplicationActionResult,
} from "@/app/admin/(ops)/applications/coach-actions";
import {
  APPLICATION_STATUS_LABELS,
  COACH_APPLICATION_MODE_LABELS,
} from "@/lib/coachProfileApplication/constants";
import type { AdminCoachApplication } from "@/lib/admin/applicationQueries";
import {
  APPROVE_CLAIM_LABEL,
  APPROVE_COACH_LABEL,
} from "@/lib/admin/coachApprovalCopy";
import {
  DUPLICATE_MATCH_REASON_LABELS,
  type DuplicateCoachCandidate,
} from "@/lib/admin/coachDuplicates";
import { publicationAdminLabel } from "@/lib/lifecycle/adminStatus";
import type { CoachClaimTargetSummary } from "@/lib/coachProfileApplication/types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/10";
const primaryButtonClass =
  "min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-40";
const secondaryButtonClass =
  "min-h-10 w-full rounded-xl border border-primary/15 px-3 py-2 text-sm font-semibold disabled:opacity-40";

export default function CoachApplicationReviewPanel({
  application,
  targetCoach,
}: {
  application: AdminCoachApplication;
  targetCoach: CoachClaimTargetSummary | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [note, setNote] = useState(application.review_note ?? "");
  const [approvedCoachId, setApprovedCoachId] = useState(application.coach_id ?? "");
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    DuplicateCoachCandidate[] | null
  >(null);

  const reviewable =
    application.status === "submitted" || application.status === "under_review";
  const isClaim = application.application_mode === "claim_existing";
  const claimAlreadyClaimed = Boolean(isClaim && targetCoach?.is_claimed);
  const showApproved =
    (application.status === "approved" && Boolean(application.coach_id)) ||
    Boolean(approvedCoachId);
  const approvedLink = application.coach_id || approvedCoachId;

  function run(action: () => Promise<AdminApplicationActionResult>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.duplicateCandidates && result.duplicateCandidates.length > 0) {
        // Approval paused: nothing was written. Let the admin resolve it.
        setDuplicateCandidates(result.duplicateCandidates);
        setIsError(false);
        return;
      }
      setMessage(result.message);
      setIsError(!result.ok);
      if (result.ok) {
        setDuplicateCandidates(null);
        if (result.entityId) setApprovedCoachId(result.entityId);
        router.refresh();
      }
    });
  }

  return (
    <aside id="decision" className="scroll-mt-24 space-y-5">
      <section className="rounded-[24px] border border-primary/10 bg-white p-5">
        <h2 className="text-lg">Review controls</h2>
        <dl className="mt-4 grid gap-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/40">
              Status
            </dt>
            <dd className="mt-1 text-sm font-semibold text-primary">
              {APPLICATION_STATUS_LABELS[application.status]}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/40">
              Application type
            </dt>
            <dd className="mt-1 text-sm text-primary/75">
              {COACH_APPLICATION_MODE_LABELS[application.application_mode]}
            </dd>
          </div>
        </dl>

        {showApproved ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <p className="font-semibold">Approved</p>
            <p className="mt-1 text-xs leading-5">
              The applicant now has access to manage this coach profile.
              Onboarding and publication are managed from the coach profile.
            </p>
            {approvedLink ? (
              <a
                href={`/admin/coaches/${approvedLink}`}
                className="mt-2 inline-flex text-sm font-semibold underline-offset-2 hover:underline"
              >
                Open managed coach profile
              </a>
            ) : null}
          </div>
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
                className={secondaryButtonClass}
              >
                Request changes
              </button>
              <button
                type="button"
                disabled={pending || !note.trim()}
                onClick={() => run(() => declineCoachApplication(application.id, note))}
                className="min-h-10 w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-40"
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

        {reviewable && !duplicateCandidates ? (
          <div className="mt-5 border-t border-primary/10 pt-5">
            {isClaim ? (
              <>
                <p className="text-xs leading-5 text-primary/60">
                  Binds this claim to{" "}
                  <span className="font-semibold text-primary">
                    {targetCoach?.name || "the target coach"}
                  </span>{" "}
                  and grants the applicant access. No new profile is created.
                </p>
                {claimAlreadyClaimed ? (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                    This profile has already been claimed. Approval is disabled
                    until the claim target is corrected.
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={
                    pending || !application.target_coach_id || claimAlreadyClaimed
                  }
                  onClick={() => run(() => approveCoachClaim(application.id))}
                  className={`${primaryButtonClass} mt-4`}
                >
                  {APPROVE_CLAIM_LABEL}
                </button>
              </>
            ) : (
              <>
                <p className="text-xs leading-5 text-primary/60">
                  Creates the coach profile from this application and grants the
                  applicant access. Existing profiles are checked first.
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => approveCoachApplication(application.id))}
                  className={`${primaryButtonClass} mt-4`}
                >
                  {APPROVE_COACH_LABEL}
                </button>
              </>
            )}
          </div>
        ) : null}
      </section>

      {reviewable && duplicateCandidates ? (
        <section className="rounded-[24px] border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="text-lg">Possible existing coach</h2>
          <p className="mt-2 text-sm leading-6 text-primary/70">
            We found {duplicateCandidates.length === 1 ? "an existing coach profile" : "existing coach profiles"}{" "}
            that may belong to this applicant. Using an existing profile keeps its
            current content and grants the applicant access to it.
          </p>

          <ul className="mt-4 space-y-3">
            {duplicateCandidates.map((candidate) => (
              <li
                key={candidate.id}
                className="rounded-xl border border-primary/10 bg-white p-4"
              >
                <p className="text-sm font-semibold text-primary">{candidate.name}</p>
                {candidate.role ? (
                  <p className="text-sm text-primary/70">{candidate.role}</p>
                ) : null}
                {candidate.primaryLocation ? (
                  <p className="text-sm text-primary/70">{candidate.primaryLocation}</p>
                ) : null}
                <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-primary/5 px-2 py-0.5 font-semibold text-primary/65">
                    {publicationAdminLabel(candidate.publicationStatus)}
                  </span>
                  {candidate.reasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900"
                    >
                      {DUPLICATE_MATCH_REASON_LABELS[reason]}
                    </span>
                  ))}
                </p>
                {candidate.managedByOtherAccount ? (
                  <p className="mt-2 text-xs leading-5 text-amber-900">
                    Already managed by another account, so it cannot be used for
                    this applicant.
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={pending || candidate.managedByOtherAccount}
                  onClick={() =>
                    run(() =>
                      approveCoachApplicationWithExisting(application.id, candidate.id)
                    )
                  }
                  className={`${primaryButtonClass} mt-3`}
                >
                  Use existing profile
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                approveCoachApplication(application.id, { createSeparateCoach: true })
              )
            }
            className={`${secondaryButtonClass} mt-4 bg-white`}
          >
            Create separate coach
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setDuplicateCandidates(null)}
            className="mt-3 w-full text-center text-xs font-semibold text-primary/55 hover:text-primary"
          >
            Cancel
          </button>
        </section>
      ) : null}
    </aside>
  );
}
