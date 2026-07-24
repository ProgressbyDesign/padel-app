import type { Metadata } from "next";
import Link from "next/link";
import { getAuthenticatedAccount } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Join Padel Pathways",
  description:
    "Apply as an individual coach, academy, or padel travel partner on Padel Pathways.",
};

const benefits = [
  "Reach players actively searching for training and coaches abroad.",
  "Structured discovery alongside trusted venues and coaching profiles.",
  "A short authenticated application with progress saved to your account.",
  "Room to grow into profile completion, images, and partner tools after approval.",
] as const;

export default async function JoinPage() {
  const account = await getAuthenticatedAccount();
  const coachHref = account
    ? "/account/applications/coach"
    : "/signup?next=/account/applications/coach";
  const venueHref = account
    ? "/account/applications/venue"
    : "/signup?next=/account/applications/venue";
  const loginHref = `/login?next=${encodeURIComponent("/account/applications/coach")}`;

  return (
    <div className="bg-surface/50">
      <section className="border-b border-primary/10 bg-gradient-to-b from-white to-surface/80">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/50">
            Partners
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            Join Padel Pathways
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-primary/75 sm:text-lg">
            Choose how you want to partner with us. Coaches and venue
            representatives can start a short account-based application today.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-xl font-semibold text-primary sm:text-2xl">
          How do you want to join?
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
                <Link href={loginHref} className="font-semibold text-primary underline">
                  Log in
                </Link>
              </p>
            ) : null}
          </article>

          <article className="flex h-full flex-col rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Available now
            </p>
            <h3 className="mt-3 text-xl font-bold text-primary">Academy or venue</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-primary/65">
              Manage or claim a venue if you own it, manage it, or are
              authorised to represent it. Coaches who only coach at a venue
              should use the individual coach application.
            </p>
            <Link
              href={venueHref}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
            >
              {account ? "Manage or claim a venue" : "Apply for a venue"}
            </Link>
          </article>

          <article className="flex h-full flex-col rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Coming next
            </p>
            <h3 className="mt-3 text-xl font-bold text-primary">
              Padel holiday or travel partner
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
