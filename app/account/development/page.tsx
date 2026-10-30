import MyDevelopment from "@/components/development/MyDevelopment";
import { requireDevelopmentPreview } from "@/lib/development/access";

export default async function DevelopmentPage() {
  await requireDevelopmentPreview();
  return <MyDevelopment />;
}
