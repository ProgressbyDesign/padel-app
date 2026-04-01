import { Award, Dumbbell, MapPin, ShieldCheck, Star, Trophy } from "lucide-react";
import Image from "next/image";
import { isPremiumTrainingVenue, type Venue } from "../lib/venueFilters";

type VenueCardProps = {
  venue: Venue;
};

function formatRating(raw: VenueCardProps["venue"]["rating"]) {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return n.toFixed(1);
}

function getSurfaceType(raw?: string | null) {
  if (!raw) return "Unknown";
  const value = raw.toLowerCase();
  if (value.includes("indoor")) return "Indoor";
  if (value.includes("outdoor")) return "Outdoor";
  return raw;
}

export default function VenueCard({ venue }: VenueCardProps) {
  const imageSrc = venue.image_url || "/assets/court-placeholder.jpg";
  const location = [venue.city, venue.country].filter(Boolean).join(", ");
  const rating = formatRating(venue.rating);
  const surfaceType = getSurfaceType(venue.court_type);
  const courtsCount = typeof venue.courts === "number" ? venue.courts : null;
  const hasCoaching = Boolean(venue.coaching_available);

  const isPremium = isPremiumTrainingVenue(venue);

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/10">
      <div className="relative">
        <div className="relative aspect-[3/2] w-full overflow-hidden">
          <Image
            src={imageSrc}
            alt={venue.name ? `${venue.name} venue` : "Padel venue"}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-110"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-black/20 opacity-80" />

          <div className="absolute left-3 top-3 right-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {isPremium ? (
                <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-white/60 backdrop-blur-sm">
                  <Award className="mr-1 h-3.5 w-3.5 text-indigo-600" />
                  Premium
                </span>
              ) : null}
            </div>

            {rating ? (
              <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-white/60 backdrop-blur-sm">
                <Star className="mr-1 h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                {rating}
              </span>
            ) : null}
          </div>

          <div className="absolute bottom-3 left-3 right-3">
            <h2 className="line-clamp-2 text-lg font-semibold tracking-tight text-white drop-shadow-sm">
              {venue.name || "Venue"}
            </h2>
            {location ? (
              <p className="mt-1 inline-flex items-center gap-1 line-clamp-1 text-sm font-medium text-white/90">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {location}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-slate-900 px-3 py-2.5 ring-1 ring-slate-900">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              <Trophy className="h-3.5 w-3.5 text-slate-200" />
              Courts
            </p>
            <p className="mt-1 text-xl font-semibold leading-none text-white">{courtsCount ?? "?"}</p>
          </div>

          <div className="rounded-2xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
              Type
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{surfaceType}</p>
          </div>

          <div className="rounded-2xl bg-slate-100 px-3 py-2.5 ring-1 ring-slate-200">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <Dumbbell className="h-3.5 w-3.5 text-slate-600" />
              Coaching
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {hasCoaching ? "Available" : "No"}
            </p>
          </div>
        </div>

        {venue.coaching_description ? (
          <p className="line-clamp-1 text-sm text-slate-600">{venue.coaching_description}</p>
        ) : null}
      </div>
    </article>
  );
}