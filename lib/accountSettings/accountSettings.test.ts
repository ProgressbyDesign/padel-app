import { describe, expect, it } from "vitest";
import {
  accountAvatarStoragePath,
  isAccountAvatarMimeType,
  isAccountAvatarStoragePath,
  MAX_ACCOUNT_AVATAR_BYTES,
} from "@/lib/accountAvatar";
import {
  isDeleteConfirmation,
  validateDisplayName,
  validateEmailChange,
  validatePasswordChange,
} from "@/lib/accountSettings/validation";
import {
  buildDeletionCancelUpdate,
  buildDeletionInsertPayload,
} from "@/lib/accountDeletion/payload";

const USER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("account avatar path", () => {
  it("derives path only from authenticated user id", () => {
    expect(accountAvatarStoragePath(USER_ID)).toBe(`accounts/${USER_ID}/avatar`);
    expect(isAccountAvatarStoragePath(`accounts/${USER_ID}/avatar`, USER_ID)).toBe(
      true
    );
    expect(
      isAccountAvatarStoragePath(
        "accounts/ffffffff-ffff-4fff-8fff-ffffffffffff/avatar",
        USER_ID
      )
    ).toBe(false);
  });

  it("validates mime and size constants", () => {
    expect(isAccountAvatarMimeType("image/jpeg")).toBe(true);
    expect(isAccountAvatarMimeType("image/gif")).toBe(false);
    expect(MAX_ACCOUNT_AVATAR_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("settings validation", () => {
  it("validates display name", () => {
    expect(validateDisplayName("A").ok).toBe(false);
    expect(validateDisplayName("  Ada Lovelace  ")).toEqual({
      ok: true,
      value: "Ada Lovelace",
    });
  });

  it("validates email change", () => {
    expect(
      validateEmailChange({
        current: "old@example.com",
        next: "old@example.com",
        confirm: "old@example.com",
      }).ok
    ).toBe(false);
    expect(
      validateEmailChange({
        current: "old@example.com",
        next: "new@example.com",
        confirm: "new@example.com",
      })
    ).toEqual({ ok: true, value: "new@example.com" });
  });

  it("validates password confirmation", () => {
    expect(
      validatePasswordChange({
        current: "oldpassword",
        next: "short",
        confirm: "short",
      }).ok
    ).toBe(false);
    expect(
      validatePasswordChange({
        current: "oldpassword",
        next: "newpassword",
        confirm: "newpassword",
      }).ok
    ).toBe(true);
  });

  it("requires DELETE confirmation", () => {
    expect(isDeleteConfirmation("DELETE")).toBe(true);
    expect(isDeleteConfirmation("delete")).toBe(false);
  });
});

describe("deletion payloads", () => {
  it("omits requester_email from insert", () => {
    const payload = buildDeletionInsertPayload({
      userId: USER_ID,
      reason: "Moving away",
    });
    expect(payload).toEqual({
      user_id: USER_ID,
      status: "requested",
      reason: "Moving away",
    });
    expect(payload).not.toHaveProperty("requester_email");
  });

  it("cancels with status=cancelled only", () => {
    expect(buildDeletionCancelUpdate()).toEqual({ status: "cancelled" });
  });
});
