import "server-only";

import { cookies } from "next/headers";

const RECOVERY_COOKIE = "pp_password_recovery";

export async function markPasswordRecoverySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(RECOVERY_COOKIE, "active", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 20,
  });
}

export async function hasPasswordRecoverySession(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(RECOVERY_COOKIE)?.value === "active";
}

export async function clearPasswordRecoverySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(RECOVERY_COOKIE);
}
