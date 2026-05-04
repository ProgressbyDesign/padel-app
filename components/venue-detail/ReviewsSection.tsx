import { Star } from "lucide-react";
import type { Venue } from "../../lib/venueFilters";

type ReviewsSectionProps = {
  venue: Venue;
};

function parseRating(raw: Venue["rating"]): number | null {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return n;
}

export default function ReviewsSection({ venue }: ReviewsSectionProps) {
  const rating = parseRating(venue.rating);
  const count = typeof venue.review_count === "number" ? venue.review_count : 0;
  const hasRating = rating != null;

  return (
    <section className="space-y-3 border-t border-primary/10 pt-8">
      <h2 className="text-lg font-semibold text-primary">Reviews</h2>
      {hasRating ? (
        <div className="flex flex-wrap items-end gap-4">
          <span className="flex items-center gap-2 text-2xl font-semibold text-primary">
            <Star className="h-7 w-7 fill-secondary text-secondary" aria-hidden />
            {rating.toFixed(1)}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-primary/70">
              <span className="font-medium text-primary">{count.toLocaleString()}</span> reviews
            </span>
            <span className="text-sm text-primary/70">Guest rating</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-primary/60">No reviews or ratings are available for this venue yet.</p>
      )}
    </section>
  );
}
