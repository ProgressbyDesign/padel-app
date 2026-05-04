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
    <section className="space-y-3 border-t border-primary/10 pt-8">
      <h2 className="text-lg font-semibold text-primary">Court details</h2>
      <dl className="grid gap-3 sm:grid-cols-3">
        {rows.map(({ label, value }) => (
          <div key={label} className="rounded-lg px-1 py-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-primary/60">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
