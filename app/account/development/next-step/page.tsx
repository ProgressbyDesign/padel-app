import MyNextStep from "@/components/development/MyNextStep";
import { requireDevelopmentPreview } from "@/lib/development/access";

export default async function NextStepPage() {
  await requireDevelopmentPreview("/account/development/next-step");
  return <MyNextStep />;
}
