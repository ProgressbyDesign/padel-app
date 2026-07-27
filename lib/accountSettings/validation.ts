export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export type EmailChangeInput = {
  current: string;
  next: string;
  confirm: string;
};

export type PasswordChangeInput = {
  current: string;
  next: string;
  confirm: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDisplayName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 120) {
    return {
      ok: false,
      message: "Display name must be between 2 and 120 characters.",
    };
  }
  return { ok: true, value: trimmed };
}

export function validateEmailChange(
  input: EmailChangeInput
): ValidationResult {
  const current = input.current.trim().toLowerCase();
  const next = input.next.trim().toLowerCase();
  const confirm = input.confirm.trim().toLowerCase();

  if (!next || !EMAIL_PATTERN.test(next)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (next !== confirm) {
    return { ok: false, message: "Email addresses do not match." };
  }
  if (current && next === current) {
    return {
      ok: false,
      message: "Choose a different email from your current one.",
    };
  }
  return { ok: true, value: next };
}

export function validatePasswordChange(
  input: PasswordChangeInput
): ValidationResult {
  const current = input.current;
  const next = input.next;
  const confirm = input.confirm;

  if (!current) {
    return { ok: false, message: "Enter your current password." };
  }
  if (next.length < 8) {
    return {
      ok: false,
      message: "New password must be at least 8 characters.",
    };
  }
  if (next !== confirm) {
    return { ok: false, message: "New passwords do not match." };
  }
  if (next === current) {
    return {
      ok: false,
      message: "New password must be different from your current password.",
    };
  }
  return { ok: true, value: next };
}

export function validateDeletionReason(
  reason: string | null | undefined
): ValidationResult {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length > 1000) {
    return {
      ok: false,
      message: "Reason must be 1000 characters or fewer.",
    };
  }
  return { ok: true, value: trimmed };
}

export function isDeleteConfirmation(value: string): boolean {
  return value.trim() === "DELETE";
}
