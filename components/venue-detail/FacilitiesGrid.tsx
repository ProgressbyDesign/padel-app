import { Award } from "lucide-react";
import type { Venue } from "../../lib/venueFilters";
import { isPremiumTrainingVenue } from "../../lib/venueFilters";

type FacilitiesGridProps = {
  venue: Venue;
};

export default function FacilitiesGrid({ venue }: FacilitiesGridProps) {
  const premium = isPremiumTrainingVenue(venue);
  const amenities: { id: string; icon: typeof Award; label: string }[] = [];

  if (premium) {
    amenities.push({ id: "premium", icon: Award, label: "Premium training venue" });
  }

  if (amenities.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-primary">Facilities</h2>
        <p className="text-sm text-primary/60">No extra amenities are listed for this venue.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-primary">Facilities</h2>
      <ul className="space-y-2">
        {amenities.map(({ id, icon: Icon, label }) => (
          <li key={id} className="flex items-center gap-2.5 text-sm text-primary">
            <Icon className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
