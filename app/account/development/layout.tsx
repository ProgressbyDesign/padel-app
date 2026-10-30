import type { Metadata } from "next";
import { requireDevelopmentPreview } from "@/lib/development/access";
import { DevelopmentPreviewProvider } from "@/components/development/DevelopmentPreviewProvider";
import DevelopmentShell from "@/components/development/DevelopmentShell";

export const metadata: Metadata = { title: "Progress Passport preview", robots: { index: false, follow: false } };

export default async function DevelopmentLayout({ children }: { children: React.ReactNode }) {
  const account = await requireDevelopmentPreview();
  return <DevelopmentPreviewProvider key={account.id}><DevelopmentShell>{children}</DevelopmentShell></DevelopmentPreviewProvider>;
}
