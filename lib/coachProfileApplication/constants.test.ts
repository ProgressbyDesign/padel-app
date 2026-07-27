import { describe, expect, it } from "vitest";
import {
  ACTIVE_APPLICATION_STATUSES,
  HISTORY_APPLICATION_STATUSES,
  isActiveApplicationStatus,
  isWithdrawableApplicationStatus,
  WITHDRAWABLE_APPLICATION_STATUSES,
} from "@/lib/coachProfileApplication/constants";

describe("application status sets", () => {
  it("treats draft and submitted as active", () => {
    expect(ACTIVE_APPLICATION_STATUSES).toContain("draft");
    expect(ACTIVE_APPLICATION_STATUSES).toContain("submitted");
    expect(isActiveApplicationStatus("under_review")).toBe(true);
  });

  it("keeps approved in history only", () => {
    expect(HISTORY_APPLICATION_STATUSES).toContain("approved");
    expect(isActiveApplicationStatus("approved")).toBe(false);
  });

  it("allows withdrawal for active statuses", () => {
    for (const status of WITHDRAWABLE_APPLICATION_STATUSES) {
      expect(isWithdrawableApplicationStatus(status)).toBe(true);
    }
    expect(isWithdrawableApplicationStatus("approved")).toBe(false);
  });
});
