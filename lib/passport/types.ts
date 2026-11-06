import type { AssessmentOutcome, DevelopmentLevel } from "@/lib/development/types";

export type OrderState = "awaiting_payment" | "awaiting_submission" | "processing" | "ready_for_review" | "in_review" | "replacement_requested" | "completed" | "cancelled";
export type PaymentState = "pending" | "paid" | "refunded";
export type RefundState = "none" | "requested" | "completed";
export type AssessorStatus = "pending" | "approved" | "suspended" | "revoked";
export type ReplacementClock = "reset" | "resume_remaining";
export type ReviewDecision = AssessmentOutcome | "replacement_requested";

export type AssessorGrant = {
  id: string;
  coach_id: string;
  assessor_user_id: string;
  pathway_id: DevelopmentLevel | null;
  skill_id: string | null;
  status: AssessorStatus;
  credential_reference: string;
  credentials_verified_at: string | null;
  credentials_verified_by: string | null;
  created_at: string;
};
export type AssessmentOffer = { id: string; grant_id: string; standard_id: string; price_minor: number; currency: string; active: boolean };

export type CriteriaVersion = {
  id: string;
  skill_id: string;
  version: number;
  status: "draft" | "published" | "retired";
  criteria: readonly { id: string; expectation: string }[];
  evidence_requirements: { camera: string; repetitions: string; max_seconds: number };
};
export type PurchaseTerms = {
  terms: string;
  policy_version: number;
  standard_version: number;
  review_target_hours: number;
  replacement_clock: ReplacementClock;
  max_video_seconds: number;
  criteria: CriteriaVersion["criteria"];
  evidence_requirements: CriteriaVersion["evidence_requirements"];
};
export type AssessmentOrder = {
  id: string;
  player_id: string;
  offer_id: string;
  skill_id: string;
  standard_id: string;
  policy_id: string;
  purchased_coach_id: string;
  assessor_user_id: string;
  grant_id: string;
  parent_order_id: string | null;
  active_attempt_id: string | null;
  price_minor: number;
  currency: string;
  commission_bps: number;
  /** Immutable purchase quotes. Use pp_delivered_earnings for recognised amounts;
   * pending/unfulfilled orders never represent coach earnings or payable funds. */
  commission_minor: number;
  coach_earnings_minor: number;
  terms_snapshot: PurchaseTerms;
  state: OrderState;
  payment_state: PaymentState;
  payment_reference: string | null;
  refund_state: RefundState;
  created_at: string;
  paid_at: string | null;
  clock_started_at: string | null;
  review_due_at: string | null;
  remaining_review_seconds: number | null;
  completed_at: string | null;
  cancelled_at: string | null;
};
export type VideoSubmissionAttempt = {
  id: string;
  order_id: string;
  attempt_number: number;
  provider: "mock" | "cloudflare_stream" | null;
  provider_reference: string | null;
  upload_state: "awaiting_upload" | "uploaded" | "processing" | "ready" | "failed";
  validation_state: "pending" | "valid" | "unusable";
  duration_seconds: number | null;
  bytes: number | null;
  mime_type: string | null;
  failure_reason: string | null;
  recording_guidance: string | null;
  created_at: string;
  upload_completed_at: string | null;
  processing_completed_at: string | null;
  available_at: string | null;
  submitted_at: string | null;
  review_started_at: string | null;
};
export type CoachReview = {
  id: string;
  sequence: number;
  order_id: string;
  attempt_id: string;
  assessor_user_id: string;
  outcome: ReviewDecision;
  observations: string;
  positive_feedback: string;
  areas_for_improvement: string;
  practice_tasks: readonly string[];
  next_step: string;
  criteria_results: Record<string, boolean>;
  replacement_reason: string | null;
  recording_guidance: string | null;
  response_video_reference: string | null;
  reviewed_at: string;
};
export type PassportVerification = {
  id: string;
  player_id: string;
  skill_id: string;
  standard_id: string;
  order_id: string;
  review_id: string;
  assessor_user_id: string;
  coach_id: string;
  verified_at: string;
  status: "valid" | "revoked";
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
};

type ReasonedOrder = { order_id: string; reason: string };
type PublishVersion = { id: string; reason: string };
type FinalReview = {
  order_id: string;
  outcome: AssessmentOutcome;
  observations: string;
  positive_feedback: string;
  areas_for_improvement: string;
  practice_tasks: string[];
  next_step: string;
  criteria_results: Record<string, boolean>;
};
type ReplacementReview = {
  order_id: string;
  outcome: "replacement_requested";
  observations: string;
  replacement_reason: string;
  recording_guidance: string;
};
type AssessorIdentity = { coach_id: string; assessor_user_id: string; credential_reference: string } &
  ({ skill_id: string; pathway_id?: never } | { pathway_id: DevelopmentLevel; skill_id?: never });
export type PassportCommands = {
  publish_standard: PublishVersion;
  publish_policy: PublishVersion;
  retire_standard: PublishVersion;
  retire_policy: PublishVersion;
  set_assessor: ({ id: string } | AssessorIdentity) & { status: AssessorStatus; credentials_verified?: boolean; reason: string };
  create_offer: { grant_id: string; standard_id: string; price_minor: number; currency: string };
  complete_lesson: { lesson_id: string };
  create_order: { offer_id: string; policy_id: string; parent_order_id?: string };
  begin_attempt: { order_id: string };
  start_review: { order_id: string };
  submit_review: FinalReview | ReplacementReview;
  cancel_order: ReasonedOrder;
  request_refund: ReasonedOrder;
  reassign: ReasonedOrder & { grant_id: string };
  escalate: ReasonedOrder;
  resolve_escalation: ReasonedOrder;
  revoke_verification: ReasonedOrder;
};
export type CommandResult = { id?: string; order_id?: string; lesson_id?: string; attempt_number?: number; outcome?: ReviewDecision; learning_only?: boolean };
