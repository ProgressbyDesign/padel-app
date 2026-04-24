import { Star } from "lucide-react";
import type { Venue } from "../../lib/venueFilters";
import { formatRatingValue } from "../../lib/venueDetailHelpers";

type ReviewsSectionProps = {
  venue: Venue;
};

export default function ReviewsSection({ venue }: ReviewsSectionProps) {
  const ratingStr = formatRatingValue(venue.rating);
  const count =
    typeof venue.review_count === "number" && venue.review_count > 0 ? venue.review_count : null;

  return (
    <section className="space-y-3 border-t border-slate-100 pt-8">
      <h2 className="text-lg font-semibold text-slate-900">Reviews</h2>

      {ratingStr ? (
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Star className="h-7 w-7 fill-neutral-900 text-neutral-900" aria-hidden />
            {ratingStr}
          </span>
          {count != null ? (
            <span className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{count.toLocaleString()}</span> reviews
            </span>
          ) : (
            <span className="text-sm text-slate-600">Guest rating</span>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No reviews or ratings are available for this venue yet.</p>
      )}
    </section>
  );
}
