import Image from "next/image";
import type { Venue } from "../../lib/venueFilters";
import { getVenueMainImageUrl, normalizeGalleryImages } from "../../lib/venueDetailHelpers";

const PLACEHOLDER = "/assets/court-placeholder.jpg";

type VenueGalleryProps = {
  venue: Venue;
};

function GalleryImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img src={src} alt={alt} className={className ?? "h-full w-full object-cover"} loading="lazy" />
  );
}

export default function VenueGallery({ venue }: VenueGalleryProps) {
  const gallery = normalizeGalleryImages(venue);
  const mainResolved = getVenueMainImageUrl(venue);
  const fallbackAlt = venue.name ? `${venue.name} — venue` : "Venue";

  if (gallery.length === 0) {
    const src = mainResolved || PLACEHOLDER;
    return (
      <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl bg-slate-100 sm:aspect-[21/9]">
        <Image
          src={src}
          alt={fallbackAlt}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 1280px) 100vw, 1280px"
        />
      </div>
    );
  }

  if (gallery.length === 1) {
    return (
      <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl bg-slate-100 sm:aspect-[21/9]">
        <GalleryImg src={gallery[0]} alt={fallbackAlt} className="h-full w-full object-cover" />
      </div>
    );
  }

  const [primary, ...rest] = gallery;
  const thumbs = rest.slice(0, 4);

  return (
    <div className="flex flex-col gap-2 lg:h-[min(28rem,52vh)] lg:flex-row lg:gap-2">
      <div className="relative min-h-[14rem] flex-[1.12] overflow-hidden rounded-2xl bg-slate-100 lg:min-h-0">
        <GalleryImg src={primary} alt={fallbackAlt} />
      </div>
      <div className="grid min-h-[10rem] flex-1 grid-cols-2 grid-rows-2 gap-2 lg:min-h-0">
        {thumbs.map((url, i) => (
          <div key={`${url}-${i}`} className="relative min-h-[6rem] overflow-hidden rounded-xl bg-slate-100 lg:min-h-0">
            <GalleryImg src={url} alt="" className="absolute inset-0 size-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
