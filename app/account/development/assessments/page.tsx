import MyAssessments from "@/components/development/MyAssessments";
import { loadSubmissionRecords } from "@/lib/passport/video/queries";
import { requireDevelopmentPreview } from "@/lib/development/access";
import { loadPlayerReviewDetails } from "@/lib/passport/review/queries";

export default async function AssessmentsPage({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  await requireDevelopmentPreview("/account/development/assessments");
  const { intent } = await searchParams;
  const [records, reviews] = await Promise.all([loadSubmissionRecords(), loadPlayerReviewDetails()]);
  const feedback = Object.fromEntries(reviews.map(record => [record.order.id, { assessor: record.context.assessor_name, summary: record.reviews[0]?.observations ?? "" }]));
  return <MyAssessments submissionIntent={intent === "submit"} records={records} feedback={feedback} />;
}
