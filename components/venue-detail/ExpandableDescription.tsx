"use client";

import { useId, useState } from "react";

type ExpandableDescriptionProps = {
  text: string;
  /** Approximate characters before truncating */
  collapsedLength?: number;
};

export default function ExpandableDescription({ text, collapsedLength = 320 }: ExpandableDescriptionProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trimmed = text.trim();
  const needsToggle = trimmed.length > collapsedLength;
  const shown = !needsToggle || open ? trimmed : `${trimmed.slice(0, collapsedLength).trim()}…`;

  return (
    <div className="space-y-2">
      <p id={id} className="text-base leading-relaxed text-primary/70">
        {shown}
      </p>
      {needsToggle ? (
        <button
          type="button"
          className="text-sm font-semibold text-primary underline decoration-primary/25 underline-offset-4 transition hover:decoration-primary"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
