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
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Reviews</h2>

      {ratingStr ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <span className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Star className="h-7 w-7 fill-neutral-900 text-neutral-900" aria-hidden />
            {ratingStr}
          </span>
          {count != null ? (
            <span className="text-sm text-slate-600">
              Based on <span className="font-medium text-slate-900">{count.toLocaleString()}</span> reviews
            </span>
          ) : (
            <span className="text-sm text-slate-600">Aggregate rating</span>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          No reviews or ratings are available for this venue yet.
        </p>
      )}
    </section>
  );
}
