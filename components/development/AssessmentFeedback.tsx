import Link from "next/link";
import type { CoachReview } from "@/lib/passport/types";
import type { ReviewDetail } from "@/lib/passport/review/model";
import { outcomeLabels } from "@/lib/passport/review/model";
import { panel, secondaryAction } from "./DevelopmentUi";

export function FeedbackContent({ review, criteria }: { review: CoachReview; criteria: ReviewDetail["order"]["terms_snapshot"]["criteria"] }) {
  return <div className="mt-4 space-y-5 text-sm leading-6">
    <p className="whitespace-pre-line break-words">{review.observations}</p>
    {review.outcome === "replacement_requested" ? <><div><h3 className="font-semibold">Recording issue</h3><p>{review.replacement_reason}</p></div><div className="rounded-xl bg-amber-50 p-4 text-amber-950"><h3 className="font-semibold">What to record differently</h3><p className="mt-2 whitespace-pre-line">{review.recording_guidance}</p><p className="mt-3 font-semibold">Replacement is free under the same order. This is not a completed assessment.</p></div></> : <>
      <div className="grid gap-5 sm:grid-cols-2"><div><h3 className="font-semibold">What is working</h3><p className="mt-1 whitespace-pre-line">{review.positive_feedback}</p></div><div><h3 className="font-semibold">Improvements & technical recommendations</h3><p className="mt-1 whitespace-pre-line">{review.areas_for_improvement || "Keep building on the strengths above."}</p></div></div>
      <div><h3 className="font-semibold">Your practice exercises</h3><ul className="mt-2 list-disc space-y-2 pl-5">{review.practice_tasks.map((task, index) => <li key={index}>{task}</li>)}</ul></div>
      <div className="rounded-xl bg-secondary/25 p-4"><h3 className="font-semibold">Recommended next step</h3><p className="mt-1 whitespace-pre-line">{review.next_step}</p></div>
      <dl className="divide-y divide-primary/10">{criteria.map(criterion => <div key={criterion.id} className="flex flex-wrap justify-between gap-2 py-3"><dt className="max-w-lg">{criterion.expectation}</dt><dd className="font-semibold">{review.criteria_results[criterion.id] ? "Met" : "Developing"}</dd></div>)}</dl>
      <p className="text-primary/70">The professional assessment has been delivered. A later reassessment is a new paid service; the outcome is never guaranteed.</p>
    </>}
    <div className="border-t border-primary/10 pt-4 text-xs text-primary/65">Optional private coach video feedback is not enabled in this phase. Written feedback above is the assessment record.</div>
  </div>;
}
export default function AssessmentFeedback({ record }: { record: ReviewDetail }) {
  if (!record.reviews.length) return null;
  return <section className={`${panel} mt-6`} aria-label="Assessment feedback"><h2 className="text-2xl">Your coach&apos;s feedback</h2><p className="mt-2 text-sm text-primary/70">{record.context.assessor_name} · {record.context.coach_name} · {record.context.skill_title}</p>
    {record.reviews.map((review, index) => <article key={review.id} className="mt-5 rounded-2xl border border-primary/10 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg">{outcomeLabels[review.outcome]}{index > 0 ? " · earlier decision" : ""}</h3><time className="text-xs text-primary/65" dateTime={review.reviewed_at}>{new Date(review.reviewed_at).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</time></div><p className="mt-2 text-sm text-primary/70">Assessed by {record.context.review_assessors[review.assessor_user_id] ?? "Named assessor"}</p><FeedbackContent review={review} criteria={record.order.terms_snapshot.criteria} /><p className="mt-4 break-all text-xs text-primary/60">Rubric v{record.order.terms_snapshot.standard_version} · evidence attempt {record.attempts.find(a => a.id === review.attempt_id)?.attempt_number ?? "historical"} · review {review.id}</p></article>)}
    {record.verifications.map(verification => <p key={verification.id} className="mt-4 rounded-xl bg-surface p-4 text-sm"><strong>{verification.status === "valid" ? "Verified milestone recorded" : "Verification revoked"}</strong><span className="mt-1 block break-words">{verification.status === "revoked" ? verification.revocation_reason : "Linked to this assessment, evidence, named assessor and rubric version. This is a skill milestone, not an external qualification."}</span></p>)}
    <div className="mt-5 flex flex-wrap gap-3"><Link href="/account/development/passport" className={secondaryAction}>My Passport</Link><Link href="/account/development/next-step" className={secondaryAction}>My Next Step</Link></div>
  </section>;
}
