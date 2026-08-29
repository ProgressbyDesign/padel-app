import { Clock, MapPin } from "lucide-react";
import type { Venue } from "../../lib/venueFilters";
import { getVenueOpeningHoursUi } from "../../lib/venueDetailHelpers";
import {
  getStructuredOpeningHours,
  structuredOpeningHoursDisplayRows,
} from "../../lib/openingHours";

type VenueInfoSectionProps = {
  venue: Pick<
    Venue,
    "address" | "opening_hours" | "opening_hours_structured"
  >;
};

export default function VenueInfoSection({ venue }: VenueInfoSectionProps) {
  const address = venue.address?.trim();
  const structuredHours = getStructuredOpeningHours(
    venue.opening_hours_structured
  );
  const structuredRows = structuredHours
    ? structuredOpeningHoursDisplayRows(structuredHours)
    : null;
  const hoursUi = structuredRows
    ? null
    : getVenueOpeningHoursUi(venue.opening_hours);

  const hasHours = structuredRows !== null || hoursUi !== null;

  if (!address && !hasHours) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-primary">Venue info</h2>
        <p className="text-sm text-primary/60">No address or opening hours on file.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-primary">Venue info</h2>

      {address ? (
        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary/60">Address</p>
              <p className="mt-0.5 leading-relaxed text-primary">{address}</p>
            </div>
          </li>
        </ul>
      ) : null}

      {hasHours ? (
        <div className={address ? "border-t border-primary/10 pt-4" : ""}>
          <div className="flex gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-primary/60">Opening hours</p>
              {structuredRows ? (
                <ul className="mt-2 list-none space-y-1.5 text-sm text-primary/80">
                  {structuredRows.map((row) => (
                    <li key={`${row.label}-${row.hours}`}>
                      <strong className="font-semibold text-primary">
                        {row.label}:
                      </strong>{" "}
                      {row.hours}
                    </li>
                  ))}
                </ul>
              ) : hoursUi?.kind === "grouped" ? (
                <ul className="mt-2 list-none space-y-1.5 text-sm text-primary/80">
                  {hoursUi.rows.map((row) => (
                    <li key={`${row.label}-${row.hours}`}>
                      <strong className="font-semibold text-primary">{row.label}:</strong>{" "}
                      {row.hours}
                    </li>
                  ))}
                </ul>
              ) : hoursUi?.kind === "fallback" ? (
                <p className="mt-2 text-sm leading-relaxed text-primary/80">{hoursUi.text}</p>
              ) : (
                <p className="mt-2 text-sm text-primary/60">Opening hours unavailable</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
