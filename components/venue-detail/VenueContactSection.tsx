import { Clock, ExternalLink, Globe, MapPin, Phone } from "lucide-react";
import SocialPlatformIcon from "@/components/social/SocialPlatformIcon";
import type { Venue } from "../../lib/venueFilters";
import { getVenueOpeningHoursUi, normalizeWebsiteUrl } from "../../lib/venueDetailHelpers";
import {
  getStructuredOpeningHours,
  structuredOpeningHoursDisplayRows,
} from "../../lib/openingHours";
import {
  validPublicVenueSocials,
  venueSocialPlatformLabel,
} from "../../lib/venueSocials";

type VenueContactSectionProps = {
  venue: Venue;
};

export default function VenueContactSection({ venue }: VenueContactSectionProps) {
  const website = venue.website?.trim() ? normalizeWebsiteUrl(venue.website) : null;
  const phone = venue.phone?.trim();
  const address = venue.address?.trim();
  const socials = validPublicVenueSocials(venue.venue_socials);
  const structuredHours = getStructuredOpeningHours(
    venue.opening_hours_structured
  );
  const structuredRows = structuredHours
    ? structuredOpeningHoursDisplayRows(structuredHours)
    : null;
  const hoursUi = structuredRows
    ? null
    : getVenueOpeningHoursUi(venue.opening_hours);

  const hasContact = Boolean(website || phone || address);
  const hasHours = structuredRows !== null || hoursUi !== null;

  if (!hasContact && socials.length === 0 && !hasHours) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-primary">Contact &amp; info</h2>
        <p className="text-sm text-primary/60">No contact details on file.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-primary">Contact &amp; info</h2>

      {hasContact ? (
        <ul className="space-y-3 text-sm">
          {website ? (
            <li className="flex gap-3">
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary/60">Website</p>
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-block font-medium text-primary underline decoration-primary/25 underline-offset-2 hover:decoration-primary"
                >
                  {venue.website?.replace(/^https?:\/\//, "") ?? "Visit site"}
                </a>
              </div>
            </li>
          ) : null}
          {phone ? (
            <li className="flex gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary/60">Phone</p>
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="mt-0.5 font-medium text-primary hover:underline">
                  {phone}
                </a>
              </div>
            </li>
          ) : null}
          {address ? (
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary/60">Address</p>
                <p className="mt-0.5 leading-relaxed text-primary">{address}</p>
              </div>
            </li>
          ) : null}
        </ul>
      ) : null}

      {socials.length > 0 ? (
        <div className={hasContact ? "border-t border-primary/10 pt-4" : ""}>
          <p className="text-xs font-medium uppercase tracking-wide text-primary/60">
            Social links
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {socials.map((social) => {
              const label = venueSocialPlatformLabel(social.platform);
              const venueName = venue.name?.trim() || "this venue";
              return (
                <li key={social.id}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${venueName} on ${label}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/10 bg-surface px-2.5 py-1.5 text-sm font-semibold text-primary transition hover:border-primary/20 hover:bg-white"
                  >
                    <SocialPlatformIcon
                      platform={social.platform}
                      className="h-7 w-7 text-[10px]"
                    />
                    {label}
                    <ExternalLink
                      className="h-3.5 w-3.5 text-primary/45"
                      aria-hidden
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {hasHours ? (
        <div
          className={
            hasContact || socials.length > 0
              ? "border-t border-primary/10 pt-4"
              : ""
          }
        >
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
