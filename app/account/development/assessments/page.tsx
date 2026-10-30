import MyAssessments from "@/components/development/MyAssessments";
import { requireDevelopmentPreview } from "@/lib/development/access";

export default async function AssessmentsPage({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  await requireDevelopmentPreview("/account/development/assessments");
  const { intent } = await searchParams;
  return <MyAssessments submissionIntent={intent === "submit"} />;
}
