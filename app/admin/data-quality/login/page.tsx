import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Shared-secret login is retired. Owners enter via admin membership. */
export default function RetiredDataQualityLoginPage() {
  redirect("/admin/data-quality");
}
