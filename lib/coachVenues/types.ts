import type {
  CoachVenueInitiator,
  CoachVenueStatus,
} from "@/lib/coachVenues/constants";

export type CoachVenueVenueSummary = {
  id: string;
  name: string | null;
  city: string | null;
  country: string | null;
  image_url: string | null;
  website: string | null;
};

export type CoachVenueCoachSummary = {
  id: string;
  name: string | null;
  role: string | null;
  image_url: string | null;
};

export type CoachVenueRelationship = {
  id: string;
  coach_id: string;
  venue_id: string;
  is_primary: boolean;
  status: CoachVenueStatus;
  initiated_by: CoachVenueInitiator;
  requested_by_user_id: string | null;
  responded_by_user_id: string | null;
  requested_at: string | null;
  responded_at: string | null;
  ended_at: string | null;
  venue: CoachVenueVenueSummary | null;
  coach: CoachVenueCoachSummary | null;
};

export type CoachVenueBoard = {
  current: CoachVenueRelationship[];
  incoming: CoachVenueRelationship[];
  outgoing: CoachVenueRelationship[];
  past: CoachVenueRelationship[];
};

export type CoachVenueSearchVenue = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  image_url: string | null;
  existingStatus: CoachVenueStatus | null;
  managedByCurrentUser: boolean;
};

export type CoachVenueSearchCoach = {
  id: string;
  name: string;
  role: string | null;
  image_url: string | null;
  location: string | null;
  existingStatus: CoachVenueStatus | null;
  managedByCurrentUser: boolean;
};

export type RelationshipActionResult = {
  ok: boolean;
  message: string;
  status?: CoachVenueStatus;
  relationshipId?: string;
  alreadyConnected?: boolean;
  activatedImmediately?: boolean;
};
