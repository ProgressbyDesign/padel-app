import Link from "next/link";
import { CircleUserRound } from "lucide-react";

export default function EmptyAccountState() {
  return (
    <section className="rounded-[24px] border border-dashed border-primary/20 bg-white px-6 py-12 text-center sm:px-10">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/8 text-primary">
        <CircleUserRound className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-5 text-2xl text-primary">
        Ready to find your next coach?
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-base leading-6 text-primary/65">
        Browse published coaches, send an enquiry, and keep your bookings in one
        place.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/coaches"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
        >
          Find coaches
        </Link>
        <Link
          href="/account/bookings"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
        >
          My bookings
        </Link>
      </div>
    </section>
  );
}
