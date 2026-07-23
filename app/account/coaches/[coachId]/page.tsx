import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ImageIcon,
  Link2,
  PenSquare,
} from "lucide-react";
import { loadManagedCoachOverview } from "@/lib/queries/managedCoach";

export const metadata: Metadata = {
  title: "Coach overview",
  description: "Review coach profile status and completeness.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function ManagedCoachOverviewPage({ params }: PageProps) {
  const { coachId } = await params;
  const result = await loadManagedCoachOverview(coachId);
  if (!result) notFound();

  const { coach, imageCount, socialCount, venueCount, audienceAdults, audienceJuniors, outcomes, primaryLocation } =
    result;
  const base = `/account/coaches/${encodeURIComponent(coach.id)}`;
  const hasAudience = audienceAdults || audienceJuniors;
  const hasPrimaryImage = imageCount > 0 || Boolean(coach.image_url?.trim());

  const checklist = [
    {
      id: "name-role",
      label: "Name and role",
      done: Boolean(coach.name?.trim() && coach.role?.trim()),
      href: `${base}/details`,
    },
    {
      id: "description",
      label: "Coaching description",
      done: Boolean(coach.description?.trim() && coach.description.trim().length >= 40),
      href: `${base}/details`,
    },
    {
      id: "experience",
      label: "Experience",
      done: coach.experience_years !== null,
      href: `${base}/details`,
    },
    {
      id: "audience",
      label: "Audience",
      done: hasAudience,
      href: `${base}/details`,
    },
    {
      id: "outcomes",
      label: "Outcomes",
      done: outcomes.length > 0,
      href: `${base}/details`,
    },
    {
      id: "image",
      label: "Primary image",
      done: hasPrimaryImage,
      href: `${base}/images`,
    },
    {
      id: "price",
      label: "Hourly price",
      done: coach.price_from !== null,
      href: `${base}/details`,
    },
    {
      id: "social",
      label: "Social link",
      done: socialCount > 0,
      href: `${base}/socials`,
    },
    {
      id: "venue",
      label: "Linked venue",
      done: venueCount > 0,
      href: base,
    },
  ] as const;

  const completedCount = checklist.filter((item) => item.done).length;

  return (
    <div className="space-y-8">
      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
        <div>
          <h2 className="text-2xl font-bold text-primary">Overview</h2>
          <p className="mt-1 text-sm text-primary/60">
            Current listing status for this coach profile.
          </p>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Experience
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {coach.experience_years === null
                ? "Not set"
                : `${coach.experience_years} years`}
            </dd>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Primary location
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {primaryLocation || "Not linked yet"}
            </dd>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Images
            </dt>
            <dd className="mt-2 font-semibold text-primary">{imageCount}</dd>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Social links
            </dt>
            <dd className="mt-2 font-semibold text-primary">{socialCount}</dd>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Linked venues
            </dt>
            <dd className="mt-2 font-semibold text-primary">{venueCount}</dd>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Price from
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {coach.price_from === null ? "Not set" : `€${coach.price_from}`}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
        <div>
          <h2 className="text-2xl font-bold text-primary">Profile completeness</h2>
          <p className="mt-1 text-sm text-primary/60">
            Complete your profile to give players more confidence and improve your
            chances of appearing in relevant searches.
          </p>
          <p className="mt-3 text-sm font-semibold text-primary">
            {completedCount} of {checklist.length} checklist items complete
          </p>
        </div>

        <ul className="mt-6 space-y-3">
          {checklist.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-2xl border border-primary/10 px-4 py-3 transition hover:bg-surface"
              >
                {item.done ? (
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-primary/30" aria-hidden />
                )}
                <span className="flex-1 text-sm font-semibold text-primary">
                  {item.label}
                </span>
                <ArrowRight className="h-4 w-4 text-primary/40" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href={`${base}/details`}
          className="rounded-[24px] border border-primary/10 bg-white p-5 transition hover:border-primary/20 hover:bg-surface"
        >
          <PenSquare className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="mt-4 text-lg font-bold text-primary">Details</h3>
          <p className="mt-1 text-sm text-primary/60">Profile fields and attributes.</p>
        </Link>
        <Link
          href={`${base}/images`}
          className="rounded-[24px] border border-primary/10 bg-white p-5 transition hover:border-primary/20 hover:bg-surface"
        >
          <ImageIcon className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="mt-4 text-lg font-bold text-primary">Images</h3>
          <p className="mt-1 text-sm text-primary/60">
            {imageCount === 0 ? "No images yet" : `${imageCount} image${imageCount === 1 ? "" : "s"}`}
          </p>
        </Link>
        <Link
          href={`${base}/socials`}
          className="rounded-[24px] border border-primary/10 bg-white p-5 transition hover:border-primary/20 hover:bg-surface"
        >
          <Link2 className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="mt-4 text-lg font-bold text-primary">Social links</h3>
          <p className="mt-1 text-sm text-primary/60">
            {socialCount === 0
              ? "No links yet"
              : `${socialCount} link${socialCount === 1 ? "" : "s"}`}
          </p>
        </Link>
      </section>
    </div>
  );
}
