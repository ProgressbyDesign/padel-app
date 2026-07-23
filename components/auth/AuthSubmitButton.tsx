"use client";

import { useFormStatus } from "react-dom";

type AuthSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
};

export default function AuthSubmitButton({
  idleLabel,
  pendingLabel,
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-base font-semibold text-accent shadow-sm transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-65"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
