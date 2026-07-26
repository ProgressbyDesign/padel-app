import type {
  ApprovedMembershipRole,
  VenueApplicationCountry,
  VenueApplicationMode,
  VenueApplicationStatus,
  VenueRelationshipValue,
} from "./constants";

export type VenueProfileApplicationRow = {
  id: string;
  user_id: string;
  status: VenueApplicationStatus;
  current_step: number;
  application_mode: VenueApplicationMode | null;
  relationship_to_venue: VenueRelationshipValue | null;
  target_venue_id: string | null;
  applicant_email: string | null;
  proposed_venue_name: string | null;
  proposed_country: VenueApplicationCountry | null;
  proposed_city: string | null;
  proposed_address: string | null;
  proposed_website: string | null;
  phone: string | null;
  supporting_note: string | null;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  submitted_at: string | null;
  approved_venue_id: string | null;
  approved_membership_role: ApprovedMembershipRole | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type VenueApplicationTargetVenue = {
  id: string;
  name: string | null;
  city: string | null;
  country: string | null;
  image_url: string | null;
  website: string | null;
};

export type VenueApplicationWithVenue = {
  application: VenueProfileApplicationRow;
  targetVenue: VenueApplicationTargetVenue | null;
};

export type VenueApplicationActionResult = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  applicationId?: string;
};
