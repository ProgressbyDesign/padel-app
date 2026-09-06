import Link from "next/link";
import { CircleAlert } from "lucide-react";

export default function ManagedVenueNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[1680px] justify-center px-4 py-16 sm:px-6 lg:px-[120px]">
      <section className="w-full max-w-xl rounded-[24px] border border-primary/10 bg-white p-8 text-center shadow-[0_12px_36px_rgba(3,19,34,0.06)]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/8 text-primary">
          <CircleAlert className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-3xl text-primary">Venue unavailable</h1>
        <p className="mt-3 text-base leading-6 text-primary/60">
          This venue could not be opened from your account. Return to your dashboard to
          view the venues you can manage.
        </p>
        <Link
          href="/account"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
        >
          Back to account
        </Link>
      </section>
    </div>
  );
}
