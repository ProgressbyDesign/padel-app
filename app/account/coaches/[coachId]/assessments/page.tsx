import { notFound } from "next/navigation";
import AssessmentQueue from "@/components/account/AssessmentQueue";
import { reviewExperienceEnabled } from "@/lib/passport/review/access";
import { loadReviewSummaries } from "@/lib/passport/review/queries";

export default async function CoachAssessmentsPage({ params }: { params: Promise<{ coachId: string }> }) {
  if (!reviewExperienceEnabled()) notFound();
  const { coachId } = await params;
  return <AssessmentQueue coachId={coachId} records={await loadReviewSummaries(coachId)} />;
}
