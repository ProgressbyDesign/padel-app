import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthFormShell from "@/components/auth/AuthFormShell";
import SignupForm from "@/components/auth/SignupForm";
import { safeInternalPath } from "@/lib/auth/redirects";
import { getAuthenticatedAccount } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Padel Pathways account.",
};

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next);

  if (await getAuthenticatedAccount()) {
    redirect(nextPath);
  }

  return (
    <AuthFormShell
      title="Create your account"
      description="One account for your padel profile, coaches, and venues."
    >
      <SignupForm nextPath={nextPath} />
    </AuthFormShell>
  );
}
