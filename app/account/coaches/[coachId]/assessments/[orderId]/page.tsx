import { notFound } from "next/navigation";
import AssessmentReview from "@/components/account/AssessmentReview";
import { loadReviewDetail } from "@/lib/passport/review/queries";

export default async function CoachAssessmentPage({ params }: { params: Promise<{ coachId: string; orderId: string }> }) {
  const { coachId, orderId } = await params;
  const record = await loadReviewDetail(orderId, coachId);
  if (!record) notFound();
  return <AssessmentReview coachId={coachId} record={record} />;
}
