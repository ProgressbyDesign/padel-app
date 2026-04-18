import { Award, Clock, Dumbbell, Globe, MapPin, Phone, Trophy } from "lucide-react";
import type { Venue } from "../../lib/venueFilters";
import { isPremiumTrainingVenue } from "../../lib/venueFilters";
import { formatOpeningHoursLines, getSurfaceLabel, normalizeWebsiteUrl } from "../../lib/venueDetailHelpers";

type FacilitiesGridProps = {
  venue: Venue;
};

type FacilityItem = {
  id: string;
  icon: typeof Trophy;
  label: string;
  href?: string;
  external?: boolean;
};

export default function FacilitiesGrid({ venue }: FacilitiesGridProps) {
  const surface = getSurfaceLabel(venue.court_type);
  const courts = typeof venue.courts === "number" ? venue.courts : null;
  const coaching = Boolean(venue.coaching_available);
  const premium = isPremiumTrainingVenue(venue);
  const website = venue.website?.trim() ? normalizeWebsiteUrl(venue.website) : null;
  const phone = venue.phone?.trim();
  const address = venue.address?.trim();
  const hoursLines = formatOpeningHoursLines(venue.opening_hours);

  const items: FacilityItem[] = [];

  if (courts != null) {
    items.push({
      id: "courts",
      icon: Trophy,
      label: `${courts} padel court${courts === 1 ? "" : "s"}`,
    });
  }

  if (surface !== "Not specified") {
    items.push({ id: "surface", icon: MapPin, label: surface });
  }

  if (coaching) {
    items.push({ id: "coaching", icon: Dumbbell, label: "Coaching available" });
  }

  if (premium) {
    items.push({ id: "premium", icon: Award, label: "Premium training venue" });
  }

  if (website) {
    items.push({ id: "web", icon: Globe, label: "Website", href: website, external: true });
  }

  if (phone) {
    items.push({ id: "phone", icon: Phone, label: phone, href: `tel:${phone.replace(/\s/g, "")}` });
  }

  if (address) {
    items.push({ id: "address", icon: MapPin, label: address });
  }

  if (hoursLines?.length) {
    items.push({ id: "hours", icon: Clock, label: hoursLines.join(" · ") });
  }

  if (items.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Facilities & info</h2>
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          No facility details are listed for this venue yet.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Facilities & info</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map(({ id, icon: Icon, label, href, external }) => (
          <li key={id}>
            {href ? (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50/80"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 break-words text-sm font-medium text-slate-900">{label}</span>
              </a>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 break-words text-sm font-medium text-slate-900">{label}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
