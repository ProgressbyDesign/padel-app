"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearPasswordRecoverySession,
  hasPasswordRecoverySession,
} from "@/lib/auth/recovery";
import { authCallbackUrl, safeInternalPath } from "@/lib/auth/redirects";
import type { AuthActionState } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

function rawText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function text(formData: FormData, key: string): string {
  return rawText(formData, key).trim();
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function error(message: string): AuthActionState {
  return { status: "error", message };
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = text(formData, "email").toLowerCase();
  const password = rawText(formData, "password");
  const nextPath = safeInternalPath(text(formData, "next"));

  if (!validEmail(email)) return error("Enter a valid email address.");
  if (!password) return error("Enter your password.");

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    return error("The email or password is incorrect.");
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fullName = text(formData, "fullName");
  const email = text(formData, "email").toLowerCase();
  const password = rawText(formData, "password");
  const confirmPassword = rawText(formData, "confirmPassword");
  const nextPath = safeInternalPath(text(formData, "next"));

  if (fullName.length < 2) return error("Enter your full name.");
  if (!validEmail(email)) return error("Enter a valid email address.");
  if (password.length < 8) {
    return error("Use a password with at least 8 characters.");
  }
  if (password !== confirmPassword) return error("The passwords do not match.");

  const emailRedirectTo = await authCallbackUrl(nextPath);
  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        full_name: fullName,
      },
    },
  });

  if (authError) {
    if (/already registered|already exists/i.test(authError.message)) {
      return error("An account with this email already exists.");
    }
    return error("We could not create your account. Please try again.");
  }

  return {
    status: "success",
    message:
      "Check your email to confirm your account. You can close this page after following the confirmation link.",
  };
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = text(formData, "email").toLowerCase();
  if (!validEmail(email)) return error("Enter a valid email address.");

  const redirectTo = await authCallbackUrl("/reset-password");
  const supabase = await createClient();
  const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (authError) {
    return error("We could not send the reset email. Please try again.");
  }

  return {
    status: "success",
    message:
      "If an account exists for that email, a password reset link is on its way.",
  };
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = rawText(formData, "password");
  const confirmPassword = rawText(formData, "confirmPassword");

  if (password.length < 8) {
    return error("Use a password with at least 8 characters.");
  }
  if (password !== confirmPassword) return error("The passwords do not match.");
  if (!(await hasPasswordRecoverySession())) {
    return error("This password reset link is invalid or has expired.");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    return error("This password reset session is no longer valid.");
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return error("We could not update your password. Please try again.");
  }

  await clearPasswordRecoverySession();
  redirect("/account");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.warn(
      "[auth] signOut failed:",
      error instanceof Error ? error.message : error
    );
  }
  await clearPasswordRecoverySession();
  revalidatePath("/", "layout");
  redirect("/login");
}
