import { describe, expect, it } from "vitest";
import {
  shouldForwardStrandedAuthCode,
  strandedAuthCallbackPath,
} from "./strandedAuthCode";

describe("shouldForwardStrandedAuthCode", () => {
  it("only treats the Site URL path as a leftover auth-code landing", () => {
    expect(shouldForwardStrandedAuthCode("/")).toBe(true);
    expect(shouldForwardStrandedAuthCode("/products")).toBe(false);
    expect(shouldForwardStrandedAuthCode("/auth/callback")).toBe(false);
    expect(shouldForwardStrandedAuthCode("/login")).toBe(false);
    expect(shouldForwardStrandedAuthCode("/reset-password")).toBe(false);
  });
});

describe("strandedAuthCallbackPath", () => {
  it("forwards /?code= to the callback and keeps auth query params", () => {
    expect(strandedAuthCallbackPath("/", "?code=ABC")).toBe("/auth/callback?code=ABC");
    expect(strandedAuthCallbackPath("/", "?code=ABC&next=%2Freset-password")).toBe(
      "/auth/callback?code=ABC&next=%2Freset-password"
    );
  });

  it("does not intercept unrelated routes that use ?code=", () => {
    expect(strandedAuthCallbackPath("/products", "?code=SUMMER26")).toBeNull();
    expect(strandedAuthCallbackPath("/coaches", "?code=ABC")).toBeNull();
    expect(strandedAuthCallbackPath("/auth/callback", "?code=ABC")).toBeNull();
    expect(strandedAuthCallbackPath("/", "")).toBeNull();
    expect(strandedAuthCallbackPath("/", "?next=/account")).toBeNull();
  });
});
