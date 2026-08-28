import type { PublicCoachCard } from "../lib/coaches";
import type { PublicVenue } from "../lib/venueFilters";
import type { PublicCoachAvailabilityCard } from "../lib/coachAvailability/types";
import EnquiryButton from "./enquiry/EnquiryButton";
import { getVenueDescriptionForPdp } from "../lib/venueDetailHelpers";
import VenueCardsWithDistance from "./VenueCardsWithDistance";
import BookingCard from "./venue-detail/BookingCard";
import CoachesSection from "./venue-detail/CoachesSection";
import CourtDetailsSection from "./venue-detail/CourtDetailsSection";
import ExpandableDescription from "./venue-detail/ExpandableDescription";
import FacilitiesGrid from "./venue-detail/FacilitiesGrid";
import QuickFacts from "./venue-detail/QuickFacts";
import VenueInfoSection from "./venue-detail/VenueInfoSection";
import ReviewsSection from "./venue-detail/ReviewsSection";
import VenueGallery from "./venue-detail/VenueGallery";
import VenueHeader from "./venue-detail/VenueHeader";
import VenueMapSection from "./venue-detail/VenueMapSection";
import VenuePublicCoachAvailabilitySection from "./VenuePublicCoachAvailabilitySection";

type VenueDetailPageProps = {
  venue: PublicVenue;
  similarVenues: PublicVenue[];
  coaches?: PublicCoachCard[];
  availabilityCards?: PublicCoachAvailabilityCard[];
};

export default function VenueDetailPage({
  venue,
  similarVenues,
  coaches = [],
  availabilityCards = [],
}: VenueDetailPageProps) {
  const description = getVenueDescriptionForPdp(venue);
  const hasCoaches = coaches.length > 0;

  return (
    <div className="min-h-full bg-surface">
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
                <h2 className="text-xl font-semibold text-primary">About this venue</h2>
                <ExpandableDescription text={description} />
              </section>
            ) : null}

            <CourtDetailsSection venue={venue} />
            <FacilitiesGrid venue={venue} />
            <CoachesSection coaches={coaches} />
            <VenuePublicCoachAvailabilitySection
              cards={availabilityCards}
              hasCoaches={hasCoaches}
            />
            <VenueInfoSection venue={venue} />
            <ReviewsSection venue={venue} />
            <VenueMapSection venue={venue} />
          </div>

          <aside className="sticky top-24 mt-10 space-y-4 lg:mt-0">
            <EnquiryButton venueId={String(venue.id)} label="Send venue enquiry" />
            <BookingCard venueName={venue.name} />
          </aside>
        </div>

        {similarVenues.length > 0 ? (
          <section className="mt-14 border-t border-primary/10 pt-12">
            <h2 className="mb-6 text-xl font-semibold text-primary">Similar venues</h2>
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
