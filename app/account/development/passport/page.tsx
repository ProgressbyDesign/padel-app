import MyPassport from "@/components/development/MyPassport";
import { requireDevelopmentPreview } from "@/lib/development/access";

export default async function PassportPage() {
  await requireDevelopmentPreview("/account/development/passport");
  return <MyPassport />;
}
