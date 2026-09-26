import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { RECOVERY_COOKIE, recoveryCookieOptions } from "@/lib/auth/recoverySession";

export async function markPasswordRecoverySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(RECOVERY_COOKIE, "active", recoveryCookieOptions());
}

/** Attach the recovery marker to a redirect response so it survives the callback hop. */
export function applyPasswordRecoveryCookie(response: NextResponse): void {
  response.cookies.set(RECOVERY_COOKIE, "active", recoveryCookieOptions());
}

export async function hasPasswordRecoverySession(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(RECOVERY_COOKIE)?.value === "active";
}

export async function clearPasswordRecoverySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(RECOVERY_COOKIE);
}
