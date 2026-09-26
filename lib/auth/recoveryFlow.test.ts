import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { authCallbackUrl } from "./redirects";
import { GET } from "@/app/auth/callback/route";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(),
  claims: vi.fn(),
  reset: vi.fn(),
  create: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.create }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: {
    cookies: { setAll: (cookies: { name: string; value: string; options: { path: string; httpOnly: boolean } }[]) => void }
  }) => ({ auth: {
    exchangeCodeForSession: async (code: string) => {
      const result = await mocks.exchange(code);
      if (!result.error) options.cookies.setAll([
        { name: "test-auth-session", value: "test-session", options: { path: "/", httpOnly: true } },
      ]);
      return result;
    },
    getClaims: mocks.claims,
  } }),
}));

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://padel.example");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  mocks.exchange.mockReset().mockResolvedValue({ error: null });
  mocks.claims.mockReset().mockResolvedValue({ data: { claims: { sub: "test-user", amr: [] } }, error: null });
  mocks.reset.mockReset().mockResolvedValue({ error: null });
  mocks.create.mockReset().mockResolvedValue({ auth: { resetPasswordForEmail: mocks.reset } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("recovery origin", () => {
  it("uses the canonical APP_URL despite local headers and legacy URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000");
    expect(await authCallbackUrl("/reset-password")).toBe("https://padel.example/auth/callback?next=%2Freset-password");
  });
  it.each(["", "not-a-url", "http://localhost:3000", "https://localhost:3000", "https://127.0.0.1", "https://[::1]", "https://127.1", "http://padel.example", "https://user:password@padel.example"])("rejects unsafe production origin %s", async (origin) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
    await expect(authCallbackUrl("/reset-password")).rejects.toThrow("configured public HTTPS");
  });
  it("does not hide invalid APP_URL behind a valid SITE_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://localhost");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://padel.example");
    await expect(authCallbackUrl("/reset-password")).rejects.toThrow();
  });
  it("supports the SITE_URL alias when APP_URL is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://padel.example/");
    expect(await authCallbackUrl("/reset-password")).toContain("https://padel.example/auth/callback?");
  });
  it("preserves intentional local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(await authCallbackUrl("/reset-password")).toBe("http://localhost:3000/auth/callback?next=%2Freset-password");
  });
  it("fails safely before sending an email when production configuration is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { forgotPasswordAction } = await import("@/app/actions/auth");
    const form = new FormData();
    form.set("email", "test@example.invalid");
    const result = await forgotPasswordAction({ status: "idle", message: "" }, form);
    expect(result.status).toBe("error");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();
  });
});

describe("recovery callback", () => {
  const request = (query: string) => new NextRequest(`https://padel.example/auth/callback${query}`);
  it.each(["?next=%2Freset-password", "?type=recovery", "?next=%2Freset-password#error=access_denied&error_code=otp_expired"])("routes missing-code recovery to the reset request form: %s", async (query) => {
    const response = await GET(request(query));
    expect(response.headers.get("location")).toBe("https://padel.example/forgot-password?error=invalid");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(response.cookies.has("pp_password_recovery")).toBe(false);
  });
  it.each(["invalid", "expired", "already-used"])("handles %s exchange errors without granting recovery", async (reason) => {
    mocks.exchange.mockResolvedValue({ error: { message: reason } });
    const response = await GET(request("?code=test&next=%2Freset-password"));
    expect(response.headers.get("location")).toBe("https://padel.example/forgot-password?error=invalid");
    expect(response.cookies.has("pp_password_recovery")).toBe(false);
  });
  it("handles a rejected exchange promise", async () => {
    mocks.exchange.mockRejectedValue(new Error("provider unavailable"));
    const response = await GET(request("?code=test&next=%2Freset-password"));
    expect(response.headers.get("location")).toContain("/forgot-password?error=invalid");
  });
  it("preserves both auth and recovery cookies on success", async () => {
    const response = await GET(request("?code=test&next=%2Freset-password"));
    expect(mocks.exchange).toHaveBeenCalledWith("test");
    expect(response.headers.get("location")).toBe("https://padel.example/reset-password");
    expect(response.cookies.get("test-auth-session")?.value).toBe("test-session");
    expect(response.cookies.get("pp_password_recovery")).toMatchObject({ value: "active", httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 1200 });
  });
  it("preserves ordinary callback errors and safe redirects", async () => {
    expect((await GET(request(""))).headers.get("location")).toContain("/login?error=missing_code");
    const response = await GET(request("?code=test&next=https://evil.example"));
    expect(response.headers.get("location")).toBe("https://padel.example/account");
    expect(response.cookies.has("pp_password_recovery")).toBe(false);
  });
});
