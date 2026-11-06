import MyPassport from "@/components/development/MyPassport";
import { requireDevelopmentPreview } from "@/lib/development/access";
import { reviewExperienceEnabled } from "@/lib/passport/review/access";
import { loadPlayerReviewDetails } from "@/lib/passport/review/queries";
import PassportRecords from "@/components/development/PassportRecords";

export default async function PassportPage() {
  await requireDevelopmentPreview("/account/development/passport");
  return reviewExperienceEnabled() ? <PassportRecords records={await loadPlayerReviewDetails()} /> : <MyPassport />;
}
