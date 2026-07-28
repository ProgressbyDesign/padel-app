import type { ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { requireDataQualityNavAccess } from "@/lib/auth/adminSession";

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireDataQualityNavAccess();
  return <AdminShell>{children}</AdminShell>;
}
