import type {
  AudienceValue,
  CoachApplicationStatus,
  CoachingOutcomeValue,
  CoachingRoleValue,
  PlayerLevelValue,
} from "./constants";

export type CoachApplicationLocationInput = {
  country: string;
  city: string;
  is_primary: boolean;
};

export type CoachApplicationLocationRow = {
  id: string;
  application_id: string;
  country: string;
  city: string;
  is_primary: boolean;
  created_at: string;
};

export type CoachProfileApplicationRow = {
  id: string;
  user_id: string;
  status: CoachApplicationStatus;
  current_step: number;
  full_name: string | null;
  phone: string | null;
  coaching_role: CoachingRoleValue | null;
  coaching_role_other: string | null;
  experience_years: number | null;
  description: string | null;
  player_levels: PlayerLevelValue[];
  audiences: AudienceValue[];
  outcomes: CoachingOutcomeValue[];
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  submitted_at: string | null;
  coach_id: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type CoachApplicationWithLocations = {
  application: CoachProfileApplicationRow;
  locations: CoachApplicationLocationRow[];
};

export type CoachApplicationActionStatus =
  | "idle"
  | "success"
  | "error"
  | "redirect";

export type CoachApplicationActionResult = {
  status: CoachApplicationActionStatus;
  message: string | null;
  fieldErrors: Record<string, string>;
  applicationId?: string;
  redirectTo?: string;
};
