import "server-only";
import { notFound } from "next/navigation";
import { requireAuthenticatedAccount } from "@/lib/auth/session";
import { developmentPreviewEnabled } from "./flags";

export async function requireDevelopmentPreview(path = "/account/development") {
  if (!developmentPreviewEnabled()) notFound();
  return requireAuthenticatedAccount(path);
}
