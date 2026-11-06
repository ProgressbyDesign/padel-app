import MyNextStep from "@/components/development/MyNextStep";
import { requireDevelopmentPreview } from "@/lib/development/access";
import { reviewExperienceEnabled } from "@/lib/passport/review/access";
import { loadPlayerReviewDetails } from "@/lib/passport/review/queries";
import PassportRecords from "@/components/development/PassportRecords";

export default async function NextStepPage() {
  await requireDevelopmentPreview("/account/development/next-step");
  return reviewExperienceEnabled() ? <PassportRecords nextStep records={await loadPlayerReviewDetails()} /> : <MyNextStep />;
}
