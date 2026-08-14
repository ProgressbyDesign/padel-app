"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  adminExcludeCoachFromLaunch,
  adminMakeCoachPrivate,
  adminPublishCoach,
  adminSelectCoachForLaunch,
  adminSuspendCoach,
  adminUnselectCoachForLaunch,
} from "@/app/admin/(ops)/coaches/[coachId]/actions";
import {
  canPublishForLaunch,
  launchSelectionAdminLabel,
  launchSelectionStatusOf,
  publicationAdminLabel,
  publicationStatusOf,
  type LifecycleActionResult,
} from "@/lib/lifecycle/adminStatus";

type Tone = "primary" | "neutral" | "danger";

const TONE_STYLES: Record<Tone, string> = {
  primary: "bg-primary text-accent hover:bg-primary/90",
  neutral: "border border-primary/15 bg-white text-primary hover:bg-surface",
  danger: "border border-red-200 bg-red-50 text-red-900 hover:bg-red-100",
};

function LifecycleButton({
  label,
  pendingLabel,
  tone = "neutral",
  disabled,
  disabledReason,
  confirmMessage,
  onAction,
  onResult,
}: {
  label: string;
  pendingLabel: string;
  tone?: Tone;
  disabled?: boolean;
  disabledReason?: string;
  confirmMessage?: string;
  onAction: () => Promise<LifecycleActionResult>;
  onResult: (result: LifecycleActionResult) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending || disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => {
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          startTransition(async () => {
            const result = await onAction();
            onResult(result);
            if (result.ok) router.refresh();
          });
        }}
        className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${TONE_STYLES[tone]}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {disabled && disabledReason ? (
        <p className="text-xs text-primary/50">{disabledReason}</p>
      ) : null}
    </div>
  );
}

export function AdminCoachLaunchControls({
  coachId,
  launchSelectionStatus,
  publicationStatus,
  canManage,
}: {
  coachId: string;
  launchSelectionStatus: unknown;
  publicationStatus: unknown;
  canManage: boolean;
}) {
  const [result, setResult] = useState<LifecycleActionResult | null>(null);
  const launch = launchSelectionStatusOf(launchSelectionStatus);
  const publication = publicationStatusOf(publicationStatus);
  const publishAllowed = canPublishForLaunch(launch);

  if (!canManage) {
    return (
      <p className="text-sm text-primary/55">
        You need profile management permission to change launch selection or
        visibility.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/45">
          Launch selection
        </h3>
        <p className="mt-1 text-sm text-primary/65">
          Currently {launchSelectionAdminLabel(launch)}. Selection curates the
          launch shortlist and never publishes on its own.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <LifecycleButton
            label="Select for launch"
            pendingLabel="Selecting…"
            tone="primary"
            disabled={launch === "selected"}
            disabledReason={
              launch === "selected" ? "Already selected for launch." : undefined
            }
            onAction={() => adminSelectCoachForLaunch(coachId)}
            onResult={setResult}
          />
          <LifecycleButton
            label="Remove from selection"
            pendingLabel="Removing…"
            disabled={launch === "unselected"}
            disabledReason={
              launch === "unselected" ? "Not currently selected." : undefined
            }
            onAction={() => adminUnselectCoachForLaunch(coachId)}
            onResult={setResult}
          />
          <LifecycleButton
            label="Exclude from launch"
            pendingLabel="Excluding…"
            tone="danger"
            disabled={launch === "excluded"}
            disabledReason={
              launch === "excluded" ? "Already excluded." : undefined
            }
            onAction={() => adminExcludeCoachFromLaunch(coachId)}
            onResult={setResult}
          />
        </div>
      </div>

      <div className="border-t border-primary/10 pt-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/45">
          Visibility
        </h3>
        <p className="mt-1 text-sm text-primary/65">
          Currently {publicationAdminLabel(publication)}. Publishing makes this
          profile visible to anonymous visitors.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <LifecycleButton
            label="Publish coach"
            pendingLabel="Publishing…"
            tone="primary"
            disabled={!publishAllowed || publication === "published"}
            disabledReason={
              publication === "published"
                ? "Already published."
                : !publishAllowed
                  ? "Select this coach for launch before publishing."
                  : undefined
            }
            confirmMessage="Publish this coach? The profile becomes publicly visible immediately."
            onAction={() => adminPublishCoach(coachId)}
            onResult={setResult}
          />
          <LifecycleButton
            label="Make private"
            pendingLabel="Updating…"
            disabled={publication === "private"}
            disabledReason={
              publication === "private" ? "Already private." : undefined
            }
            onAction={() => adminMakeCoachPrivate(coachId)}
            onResult={setResult}
          />
          <LifecycleButton
            label="Suspend coach"
            pendingLabel="Suspending…"
            tone="danger"
            disabled={publication === "suspended"}
            disabledReason={
              publication === "suspended" ? "Already suspended." : undefined
            }
            confirmMessage="Suspend this coach? The profile is removed from all public surfaces."
            onAction={() => adminSuspendCoach(coachId)}
            onResult={setResult}
          />
        </div>
      </div>

      {result ? (
        <p
          role="status"
          className={`text-sm ${result.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
