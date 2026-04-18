import type { Coach } from "../lib/coaches";
import type { Venue } from "../lib/venueFilters";
import { getVenueDescriptionForPdp } from "../lib/venueDetailHelpers";
import VenueCardsWithDistance from "./VenueCardsWithDistance";
import BookingCard from "./venue-detail/BookingCard";
import CoachesSection from "./venue-detail/CoachesSection";
import CourtDetailsSection from "./venue-detail/CourtDetailsSection";
import ExpandableDescription from "./venue-detail/ExpandableDescription";
import FacilitiesGrid from "./venue-detail/FacilitiesGrid";
import QuickFacts from "./venue-detail/QuickFacts";
import ReviewsSection from "./venue-detail/ReviewsSection";
import VenueGallery from "./venue-detail/VenueGallery";
import VenueHeader from "./venue-detail/VenueHeader";
import VenueMapSection from "./venue-detail/VenueMapSection";

type VenueDetailPageProps = {
  venue: Venue;
  similarVenues: Venue[];
  coaches?: Coach[];
};

export default function VenueDetailPage({ venue, similarVenues, coaches = [] }: VenueDetailPageProps) {
  const description = getVenueDescriptionForPdp(venue);

  return (
    <div className="min-h-full bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mx-auto space-y-8 pb-8">

                      <VenueHeader venue={venue} />
            <VenueGallery venue={venue} />
        </div>
        <div className="lg:grid lg:grid-cols-[2fr_1fr] lg:items-start lg:gap-10">
          <div className="min-w-0 space-y-8">
            <QuickFacts venue={venue} />

            {description ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold text-slate-900">About this venue</h2>
                <ExpandableDescription text={description} />
              </section>
            ) : null}

            <CoachesSection coaches={coaches} />
            <CourtDetailsSection venue={venue} />
            <FacilitiesGrid venue={venue} />
            <ReviewsSection venue={venue} />
            <VenueMapSection venue={venue} />
          </div>

          <aside className="mt-10 lg:mt-0 sticky top-24">
              <BookingCard venueName={venue.name} />
          </aside>
        </div>

        {similarVenues.length > 0 ? (
          <section className="mt-14 border-t border-slate-100 pt-12">
            <h2 className="mb-6 text-xl font-semibold text-slate-900">Similar venues</h2>
            <VenueCardsWithDistance
              venues={similarVenues}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
