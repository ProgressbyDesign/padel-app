"use client";

import EnquiryButton from "@/components/enquiry/EnquiryButton";

export default function HomeEnquiryCta({ venueId }: { venueId: string | null }) {
  return (
    <section className="bg-dark py-16 sm:py-24">
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-[120px]">
        <div className="mx-auto flex max-w-[824px] flex-col items-center gap-8 rounded-[20px] bg-accent px-8 py-10 text-center text-primary sm:px-9 sm:py-12">
          <div className="space-y-4">
            <p className="text-base font-bold uppercase tracking-[0.8px]">Personal guidance</p>
            <h2 className="font-heading text-3xl font-bold leading-tight sm:text-[48px] sm:leading-[52px]">
              Not sure where to start?
            </h2>
            <p className="text-lg leading-7">
              Tell us your level, dates, and goals — we&apos;ll help you find the right coach or training camp.
            </p>
          </div>
          {venueId ? (
            <EnquiryButton
              venueId={venueId}
              label="Get personalised recommendation"
              showIcon={false}
              className="!w-auto !rounded-full !bg-primary !px-6 !py-3 !text-base !font-medium !text-accent-soft hover:!bg-primary/90"
            />
          ) : (
            <p className="text-sm text-primary/70">
              Browse coaches or venues first, then send an enquiry from a profile.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}