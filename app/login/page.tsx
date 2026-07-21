import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthFormShell from "@/components/auth/AuthFormShell";
import LoginForm from "@/components/auth/LoginForm";
import { getAuthenticatedAccount } from "@/lib/auth/session";
import { safeInternalPath } from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Padel Pathways account.",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value[0] ?? null : null;
}

function callbackErrorMessage(code: string | null): string | null {
  if (code === "missing_code") return "The confirmation link is incomplete.";
  if (code === "invalid_code") {
    return "This authentication link is invalid or has expired. Please try again.";
  }
  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeInternalPath(first(params.next));
  const initialError = callbackErrorMessage(first(params.error));

  if (await getAuthenticatedAccount()) {
    redirect(nextPath);
  }

  return (
    <AuthFormShell
      title="Welcome back"
      description="Log in to manage your Padel Pathways account."
    >
      <LoginForm nextPath={nextPath} initialError={initialError} />
    </AuthFormShell>
  );
}
