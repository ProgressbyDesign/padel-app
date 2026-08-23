"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  publishProfile,
  restoreDraftProfile,
  suspendProfile,
  unpublishProfile,
} from "@/app/admin/(ops)/publicationActions";
import {
  ordinaryPublicationAction,
  publicationKindNoun,
  type ProfilePublicationKind,
} from "@/lib/admin/publication";
import {
  publicationAdminLabel,
  publicationStatusOf,
  type LifecycleActionResult,
} from "@/lib/lifecycle/adminStatus";

export function AdminPublicationControls({
  kind,
  profileId,
  publicationStatus,
  canManage,
}: {
  kind: ProfilePublicationKind;
  profileId: string;
  publicationStatus: unknown;
  canManage: boolean;
}) {
  const [result, setResult] = useState<LifecycleActionResult | null>(null);
  const publication = publicationStatusOf(publicationStatus);
  const action = ordinaryPublicationAction(publication);
  const noun = publicationKindNoun(kind);
  const statusLabel = publicationAdminLabel(publication);

  if (!canManage) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-primary/80">
          Status: <span className="font-semibold">{statusLabel}</span>
        </p>
        <p className="text-sm text-primary/55">
          You need profile management permission to publish or unpublish.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-primary/80">
          Status: <span className="font-semibold">{statusLabel}</span>
        </p>
        <p className="mt-1 text-sm text-primary/65">
          Draft profiles remain hidden until an administrator publishes them.
        </p>
        <div className="mt-4">
          {action === "publish" ? (
            <PublicationButton
              label={`Publish ${noun}`}
              pendingLabel="Publishing…"
              confirmMessage={`Publish this ${noun}? The profile becomes publicly visible immediately.`}
              onAction={() => publishProfile(kind, profileId)}
              onResult={setResult}
            />
          ) : null}
          {action === "unpublish" ? (
            <PublicationButton
              label={`Unpublish ${noun}`}
              pendingLabel="Unpublishing…"
              confirmMessage={`Unpublish this ${noun}? The profile returns to draft and is hidden from the public site.`}
              onAction={() => unpublishProfile(kind, profileId)}
              onResult={setResult}
            />
          ) : null}
          {action === "none" ? (
            <p className="text-sm text-primary/60">
              Ordinary Publish and Unpublish are unavailable while this {noun} is
              suspended. Use Advanced to restore it to draft first.
            </p>
          ) : null}
        </div>
      </div>

      <details className="rounded-2xl border border-primary/10 bg-surface/40 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-primary/70">
          Advanced
        </summary>
        <p className="mt-2 text-xs leading-5 text-primary/55">
          Suspension is an exceptional moderation state. Ordinary bulk
          Publish/Unpublish will not change a suspended profile.
        </p>
        <div className="mt-3">
          {publication === "suspended" ? (
            <PublicationButton
              label="Restore to draft"
              pendingLabel="Restoring…"
              confirmMessage={`Restore this ${noun} to draft? It will stay hidden until published.`}
              onAction={() => restoreDraftProfile(kind, profileId)}
              onResult={setResult}
            />
          ) : (
            <PublicationButton
              label={`Suspend ${noun}`}
              pendingLabel="Suspending…"
              tone="danger"
              confirmMessage={`Suspend this ${noun}? The profile is removed from all public surfaces.`}
              onAction={() => suspendProfile(kind, profileId)}
              onResult={setResult}
            />
          )}
        </div>
      </details>

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

function PublicationButton({
  label,
  pendingLabel,
  confirmMessage,
  onAction,
  onResult,
  tone = "primary",
}: {
  label: string;
  pendingLabel: string;
  confirmMessage: string;
  onAction: () => Promise<LifecycleActionResult>;
  onResult: (result: LifecycleActionResult) => void;
  tone?: "primary" | "danger";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const className =
    tone === "danger"
      ? "inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      : "inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirmMessage)) return;
        startTransition(async () => {
          const next = await onAction();
          onResult(next);
          if (next.ok) router.refresh();
        });
      }}
      className={className}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
