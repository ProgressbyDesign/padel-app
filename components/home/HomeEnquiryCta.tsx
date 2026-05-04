"use client";

import EnquiryButton from "@/components/enquiry/EnquiryButton";

export default function HomeEnquiryCta({ venueId }: { venueId: string | null }) {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-primary/15 bg-white px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
      <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Not sure where to start?</h2>
      <p className="mt-3 text-primary/70">
        Tell us your level, dates, and goals — we&apos;ll help you find the right coach or programme.
      </p>
      {venueId ? (
        <div className="mt-8 flex justify-center">
          <EnquiryButton venueId={venueId} label="Get personalised recommendation" className="min-w-[14rem]" />
        </div>
      ) : (
        <p className="mt-6 text-sm text-primary/60">
          Browse coaches or venues first, then send an enquiry from a profile.
        </p>
      )}
    </div>
  );
}
