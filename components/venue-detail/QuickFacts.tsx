import { Building2, Dumbbell, Star, Trophy } from "lucide-react";
import type { Venue } from "../../lib/venueFilters";
import { formatRatingValue, getSurfaceLabel } from "../../lib/venueDetailHelpers";

type QuickFactsProps = {
  venue: Venue;
};

export default function QuickFacts({ venue }: QuickFactsProps) {
  const ratingStr = formatRatingValue(venue.rating);
  const surfaceLabel = getSurfaceLabel(venue.court_type);
  const courtsDisplay = typeof venue.courts === "number" ? String(venue.courts) : null;
  const coachingYes = Boolean(venue.coaching_available);

  const items = [
    {
      key: "courts",
      icon: Trophy,
      label: "Courts",
      value: courtsDisplay ?? "—",
    },
    {
      key: "surface",
      icon: Building2,
      label: "Environment",
      value: surfaceLabel === "Not specified" ? "—" : surfaceLabel,
    },
    {
      key: "coaching",
      icon: Dumbbell,
      label: "Coaching",
      value: coachingYes ? "Available" : "Not listed",
    },
    {
      key: "rating",
      icon: Star,
      label: "Rating",
      value: ratingStr ?? "—",
    },
  ];

  return (
    <section aria-label="Quick facts" className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(({ key, icon: Icon, label, value }) => (
          <div key={key} className="flex gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-100">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
