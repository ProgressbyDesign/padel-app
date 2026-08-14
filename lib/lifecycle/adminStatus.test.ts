import { describe, expect, it } from "vitest";
import {
  accountAdminLabel,
  buildAdminLifecycleSummary,
  canPublishForLaunch,
  isPubliclyVisibleForDirectory,
  launchSelectionAdminLabel,
  onboardingAdminLabel,
  publicationAdminLabel,
  verificationAdminLabel,
} from "@/lib/lifecycle/adminStatus";
import {
  LAUNCH_SELECTION_STATUSES,
  ONBOARDING_STATUSES,
  PUBLICATION_STATUSES,
} from "@/lib/lifecycle/constants";

describe("admin lifecycle labels", () => {
  it("labels every launch, publication and onboarding value", () => {
    for (const status of LAUNCH_SELECTION_STATUSES) {
      expect(launchSelectionAdminLabel(status)).toBeTruthy();
    }
    for (const status of PUBLICATION_STATUSES) {
      expect(publicationAdminLabel(status)).toBeTruthy();
    }
    for (const status of ONBOARDING_STATUSES) {
      expect(onboardingAdminLabel(status)).toBeTruthy();
    }
    expect(launchSelectionAdminLabel("selected")).toBe(
      "Top 10 / Selected for launch"
    );
    expect(launchSelectionAdminLabel("unselected")).toBe("Not selected");
    expect(publicationAdminLabel("published")).toBe("Published");
  });

  it("falls back to the safest state for unknown values", () => {
    expect(launchSelectionAdminLabel("banana")).toBe("Not selected");
    expect(publicationAdminLabel(null)).toBe("Private");
    expect(onboardingAdminLabel(undefined)).toBe("Not started");
  });

  it("keeps verification wording distinct from publication wording", () => {
    expect(verificationAdminLabel(true)).toBe("Approved");
    expect(verificationAdminLabel(false)).toBe("Not approved");
    expect(verificationAdminLabel(true)).not.toBe(
      publicationAdminLabel("published")
    );
    expect(accountAdminLabel(true)).toBe("Managed");
    expect(accountAdminLabel(false)).toBe("Unclaimed");
  });
});

describe("admin lifecycle summary", () => {
  it("shows approved + unclaimed imported coaches as not selected and private", () => {
    const rows = buildAdminLifecycleSummary({
      isApproved: true,
      hasAccount: false,
      launchSelectionStatus: "unselected",
      publicationStatus: "private",
    });
    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Verification", "Approved"],
      ["Account", "Unclaimed"],
      ["Launch", "Not selected"],
      ["Visibility", "Private"],
    ]);
  });

  it("shows a published unclaimed coach as publicly visible", () => {
    const rows = buildAdminLifecycleSummary({
      isApproved: false,
      hasAccount: false,
      launchSelectionStatus: "selected",
      publicationStatus: "published",
    });
    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Verification", "Not approved"],
      ["Account", "Unclaimed"],
      ["Launch", "Top 10 / Selected for launch"],
      ["Visibility", "Published"],
    ]);
  });
});

describe("publication safeguard", () => {
  it("only allows publishing coaches selected for launch", () => {
    expect(canPublishForLaunch("selected")).toBe(true);
    expect(canPublishForLaunch("unselected")).toBe(false);
    expect(canPublishForLaunch("excluded")).toBe(false);
    expect(canPublishForLaunch(null)).toBe(false);
  });
});

describe("directory visibility depends only on publication status", () => {
  it("excludes approved but private coaches", () => {
    expect(
      isPubliclyVisibleForDirectory({
        publicationStatus: "private",
        isApproved: true,
        hasAccount: true,
      })
    ).toBe(false);
    expect(
      isPubliclyVisibleForDirectory({
        publicationStatus: "suspended",
        isApproved: true,
        hasAccount: true,
      })
    ).toBe(false);
  });

  it("includes published coaches with no account or claim", () => {
    expect(
      isPubliclyVisibleForDirectory({
        publicationStatus: "published",
        isApproved: false,
        hasAccount: false,
      })
    ).toBe(true);
  });
});
