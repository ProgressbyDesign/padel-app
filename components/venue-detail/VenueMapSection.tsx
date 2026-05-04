import type { Venue } from "../../lib/venueFilters";
import { getCoordinates } from "../../lib/venueDetailHelpers";

type VenueMapSectionProps = {
  venue: Venue;
};

export default function VenueMapSection({ venue }: VenueMapSectionProps) {
  const coords = getCoordinates(venue);

  const mapEmbedUrl =
    coords != null
      ? (() => {
          const { lat, lng } = coords;
          const pad = 0.02;
          return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
            `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`
          )}&layer=map&marker=${encodeURIComponent(`${lat},${lng}`)}`;
        })()
      : null;

  const mapsLink =
    coords != null ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}` : null;

  if (!mapEmbedUrl) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-primary">Where you&apos;ll play</h2>
        <div className="rounded-2xl border border-dashed border-primary/20 bg-white px-4 py-10 text-center text-sm text-primary/70">
          Map preview unavailable—this venue has no coordinates on file.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-primary">Where you&apos;ll play</h2>
        {mapsLink ? (
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary underline decoration-primary/25 underline-offset-4 hover:decoration-primary"
          >
            Open in Google Maps
          </a>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-primary/15 bg-surface shadow-sm">
        <iframe
          title={`Map — ${venue.name ?? "venue"}`}
          src={mapEmbedUrl}
          className="aspect-[16/10] h-auto min-h-[220px] w-full"
          loading="lazy"
        />
      </div>
    </section>
  );
}
