import type { Metadata } from "next";
import { requireAuthenticatedAccount } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your Padel Pathways account, coaches, and venues.",
};

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthenticatedAccount("/account");
  return children;
}
