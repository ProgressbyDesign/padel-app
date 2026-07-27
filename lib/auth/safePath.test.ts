import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/auth/safePath";

describe("safeInternalPath", () => {
  it("accepts valid internal paths", () => {
    expect(safeInternalPath("/account")).toBe("/account");
    expect(safeInternalPath("/account/settings")).toBe("/account/settings");
    expect(safeInternalPath("/book/coach/abc?start=1")).toBe(
      "/book/coach/abc?start=1"
    );
  });

  it("rejects absolute URLs", () => {
    expect(safeInternalPath("https://evil.example/account")).toBe("/account");
    expect(safeInternalPath("http://evil.example")).toBe("/account");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeInternalPath("//evil.example/account")).toBe("/account");
  });

  it("rejects javascript: schemes", () => {
    expect(safeInternalPath("javascript:alert(1)")).toBe("/account");
    expect(safeInternalPath("/javascript:alert(1)")).toBe("/account");
  });

  it("uses fallback when empty", () => {
    expect(safeInternalPath(null, "/login")).toBe("/login");
    expect(safeInternalPath("   ")).toBe("/account");
  });
});
