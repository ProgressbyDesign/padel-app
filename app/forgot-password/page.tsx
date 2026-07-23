import type { Metadata } from "next";
import AuthFormShell from "@/components/auth/AuthFormShell";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import FormMessage from "@/components/auth/FormMessage";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a secure Padel Pathways password reset.",
};

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const invalid = params.error === "invalid";

  return (
    <AuthFormShell
      title="Reset your password"
      description="Enter your account email and we’ll send you a secure reset link."
    >
      <div className="space-y-5">
        {invalid ? (
          <FormMessage status="error">
            This password reset link is invalid or has expired. Request a new one below.
          </FormMessage>
        ) : null}
        <ForgotPasswordForm />
      </div>
    </AuthFormShell>
  );
}
