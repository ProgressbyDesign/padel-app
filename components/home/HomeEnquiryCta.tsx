"use client";

import EnquiryButton from "@/components/enquiry/EnquiryButton";

export default function HomeEnquiryCta({ venueId }: { venueId: string | null }) {
  return (
    <section className="relative left-1/2 right-1/2 -ml-[50vw] w-screen max-w-[100vw] overflow-hidden border-y border-primary/15 bg-dark">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-[#012828] to-dark" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(230,250,80,0.12),transparent)]" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Personal guidance</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Not sure where to start?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/75 sm:text-lg">
            Tell us your level, dates, and goals — we&apos;ll help you find the right coach or training camp.
          </p>
          {venueId ? (
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <EnquiryButton
                venueId={venueId}
                label="Get personalised recommendation"
                className="min-w-[16rem] !bg-accent !text-primary hover:!bg-accent/90"
              />
            </div>
          ) : (
            <p className="mt-8 text-sm text-white/55">
              Browse coaches or venues first, then send an enquiry from a profile.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
