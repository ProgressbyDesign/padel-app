import type { Venue } from "../../lib/venueFilters";
import { getSurfaceLabel } from "../../lib/venueDetailHelpers";

type CourtDetailsSectionProps = {
  venue: Venue;
};

export default function CourtDetailsSection({ venue }: CourtDetailsSectionProps) {
  const surface = getSurfaceLabel(venue.court_type);
  const courts = typeof venue.courts === "number" ? venue.courts : null;
  const rawType = venue.court_type?.trim();

  const rows: { label: string; value: string }[] = [
    { label: "Courts", value: courts != null ? String(courts) : "—" },
    { label: "Surface / environment", value: surface === "Not specified" ? "—" : surface },
    { label: "Court type (recorded)", value: rawType || "—" },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Court details</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
