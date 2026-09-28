import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { signupAction } from "@/app/actions/auth";
import { INITIAL_AUTH_ACTION_STATE } from "./types";

const mocks = vi.hoisted(() => ({ signup: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp: mocks.signup } }),
}));

const duplicateMessage = "An account with this email already exists. Log in or reset your password.";
function form(next = "/account/applications/coach") {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    fullName: "Test Coach", email: "TEST@example.invalid", password: "test-password",
    confirmPassword: "test-password", next,
  })) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://padel.example");
  mocks.signup.mockReset().mockResolvedValue({
    data: { user: { identities: [{ provider: "email" }] }, session: null }, error: null,
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("signup response handling", () => {
  it.each([
    ["/account", "player"],
    ["/account/applications/coach", "coach"],
    ["/account/applications/venue", "venue"],
  ])("preserves new confirmation and signup intent for %s", async (next, intent) => {
    expect(await signupAction(INITIAL_AUTH_ACTION_STATE, form(next))).toEqual({
      status: "success",
      message: "Check your email to confirm your account. You can close this page after following the confirmation link.",
    });
    expect(mocks.signup).toHaveBeenCalledExactlyOnceWith({
      email: "test@example.invalid", password: "test-password",
      options: {
        emailRedirectTo: `https://padel.example/auth/callback?next=${encodeURIComponent(next)}`,
        data: { full_name: "Test Coach", signup_intent: intent },
      },
    });
  });

  it.each([
    { code: "user_already_exists", message: "Duplicate account" },
    { message: "User already registered" },
    { message: "User already exists" },
  ])("handles an explicit duplicate error: %j", async (error) => {
    mocks.signup.mockResolvedValue({ data: { user: null, session: null }, error });
    expect(await signupAction(INITIAL_AUTH_ACTION_STATE, form())).toEqual({ status: "error", message: duplicateMessage });
  });

  it("detects a sanitized duplicate through the installed SDK without a user lookup", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "sanitized-user", aud: "authenticated", email: "test@example.invalid",
      created_at: "2026-09-28T00:00:00Z", app_metadata: {}, user_metadata: {}, identities: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const client = createClient("https://example.invalid", "test-publishable-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: transport },
    });
    mocks.signup.mockImplementation((credentials) => client.auth.signUp(credentials));
    expect(await signupAction(INITIAL_AUTH_ACTION_STATE, form())).toEqual({ status: "error", message: duplicateMessage });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(String(transport.mock.calls[0][0])).toContain("/auth/v1/signup?");
  });

  it("does not mistake absent identities for an empty array", async () => {
    mocks.signup.mockResolvedValue({ data: { user: { id: "new-user" }, session: null }, error: null });
    expect((await signupAction(INITIAL_AUTH_ACTION_STATE, form())).status).toBe("success");
  });

  it("keeps other provider errors generic", async () => {
    mocks.signup.mockResolvedValue({ data: { user: null, session: null }, error: { code: "unexpected_failure", message: "Private diagnostic" } });
    expect(await signupAction(INITIAL_AUTH_ACTION_STATE, form())).toEqual({
      status: "error", message: "We could not create your account. Please try again.",
    });
  });
});
