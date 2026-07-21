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
  Star,
} from "lucide-react";
import { loadManagedVenueOverview } from "@/lib/queries/managedVenue";
import { getStructuredOpeningHours } from "@/lib/openingHours";

export const metadata: Metadata = {
  title: "Venue overview",
  description: "Review venue listing status and completeness on Padel Pathways.",
};

type PageProps = {
  params: Promise<{ venueId: string }>;
};

function hasCoreDetails(venue: {
  name: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  venue_type: string | null;
}): boolean {
  return Boolean(
    venue.name?.trim() &&
      venue.city?.trim() &&
      venue.country?.trim() &&
      venue.address?.trim() &&
      venue.venue_type?.trim()
  );
}

export default async function ManagedVenueOverviewPage({ params }: PageProps) {
  const { venueId } = await params;
  const result = await loadManagedVenueOverview(venueId);
  if (!result) notFound();

  const { venue, imageCount, socialCount } = result;
  const venueName = venue.name?.trim() || "Venue";
  const location = [venue.city, venue.country].filter(Boolean).join(", ");
  const base = `/account/venues/${encodeURIComponent(venue.id)}`;
  const hasHours = Boolean(
    getStructuredOpeningHours(venue.opening_hours_structured)
  );
  const checklist = [
    {
      id: "details",
      label: "Core details present",
      done: hasCoreDetails(venue),
      href: `${base}/details`,
    },
    {
      id: "hours",
      label: "Opening hours configured",
      done: hasHours,
      href: `${base}/details`,
    },
    {
      id: "images",
      label: "At least one image",
      done: imageCount > 0,
      href: `${base}/images`,
    },
    {
      id: "socials",
      label: "At least one social link",
      done: socialCount > 0,
      href: `${base}/socials`,
    },
  ] as const;

  const completedCount = checklist.filter((item) => item.done).length;

  return (
    <div className="space-y-8">
      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
        <div>
          <h2 className="text-2xl font-bold text-primary">Overview</h2>
          <p className="mt-1 text-sm text-primary/60">
            Current public and account status for this venue.
          </p>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Venue
            </dt>
            <dd className="mt-2 font-semibold text-primary">{venueName}</dd>
            <dd className="mt-1 text-sm text-primary/60">
              {location || "Location not provided"}
            </dd>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Public rating
            </dt>
            <dd className="mt-2 flex items-center gap-1.5 font-semibold text-primary">
              {venue.rating === null ? (
                "No rating yet"
              ) : (
                <>
                  <Star className="h-4 w-4 fill-accent text-primary" aria-hidden />
                  {venue.rating.toFixed(1)}
                  {venue.review_count !== null ? (
                    <span className="font-normal text-primary/55">
                      ({venue.review_count} reviews)
                    </span>
                  ) : null}
                </>
              )}
            </dd>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Courts
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {venue.courts === null ? "Not set" : venue.courts}
            </dd>
            <dd className="mt-1 text-sm text-primary/60">
              {venue.court_type?.trim() || "Court type not set"}
            </dd>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Coaching
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {venue.coaching_available ? "Available" : "Not listed"}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/10 px-4 py-3 text-sm text-primary/65">
          <CheckCircle2
            className={`h-4 w-4 shrink-0 ${
              venue.google_place_id ? "text-emerald-600" : "text-primary/35"
            }`}
            aria-hidden
          />
          {venue.google_place_id
            ? "Connected to a Google Place"
            : "No Google Place connection"}
        </div>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-primary">Completeness</h2>
            <p className="mt-1 text-sm text-primary/60">
              {completedCount} of {checklist.length} checklist items complete.
            </p>
          </div>
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
                  <Circle
                    className="h-5 w-5 shrink-0 text-primary/30"
                    aria-hidden
                  />
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
          className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] transition hover:border-primary/20 hover:bg-surface"
        >
          <PenSquare className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="mt-4 text-lg font-bold text-primary">Details</h3>
          <p className="mt-1 text-sm text-primary/60">
            Basic info, hours, and location.
          </p>
        </Link>
        <Link
          href={`${base}/images`}
          className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] transition hover:border-primary/20 hover:bg-surface"
        >
          <ImageIcon className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="mt-4 text-lg font-bold text-primary">Images</h3>
          <p className="mt-1 text-sm text-primary/60">
            {imageCount === 0
              ? "No images yet"
              : `${imageCount} image${imageCount === 1 ? "" : "s"}`}
          </p>
        </Link>
        <Link
          href={`${base}/socials`}
          className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] transition hover:border-primary/20 hover:bg-surface"
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
