"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import EnquiryModal from "./EnquiryModal";

export type EnquiryButtonProps = {
  coachId?: string | null;
  venueId?: string | null;
  /** Button label (default: Send enquiry) */
  label?: string;
  className?: string;
};

export default function EnquiryButton({
  coachId,
  venueId,
  label = "Send enquiry",
  className = "",
}: EnquiryButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 sm:w-auto sm:min-w-[11rem]",
          className,
        ].join(" ")}
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </button>
      <EnquiryModal
        open={open}
        onClose={() => setOpen(false)}
        coachId={coachId ?? undefined}
        venueId={venueId ?? undefined}
      />
    </>
  );
}
