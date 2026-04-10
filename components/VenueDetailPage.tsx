import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Dumbbell,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";
import type { Venue } from "../lib/venueFilters";
import { isPremiumTrainingVenue } from "../lib/venueFilters";
import VenueCard from "./VenueCard";
import {
  formatOpeningHoursLines,
  formatRatingValue,
  getCoordinates,
  getSurfaceLabel,
  getVenueDescriptionForPdp,
  normalizeWebsiteUrl,
  venueExperienceLabel,
} from "../lib/venueDetailHelpers";

type VenueDetailPageProps = {
  venue: Venue;
  similarVenues: Venue[];
};

export default function VenueDetailPage({ venue, similarVenues }: VenueDetailPageProps) {
  const imageSrc = venue.image_url || "/assets/court-placeholder.jpg";
  const locationLine = [venue.city, venue.country].filter(Boolean).join(", ");
  const ratingStr = formatRatingValue(venue.rating);
  const reviewCount =
    typeof venue.review_count === "number" && venue.review_count > 0
      ? venue.review_count.toLocaleString()
      : null;
  const surfaceLabel = getSurfaceLabel(venue.court_type);
  const courtsDisplay = typeof venue.courts === "number" ? String(venue.courts) : null;
  const coachingYes = Boolean(venue.coaching_available);
  const experienceLabel = venueExperienceLabel(venue.venue_type);
  const isPremium = isPremiumTrainingVenue(venue);
  const description = getVenueDescriptionForPdp(venue);
  const websiteUrl = venue.website ? normalizeWebsiteUrl(venue.website) : null;
  const phoneRaw = venue.phone?.trim() || null;
  const addressRaw = venue.address?.trim() || null;
  const hoursLines = formatOpeningHoursLines(venue.opening_hours);
  const coords = getCoordinates(venue);

  const hasContactBlock =
    Boolean(websiteUrl) || Boolean(phoneRaw) || Boolean(hoursLines?.length) || Boolean(addressRaw);

  const mapEmbedUrl =
    coords != null
      ? (() => {
          const { lat, lng } = coords;
          const pad = 0.02;
          const minLon = lng - pad;
          const minLat = lat - pad;
          const maxLon = lng + pad;
          const maxLat = lat + pad;
          return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
            `${minLon},${minLat},${maxLon},${maxLat}`
          )}&layer=map&marker=${encodeURIComponent(`${lat},${lng}`)}`;
        })()
      : null;

  const mapsLink =
    coords != null ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}` : null;

  return (
    <div className="min-h-full bg-white pb-16">
      <div className="relative aspect-[21/9] min-h-[220px] w-full sm:aspect-[21/8] sm:min-h-[280px] md:min-h-[320px]">
        <Image
          src={imageSrc}
          alt={venue.name ? `${venue.name} — padel venue` : "Padel venue"}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 md:p-8">
          <Link
            href="/"
            className="pointer-events-auto mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
                {venue.name || "Venue"}
              </h1>
              {locationLine ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-white/90 sm:text-base">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {locationLine}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {ratingStr ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-slate-900 shadow-sm">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                    {ratingStr}
                    {reviewCount ? (
                      <span className="font-normal text-slate-500">({reviewCount} reviews)</span>
                    ) : null}
                  </span>
                ) : null}
                {courtsDisplay ? (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    {courtsDisplay} courts
                  </span>
                ) : null}
                {surfaceLabel !== "Not specified" ? (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    {surfaceLabel}
                  </span>
                ) : null}
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  {coachingYes ? "Coaching" : "No coaching listed"}
                </span>
                {isPremium ? (
                  <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-900">
                    Premium training
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Trophy className="h-3.5 w-3.5" />
              Courts
            </p>
            <p className="mt-1 text-xl font-semibold">{courtsDisplay ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Type
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{surfaceLabel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Dumbbell className="h-3.5 w-3.5" />
              Coaching
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{coachingYes ? "Yes" : "No"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Star className="h-3.5 w-3.5" />
              Rating
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{ratingStr ?? "—"}</p>
          </div>
        </section>

        {description ? (
          <section className="mb-10">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">About training here</h2>
            <p className="text-base leading-relaxed text-slate-600">{description}</p>
          </section>
        ) : null}

        {experienceLabel ? (
          <section className="mb-10">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Experience</h2>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-800">
              {experienceLabel}
            </span>
          </section>
        ) : null}

        {hasContactBlock ? (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Contact & details</h2>
            <ul className="space-y-4 text-slate-700">
              {websiteUrl ? (
                <li className="flex gap-3">
                  <Globe className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Website</p>
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
                    >
                      {venue.website?.replace(/^https?:\/\//, "") ?? "Visit site"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </li>
              ) : null}
              {phoneRaw ? (
                <li className="flex gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Phone</p>
                    <a href={`tel:${phoneRaw.replace(/\s/g, "")}`} className="font-medium text-slate-900 hover:underline">
                      {phoneRaw}
                    </a>
                  </div>
                </li>
              ) : null}
              {hoursLines?.length ? (
                <li className="flex gap-3">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hours</p>
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {hoursLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </li>
              ) : null}
              {addressRaw ? (
                <li className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Address</p>
                    <p className="text-sm leading-relaxed">{addressRaw}</p>
                  </div>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {mapEmbedUrl ? (
          <section className="mb-10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Location</h2>
              {mapsLink ? (
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
                >
                  Open in Google Maps
                </a>
              ) : null}
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
              <iframe
                title={`Map — ${venue.name ?? "venue"}`}
                src={mapEmbedUrl}
                className="aspect-[16/10] h-auto min-h-[220px] w-full"
                loading="lazy"
              />
            </div>
          </section>
        ) : null}

        {similarVenues.length > 0 ? (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Similar venues</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {similarVenues.map((v) => (
                <VenueCard key={v.id} venue={v} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
