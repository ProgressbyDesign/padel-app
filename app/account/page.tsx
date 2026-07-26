import { redirect } from "next/navigation";
import {
  loadOptionalAccountNavContext,
  resolveWorkspaceDestination,
} from "@/lib/workspace/resolve";

export default async function AccountResolverPage() {
  const context = await loadOptionalAccountNavContext();
  if (!context) {
    redirect(`/login?next=${encodeURIComponent("/account")}`);
  }
  redirect(resolveWorkspaceDestination(context));
}
