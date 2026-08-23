import type { Metadata } from "next";
import Link from "next/link";
import { getAuthenticatedAccount } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Partner with Padel Pathways",
  description:
    "Apply as an individual coach, academy, venue, or padel travel partner on Padel Pathways.",
};

const benefits = [
  "Reach players actively searching for training and coaches abroad.",
  "Structured discovery alongside trusted venues and coaching profiles.",
  "A short authenticated application with progress saved to your account.",
  "Room to grow into profile completion, images, and partner tools after approval.",
] as const;

export default async function JoinPage() {
  const account = await getAuthenticatedAccount();
  const coachAppPath = "/account/applications/coach";
  const venueAppPath = "/account/applications/venue";
  const coachHref = account
    ? coachAppPath
    : `/signup?next=${encodeURIComponent(coachAppPath)}`;
  const venueHref = account
    ? venueAppPath
    : `/signup?next=${encodeURIComponent(venueAppPath)}`;
  const coachLoginHref = `/login?next=${encodeURIComponent(coachAppPath)}`;
  const venueLoginHref = `/login?next=${encodeURIComponent(venueAppPath)}`;

  return (
    <div className="bg-surface/50">
      <section className="border-b border-primary/10 bg-gradient-to-b from-white to-surface/80">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/50">
            Partners
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            Partner with Padel Pathways
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-primary/75 sm:text-lg">
            Coach, academy, venue, and travel partner registration. Player
            accounts are created separately.
          </p>
          <p className="mt-5 text-sm text-primary/60">
            Looking for a player account?{" "}
            <Link href="/signup" className="font-semibold text-primary underline">
              Create a player account
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-xl font-semibold text-primary sm:text-2xl">
          How do you want to partner?
        </h2>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <article className="flex h-full flex-col rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Available now
            </p>
            <h3 className="mt-3 text-xl font-bold text-primary">Individual coach</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-primary/65">
              Create an authenticated application for your coaching profile. Progress
              saves to your account across devices.
            </p>
            <Link
              href={coachHref}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
            >
              {account ? "Continue application" : "Apply as a coach"}
            </Link>
            {!account ? (
              <p className="mt-3 text-xs text-primary/55">
                Already have an account?{" "}
                <Link href={coachLoginHref} className="font-semibold text-primary underline">
                  Log in
                </Link>
              </p>
            ) : null}
          </article>

          <article className="flex h-full flex-col rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Available now
            </p>
            <h3 className="mt-3 text-xl font-bold text-primary">Academy / Venue</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-primary/65">
              Submit your venue details if you own it, manage it, or are
              authorised to represent it. Coaches who only coach at a venue
              should use the individual coach application.
            </p>
            <Link
              href={venueHref}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
            >
              {account ? "Submit your venue details" : "Apply as a coaching business"}
            </Link>
            {!account ? (
              <p className="mt-3 text-xs text-primary/55">
                Already have an account?{" "}
                <Link
                  href={venueLoginHref}
                  className="font-semibold text-primary underline"
                >
                  Log in
                </Link>
              </p>
            ) : null}
          </article>

          <article className="flex h-full flex-col rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Coming next
            </p>
            <h3 className="mt-3 text-xl font-bold text-primary">
              Travel Partner
            </h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-primary/65">
              Travel and holiday packages will get a dedicated partner journey. This is
              not the individual coach application.
            </p>
            <span className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-surface px-4 py-2.5 text-sm font-semibold text-primary/55">
              Coming next
            </span>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-24">
        <h2 className="text-xl font-semibold text-primary sm:text-2xl">Why apply</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {benefits.map((line) => (
            <li
              key={line}
              className="flex gap-3 rounded-2xl border border-primary/10 bg-white px-4 py-4 text-sm text-primary/85 shadow-sm"
            >
              <span
                className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-secondary"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
