import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VenueBasicInformationForm from "@/components/account/VenueBasicInformationForm";
import {
  loadManagedVenueDetails,
  type ManagedVenueDetail,
} from "@/lib/queries/managedVenue";
import {
  getStructuredOpeningHours,
  parseLegacyOpeningHours,
  type StructuredOpeningHours,
} from "@/lib/openingHours";
import type { VenueUpdateState } from "@/lib/venueManagement";

export const metadata: Metadata = {
  title: "Venue details",
  description: "Edit venue basic information and opening hours.",
};

type PageProps = {
  params: Promise<{ venueId: string }>;
};

function formState(
  venue: ManagedVenueDetail,
  openingHours: StructuredOpeningHours | null
): VenueUpdateState {
  return {
    status: "idle",
    message: null,
    fieldErrors: {},
    revision: 0,
    values: {
      name: venue.name ?? "",
      address: venue.address ?? "",
      city: venue.city ?? "",
      country: venue.country ?? "",
      phone: venue.phone ?? "",
      website: venue.website ?? "",
      venue_type: venue.venue_type ?? "",
      courts: venue.courts === null ? "" : String(venue.courts),
      court_type: venue.court_type ?? "",
      coaching_available: Boolean(venue.coaching_available),
      coaching_description: venue.coaching_description ?? "",
      price: venue.price ?? "",
      opening_hours_structured: openingHours
        ? JSON.stringify(openingHours)
        : "",
    },
  };
}

export default async function ManagedVenueDetailsPage({ params }: PageProps) {
  const { venueId } = await params;
  const result = await loadManagedVenueDetails(venueId);
  if (!result) notFound();

  const { venue } = result;
  const savedOpeningHours = getStructuredOpeningHours(
    venue.opening_hours_structured
  );
  const parsedLegacyOpeningHours = savedOpeningHours
    ? null
    : parseLegacyOpeningHours(venue.opening_hours);
  const initialOpeningHours = savedOpeningHours ?? parsedLegacyOpeningHours;
  const unparsedLegacyHours =
    !initialOpeningHours && venue.opening_hours?.trim()
      ? venue.opening_hours.trim()
      : null;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <VenueBasicInformationForm
          venueId={venue.id}
          initialState={formState(venue, initialOpeningHours)}
          legacyOpeningHours={unparsedLegacyHours}
          legacyImageUrl={venue.image_url}
        />
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
          <h2 className="text-xl font-bold text-primary">Location</h2>
          <p className="mt-2 text-sm leading-6 text-primary/60">
            Precise map coordinates are managed separately and cannot be edited
            from this form.
          </p>

          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                Latitude
              </dt>
              <dd className="mt-1 font-mono text-sm text-primary">
                {venue.lat ?? "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                Longitude
              </dt>
              <dd className="mt-1 font-mono text-sm text-primary">
                {venue.lng ?? "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                Google Place
              </dt>
              <dd className="mt-1 text-sm font-medium text-primary">
                {venue.google_place_id ? "Connected" : "Not connected"}
              </dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}
