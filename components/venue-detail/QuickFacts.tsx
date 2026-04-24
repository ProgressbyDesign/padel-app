import { Building2, Dumbbell, Trophy } from "lucide-react";
import type { Venue } from "../../lib/venueFilters";
import { getSurfaceLabel } from "../../lib/venueDetailHelpers";

type QuickFactsProps = {
  venue: Venue;
};

export default function QuickFacts({ venue }: QuickFactsProps) {
  const surfaceLabel = getSurfaceLabel(venue.court_type);
  const courtsDisplay = typeof venue.courts === "number" ? String(venue.courts) : null;
  const env = surfaceLabel === "Not specified" ? "—" : surfaceLabel;
  const coaching = Boolean(venue.coaching_available);

  return (
    <section aria-label="Quick facts" className="border-b border-slate-100 pb-6">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="text-slate-500">Courts</span>
          <span className="font-medium text-slate-900">{courtsDisplay ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="text-slate-500">Environment</span>
          <span className="font-medium text-slate-900">{env}</span>
        </div>
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="text-slate-500">Coaching</span>
          <span className="font-medium text-slate-900">{coaching ? "Yes" : "No"}</span>
        </div>
      </div>
    </section>
  );
}
