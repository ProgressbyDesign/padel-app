import { notFound } from "next/navigation";
import { requireDevelopmentPreview } from "@/lib/development/access";
import { videoProviderMode } from "@/lib/passport/video/localConfig";
import { streamConfig } from "@/lib/passport/video/stream/config";
import { loadSubmissionRecords } from "@/lib/passport/video/queries";
import VideoSubmission from "@/components/development/VideoSubmission";
import { loadReviewDetail } from "@/lib/passport/review/queries";
import AssessmentFeedback from "@/components/development/AssessmentFeedback";
import SubmissionNote from "@/components/development/SubmissionNote";
import AssessmentVideo from "@/components/development/AssessmentVideo";

export default async function SubmissionPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  await requireDevelopmentPreview(`/account/development/assessments/${orderId}`);
  const provider = videoProviderMode();
  if (!provider || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) notFound();
  const [[record], detail] = await Promise.all([loadSubmissionRecords(orderId), loadReviewDetail(orderId)]);
  if (!record) notFound();
  return <>{detail && record.order.state === "awaiting_submission" && !detail.order.active_attempt_id ? <SubmissionNote key={`notes:${orderId}`} orderId={orderId} initial={detail.context.player_notes} /> : null}<VideoSubmission key={`upload:${orderId}`} record={record} provider={provider} maxBytes={provider === "cloudflare_stream" ? streamConfig()!.maxBytes : undefined} />{detail ? <><AssessmentFeedback record={detail} />{detail.attempts.filter(attempt => attempt.id !== detail.order.active_attempt_id).map(attempt => <details key={attempt.id} className="mt-4 rounded-2xl border border-primary/10 bg-white p-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Previous video attempt {attempt.attempt_number} · {attempt.validation_state}</summary><AssessmentVideo orderId={orderId} attempt={attempt} title={detail.context.skill_title} /></details>)}</> : null}</>;
}
