"use client";

import type { ReactNode } from "react";

export function RequiredIndicator() {
  return (
    <span className="font-semibold text-primary/55" aria-hidden>
      {" "}
      *
    </span>
  );
}

export function RequiredLegend({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-primary/55 ${className}`}>
      <span className="font-semibold text-primary/70">*</span> Required field
    </p>
  );
}

export function FieldError({
  id,
  message,
}: {
  id?: string;
  message?: string | null;
}) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

export function ErrorSummary({
  title = "Fix the highlighted fields before continuing.",
  errors,
}: {
  title?: string;
  errors: Record<string, string>;
}) {
  const messages = Object.values(errors).filter(Boolean);
  if (messages.length === 0) return null;
  const unique = [...new Set(messages)];
  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      role="alert"
      aria-live="polite"
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {unique.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  errorId,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string | null;
  errorId?: string;
  hint?: string;
  children: ReactNode;
}) {
  const describedBy = [
    hint ? `${htmlFor}-hint` : null,
    error ? errorId ?? `${htmlFor}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-primary">
        {label}
        {required ? <RequiredIndicator /> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs text-primary/55">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId ?? `${htmlFor}-error`} message={error} />
      {/* Consumers should pass aria-invalid / aria-describedby on the control */}
      {describedBy ? null : null}
    </div>
  );
}

export function fieldAccessibility(
  fieldId: string,
  error?: string | null,
  hint?: boolean
) {
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = [
    hint ? hintId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    id: fieldId,
    "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": describedBy || undefined,
  } as const;
}

export function focusFirstInvalidField(errors: Record<string, string>) {
  const firstKey = Object.keys(errors)[0];
  if (!firstKey) return;
  const fieldId = firstKey.includes(".")
    ? firstKey.replace(/\./g, "-")
    : firstKey;
  const el =
    document.getElementById(fieldId) ??
    document.querySelector<HTMLElement>(`[name="${firstKey}"]`) ??
    document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
  el?.focus();
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}
