import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthFormShell from "@/components/auth/AuthFormShell";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { hasPasswordRecoverySession } from "@/lib/auth/recovery";
import { getAuthenticatedAccount } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your Padel Pathways account.",
};

export default async function ResetPasswordPage() {
  const [account, recoverySession] = await Promise.all([
    getAuthenticatedAccount(),
    hasPasswordRecoverySession(),
  ]);

  if (!account || !recoverySession) {
    redirect("/forgot-password?error=invalid");
  }

  return (
    <AuthFormShell
      title="Choose a new password"
      description="Your reset link is verified. Enter a new password for your account."
    >
      <ResetPasswordForm />
    </AuthFormShell>
  );
}
