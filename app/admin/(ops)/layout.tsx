import type { ReactNode } from "react";
import OpsAdminShell from "@/components/admin/OpsAdminShell";
import { requireAdminAccount } from "@/lib/auth/adminSession";

export default async function OpsAdminLayout({ children }: { children: ReactNode }) {
  const account = await requireAdminAccount();
  return <OpsAdminShell account={account}>{children}</OpsAdminShell>;
}
