export const RECOVERY_COOKIE = "pp_password_recovery";
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 60 * 20;
export const RESET_PASSWORD_PATH = "/reset-password";

export type RecoveryCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export function recoveryCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV
): RecoveryCookieOptions {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
  };
}

/**
 * GoTrue recovery sessions include `amr` entries with method "recovery".
 * Used when the short-lived marker cookie is missing after the callback redirect.
 */
export function isRecoveryAmr(amr: unknown): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some((entry) => {
    if (typeof entry === "string") return entry === "recovery";
    if (!entry || typeof entry !== "object") return false;
    return "method" in entry && (entry as { method?: unknown }).method === "recovery";
  });
}

/** Recovery links must finish on the reset form even if `next` was stripped. */
export function passwordRecoveryDestination(input: {
  nextPath: string;
  amr?: unknown;
}): string {
  if (input.nextPath === RESET_PASSWORD_PATH || isRecoveryAmr(input.amr)) {
    return RESET_PASSWORD_PATH;
  }
  return input.nextPath;
}
