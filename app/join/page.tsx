import type { Metadata } from "next";
import JoinApplicationForm from "@/components/join/JoinApplicationForm";

export const metadata: Metadata = {
  title: "Join Padel Pathways",
  description:
    "Apply to list your academy, coaching, or padel travel experiences and connect with international players.",
};

const benefits = [
  "Reach players actively searching for training, camps, and padel holidays abroad.",
  "Structured profile and discovery alongside trusted venues and coaches.",
  "Lead options that match how you prefer to work — introductions, profiles, or both.",
  "Room to grow: approvals, packages, and partner tools as the platform expands.",
] as const;

export default function JoinPage() {
  return (
    <div className="bg-surface/50">
      <section className="border-b border-primary/10 bg-gradient-to-b from-white to-surface/80">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/50">Partners</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            Join Padel Pathways
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-primary/75 sm:text-lg">
            List your academy, coaching services, or padel holiday experiences and connect with international players
            actively looking to train.
          </p>
          <a
            href="#apply-form"
            className="mt-8 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            Apply now
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-xl font-semibold text-primary sm:text-2xl">Why apply</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {benefits.map((line) => (
            <li
              key={line}
              className="flex gap-3 rounded-2xl border border-primary/10 bg-white px-4 py-4 text-sm text-primary/85 shadow-sm"
            >
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-secondary" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="apply-form" className="mx-auto max-w-3xl scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-24">
        <h2 className="text-xl font-semibold text-primary sm:text-2xl">Application</h2>
        <p className="mt-2 text-sm text-primary/65">
          About 6–7 short steps. Your progress is saved in this browser until you submit.
        </p>
        <div className="mt-8">
          <JoinApplicationForm />
        </div>
      </section>
    </div>
  );
}
