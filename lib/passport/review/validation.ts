import type { PassportCommands } from "../types";
import type { ReviewOrder } from "./model";
import { replacementReasons } from "./model";

export type ReviewInput = { requestId: string; outcome: string; observations: string; positive_feedback: string; areas_for_improvement: string; recommendations: string; practice_tasks: string; next_step: string; replacement_reason: string; recording_guidance: string; criteria_results: Record<string, boolean> };
export function validateReview(input: ReviewInput, order: ReviewOrder): PassportCommands["submit_review"] {
  const text = (value: unknown, label: string, required = true) => {
    if (typeof value !== "string" || value.length > 2000 || (required && value.trim().length < 10)) throw new Error(`${label} needs 10–2000 characters.`);
    return value.trim();
  };
  const observations = text(input.observations, "Assessment summary");
  if (input.outcome === "replacement_requested") {
    if (!replacementReasons.includes(input.replacement_reason as typeof replacementReasons[number])) throw new Error("Choose a recording issue.");
    return { order_id: order.id, outcome: "replacement_requested", observations, replacement_reason: input.replacement_reason, recording_guidance: text(input.recording_guidance, "Recording guidance") };
  }
  if (input.outcome !== "developing" && input.outcome !== "verified") throw new Error("Choose a review outcome.");
  const criteria = order.terms_snapshot.criteria;
  if (!input.criteria_results || Object.keys(input.criteria_results).length !== criteria.length || criteria.some(c => typeof input.criteria_results[c.id] !== "boolean")) throw new Error("Evaluate every criterion.");
  const verdicts = Object.fromEntries(criteria.map(c => [c.id, input.criteria_results[c.id]]));
  if (input.outcome === "verified" && Object.values(verdicts).some(value => !value)) throw new Error("Verified requires all criteria to be met.");
  if (input.outcome === "developing" && Object.values(verdicts).every(Boolean)) throw new Error("Developing must identify an unmet criterion.");
  const tasks = text(input.practice_tasks, "Practice exercises").split("\n").map(item => item.trim()).filter(Boolean);
  if (tasks.length > 8 || tasks.some(item => item.length < 10)) throw new Error("Add 1–8 practice exercises, each at least 10 characters.");
  const recommendations = text(input.recommendations, "Technical recommendations");
  const areas = text(input.areas_for_improvement, "Areas to improve", input.outcome === "developing");
  return { order_id: order.id, outcome: input.outcome, observations, positive_feedback: text(input.positive_feedback, "What is working"), areas_for_improvement: [areas, `Technical recommendations: ${recommendations}`].filter(Boolean).join("\n\n"), practice_tasks: tasks, next_step: text(input.next_step, "Next step"), criteria_results: verdicts };
}
