"use client";

import { useState, useTransition, type ReactNode } from "react";

type Props = {
  label: string;
  confirmLabel: string;
  pendingLabel?: string;
  onConfirm: () => Promise<{ ok: boolean; message: string }>;
  onDone?: (result: { ok: boolean; message: string }) => void;
  tone?: "danger" | "neutral";
  className?: string;
};

export function ConfirmActionButton({
  label,
  confirmLabel,
  pendingLabel = "Working…",
  onConfirm,
  onDone,
  tone = "danger",
  className = "",
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const base =
    tone === "danger"
      ? "border-red-200 text-red-800 hover:bg-red-50"
      : "border-primary/15 text-primary/80 hover:bg-surface";

  if (confirming) {
    return (
      <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
        <button
          type="button"
          disabled={pending}
          aria-disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await onConfirm();
              setConfirming(false);
              onDone?.(result);
            });
          }}
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 disabled:opacity-60"
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/70"
        >
          Keep
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${base} ${className}`}
    >
      {label}
    </button>
  );
}

export function ActionButton({
  children,
  onClick,
  pending,
  tone = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  pending?: boolean;
  tone?: "primary" | "secondary";
}) {
  const styles =
    tone === "primary"
      ? "bg-primary text-accent hover:bg-primary/90"
      : "border border-primary/15 text-primary/80 hover:bg-surface";
  return (
    <button
      type="button"
      disabled={pending}
      aria-disabled={pending}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${styles}`}
    >
      {children}
    </button>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "amber" | "green" | "red";
}) {
  const styles = {
    neutral: "bg-primary/5 text-primary/70",
    amber: "bg-amber-50 text-amber-950",
    green: "bg-emerald-50 text-emerald-900",
    red: "bg-red-50 text-red-900",
  }[tone];
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles}`}
    >
      {children}
    </span>
  );
}
