"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ACCOUNT_AVATARS_BUCKET,
  isAccountAvatarStoragePath,
} from "@/lib/accountAvatar";
import {
  validateDisplayName,
  validateEmailChange,
  validatePasswordChange,
} from "@/lib/accountSettings/validation";
import { clearPasswordRecoverySession } from "@/lib/auth/recovery";
import { authCallbackUrl } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

export type AccountSettingsActionResult =
  | { ok: true; message: string; warning?: string }
  | { ok: false; message: string };

type UserSupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function requireClaimsUserId(
  supabase: UserSupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;
  return userId;
}

async function requireClaimsAccount(
  supabase: UserSupabaseClient
): Promise<{ userId: string; email: string } | null> {
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;
  const email =
    typeof data?.claims?.email === "string" ? data.claims.email : "";
  return { userId, email };
}

function authErrorCode(error: { code?: string; message?: string } | null): string {
  return (error?.code ?? "").toLowerCase();
}

function authErrorMessage(error: { message?: string } | null): string {
  return error?.message ?? "";
}

function mapEmailChangeError(error: {
  code?: string;
  message?: string;
} | null): string {
  const code = authErrorCode(error);
  const message = authErrorMessage(error);

  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    /already registered|already exists|email.*taken/i.test(message)
  ) {
    return "An account with this email already exists.";
  }
  if (
    code === "email_address_invalid" ||
    code === "validation_failed" ||
    /invalid.*email|email.*invalid/i.test(message)
  ) {
    return "Enter a valid email address.";
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    /rate.?limit|too many/i.test(message)
  ) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (
    code === "reauthentication_needed" ||
    /reauth|recent.*login|recently.*authenticated/i.test(message)
  ) {
    return "For security, sign in again before changing your email.";
  }
  return "We could not update your email. Please try again.";
}

function mapPasswordChangeError(error: {
  code?: string;
  message?: string;
} | null): string {
  const code = authErrorCode(error);
  const message = authErrorMessage(error);

  if (
    code === "weak_password" ||
    /weak.?password|password.*strength/i.test(message)
  ) {
    return "Choose a stronger password.";
  }
  if (code === "same_password") {
    return "New password must be different from your current password.";
  }
  if (
    code === "reauthentication_needed" ||
    /reauth|recent.*login|recently.*authenticated/i.test(message)
  ) {
    return "For security, sign in again before changing your password.";
  }
  return "We could not update your password. Please try again.";
}

function revalidateAccountSettings() {
  revalidatePath("/account/settings");
  revalidatePath("/account/personal");
  revalidatePath("/");
  revalidatePath("/account", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  revalidatePath("/admin/audit");
}

export async function updateAccountDisplayNameAction(
  fullName: string
): Promise<AccountSettingsActionResult> {
  const validated = validateDisplayName(fullName);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const supabase = await createClient();
  const userId = await requireClaimsUserId(supabase);
  if (!userId) {
    return { ok: false, message: "You must be signed in to update your name." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: validated.value })
    .eq("id", userId);

  if (error) {
    return { ok: false, message: "Your display name could not be updated." };
  }

  revalidateAccountSettings();
  return { ok: true, message: "Display name updated." };
}

export async function registerAccountAvatarAction(
  storagePath: string
): Promise<AccountSettingsActionResult> {
  const supabase = await createClient();
  const userId = await requireClaimsUserId(supabase);
  if (!userId) {
    return { ok: false, message: "You must be signed in to update your photo." };
  }

  if (!isAccountAvatarStoragePath(storagePath, userId)) {
    return { ok: false, message: "The uploaded photo could not be registered." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_path: storagePath,
      avatar_updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    await supabase.storage.from(ACCOUNT_AVATARS_BUCKET).remove([storagePath]);
    return { ok: false, message: "The uploaded photo could not be registered." };
  }

  revalidateAccountSettings();
  return { ok: true, message: "Profile photo updated." };
}

export async function removeAccountAvatarAction(): Promise<AccountSettingsActionResult> {
  const supabase = await createClient();
  const userId = await requireClaimsUserId(supabase);
  if (!userId) {
    return { ok: false, message: "You must be signed in to remove your photo." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return { ok: false, message: "Your profile photo could not be removed." };
  }

  const storagePath =
    typeof profile?.avatar_path === "string" && profile.avatar_path.trim()
      ? profile.avatar_path.trim()
      : null;

  if (!storagePath) {
    return { ok: true, message: "No profile photo to remove." };
  }

  if (!isAccountAvatarStoragePath(storagePath, userId)) {
    const { error: clearError } = await supabase
      .from("profiles")
      .update({ avatar_path: null, avatar_updated_at: null })
      .eq("id", userId);
    if (clearError) {
      return { ok: false, message: "Your profile photo could not be removed." };
    }
    revalidateAccountSettings();
    return {
      ok: true,
      message: "Profile photo reference cleared.",
      warning:
        "The Storage object used an unexpected path and was left unchanged.",
    };
  }

  const { error: removeError } = await supabase.storage
    .from(ACCOUNT_AVATARS_BUCKET)
    .remove([storagePath]);

  const { error: clearError } = await supabase
    .from("profiles")
    .update({ avatar_path: null, avatar_updated_at: null })
    .eq("id", userId);

  if (clearError) {
    return {
      ok: false,
      message: removeError
        ? "Your profile photo could not be removed."
        : "Storage was cleared, but the profile reference could not be updated.",
    };
  }

  revalidateAccountSettings();

  if (removeError) {
    return {
      ok: true,
      message: "Profile photo removed from your account.",
      warning:
        "The Storage object could not be cleaned up automatically.",
    };
  }

  return { ok: true, message: "Profile photo removed." };
}

export async function changeAccountEmailAction(input: {
  newEmail: string;
  confirmEmail: string;
}): Promise<AccountSettingsActionResult> {
  const supabase = await createClient();
  const account = await requireClaimsAccount(supabase);
  if (!account) {
    return { ok: false, message: "You must be signed in to change your email." };
  }

  const validated = validateEmailChange({
    current: account.email,
    next: input.newEmail,
    confirm: input.confirmEmail,
  });
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const emailRedirectTo = await authCallbackUrl("/account/settings");
  const { data, error } = await supabase.auth.updateUser(
    { email: validated.value },
    { emailRedirectTo }
  );

  if (error) {
    return { ok: false, message: mapEmailChangeError(error) };
  }

  revalidatePath("/account/settings");

  const confirmedEmail =
    typeof data.user?.email === "string" ? data.user.email.toLowerCase() : "";
  const pendingNewEmail =
    typeof data.user?.new_email === "string"
      ? data.user.new_email.toLowerCase()
      : "";

  if (confirmedEmail === validated.value && !pendingNewEmail) {
    return { ok: true, message: "Your email has been updated." };
  }

  return {
    ok: true,
    message:
      "Check your email to confirm the change. Your current email stays active until you confirm.",
  };
}

export async function changeAccountPasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<AccountSettingsActionResult> {
  const supabase = await createClient();
  const account = await requireClaimsAccount(supabase);
  if (!account) {
    return {
      ok: false,
      message: "You must be signed in to change your password.",
    };
  }
  if (!account.email) {
    return {
      ok: false,
      message: "Your account email is unavailable. Sign in again and retry.",
    };
  }

  const validated = validatePasswordChange({
    current: input.currentPassword,
    next: input.newPassword,
    confirm: input.confirmPassword,
  });
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: input.currentPassword,
  });

  if (verifyError) {
    const code = authErrorCode(verifyError);
    if (
      code === "invalid_credentials" ||
      /invalid.*credentials|email or password/i.test(
        authErrorMessage(verifyError)
      )
    ) {
      return { ok: false, message: "Your current password is incorrect." };
    }
    return {
      ok: false,
      message: "We could not verify your current password. Please try again.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: validated.value,
  });

  if (updateError) {
    return { ok: false, message: mapPasswordChangeError(updateError) };
  }

  revalidatePath("/account/settings");
  return { ok: true, message: "Your password has been updated." };
}

export async function signOutOtherSessionsAction(): Promise<AccountSettingsActionResult> {
  const supabase = await createClient();
  const userId = await requireClaimsUserId(supabase);
  if (!userId) {
    return { ok: false, message: "You must be signed in to manage sessions." };
  }

  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    return {
      ok: false,
      message: "We could not sign out your other sessions. Please try again.",
    };
  }

  return {
    ok: true,
    message: "Other sessions have been signed out. This device stays signed in.",
  };
}

export async function signOutEverywhereAction(): Promise<void> {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch (error) {
    console.warn(
      "[account/settings] signOut global failed:",
      error instanceof Error ? error.message : error
    );
  }
  await clearPasswordRecoverySession();
  revalidatePath("/", "layout");
  redirect("/login");
}
