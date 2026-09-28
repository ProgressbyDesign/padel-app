import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./productEmail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./productEmail")>()),
  sendProductEmail: send,
}));

import {
  sendCoachApplicationStatusEmail,
  sendCoachApplicationWithdrawnEmails,
  sendVenueApplicationStatusEmail,
  sendVenueApplicationWithdrawnEmails,
} from "./applicationEmails";
import { brandedEmailTemplate, emailTestCopies, registrationCopies } from "./brandedEmail";

const ROOT = path.resolve(__dirname, "..", "..");

describe("application email journey", () => {
  beforeEach(() => {
    send.mockClear();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
    vi.stubEnv("APPLICATION_NOTIFY_EMAIL", "admin@example.com");
    vi.stubEnv("REGISTRATION_TEST_COPY_EMAILS", "tester@example.com,admin@example.com,tester@example.com");
    delete process.env.EMAIL_TEST_COPY_EMAILS;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends a submission receipt and a direct admin review link", async () => {
    await sendCoachApplicationStatusEmail({
      to: "player@example.com",
      status: "submitted",
      mode: "create_new",
      applicationId: "app-123",
      coachName: "Juan Martin",
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toMatchObject({
      from: "Padel Pathways <hello@padelpathways.com>",
      replyTo: "hello@padelpathways.com",
      to: "player@example.com",
      subject: "We've received your coach application",
      bcc: ["tester@example.com", "admin@example.com"],
    });
    expect(send.mock.calls[0][0].html).toContain("does not publish a profile");
    expect(send.mock.calls[0][0].html).toContain("https://example.com/account/applications/coach");
    expect(send.mock.calls[1][0].subject).toBe("New coach application — Juan Martin");
    expect(send.mock.calls[1][0].html).toContain("https://example.com/admin/applications/coaches/app-123");
    expect(send.mock.calls[1][0].html).not.toContain("review and publish");
    expect(send.mock.calls[1][0].bcc).toEqual(["tester@example.com"]);
  });

  it("includes changes-requested feedback and an update link", async () => {
    await sendCoachApplicationStatusEmail({
      to: "player@example.com",
      status: "changes_requested",
      mode: "create_new",
      note: "Please add your coaching venues.",
    });
    const html = send.mock.calls[0][0].html as string;
    expect(html).toContain("Please add your coaching venues.");
    expect(html).toContain("Update my application");
    expect(html).toContain("https://example.com/account/applications/coach");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("approves without saying the profile is published or live", async () => {
    await sendCoachApplicationStatusEmail({
      to: "player@example.com",
      status: "approved",
      mode: "create_new",
      coachId: "coach-1",
      note: '<script>alert("bad")</script>',
    });
    const html = send.mock.calls[0][0].html as string;
    expect(html).toContain("has been approved");
    expect(html).toContain("complete your profile");
    expect(html).toContain("Open my coach dashboard");
    expect(html).toContain('href="https://example.com/account/coaches/coach-1"');
    expect(html.toLowerCase()).not.toMatch(/\bpublished\b/);
    expect(html.toLowerCase()).not.toMatch(/\blive\b/);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("declines with the review note and an application link", async () => {
    await sendVenueApplicationStatusEmail({
      to: "owner@example.com",
      status: "declined",
      mode: "create_new",
      note: "We need a venue address.",
    });
    const html = send.mock.calls[0][0].html as string;
    expect(html).toContain("unable to approve");
    expect(html).toContain("We need a venue address.");
    expect(html).toContain("https://example.com/account/applications/venue");
  });

  it("does not claim venue publication after approval and links the venue dashboard", async () => {
    await sendVenueApplicationStatusEmail({
      to: "owner@example.com",
      status: "approved",
      mode: "create_new",
      venueId: "venue-9",
    });
    const html = send.mock.calls[0][0].html as string;
    expect(html.toLowerCase()).not.toMatch(/\bpublished\b/);
    expect(html).toContain("https://example.com/account/venues/venue-9");
    expect(html).toContain("Open my venue dashboard");
  });

  it("confirms withdrawal without deleting the account and links the admin application", async () => {
    await sendCoachApplicationWithdrawnEmails({
      applicantEmail: "player@example.com",
      previousStatus: "submitted",
      mode: "create_new",
      coachName: "Juan Martin",
      applicationId: "app-123",
    });
    expect(send.mock.calls[0][0].html).toContain("has not been deleted");
    expect(send.mock.calls[0][0].html).toContain("https://example.com/account");
    expect(send.mock.calls[1][0].html).toContain("https://example.com/admin/applications/coaches/app-123");
    expect(send.mock.calls[1][0].html).toContain("Juan Martin has withdrawn");
  });

  it("sends a venue withdrawal pair when the application was in review", async () => {
    await sendVenueApplicationWithdrawnEmails({
      applicantEmail: "owner@example.com",
      previousStatus: "under_review",
      venueName: "Marbella Padel Club",
      applicationId: "venue-app",
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].html).toContain(
      "https://example.com/admin/applications/venues/venue-app"
    );
  });

  it("does not email an admin for a draft withdrawal", async () => {
    await sendCoachApplicationWithdrawnEmails({
      applicantEmail: "player@example.com",
      previousStatus: "draft",
      mode: "create_new",
      applicationId: "app-123",
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe("player@example.com");
  });

  it("keeps automatic under_review out of the email module and the review opener", () => {
    const emails = readFileSync(path.join(ROOT, "lib/notifications/applicationEmails.ts"), "utf8");
    const opener = readFileSync(path.join(ROOT, "lib/admin/coachApplicationReview.ts"), "utf8");
    expect(emails).toContain(
      'type AppStatus = "submitted" | "changes_requested" | "approved" | "declined"'
    );
    expect(emails).not.toMatch(/status:\s*"under_review"/);
    expect(opener).not.toContain("applicationEmails");
    expect(opener).not.toContain("sendCoachApplicationStatusEmail");
  });

  it("supports disabling test copies and prefers the generic variable", () => {
    vi.stubEnv("REGISTRATION_TEST_COPY_EMAILS", "");
    expect(registrationCopies("owner@example.com")).toEqual([]);
    vi.stubEnv("EMAIL_TEST_COPY_EMAILS", "");
    vi.stubEnv("REGISTRATION_TEST_COPY_EMAILS", "legacy@example.com");
    expect(emailTestCopies("owner@example.com", { includeLegacyRegistration: true })).toEqual([]);
    expect(emailTestCopies("owner@example.com")).toEqual([]);
  });

  it("falls back to the registration list only when the generic variable is unset", () => {
    delete process.env.EMAIL_TEST_COPY_EMAILS;
    vi.stubEnv("REGISTRATION_TEST_COPY_EMAILS", "legacy@example.com");
    expect(emailTestCopies("owner@example.com")).toEqual([]);
    expect(emailTestCopies("owner@example.com", { includeLegacyRegistration: true })).toEqual([
      "legacy@example.com",
    ]);
  });

  it("escapes content, omits an empty note, and can omit the button", () => {
    const html = brandedEmailTemplate({
      title: "<test>",
      paragraphs: ["a & b"],
      note: "   ",
      details: [{ label: "Coach", value: "Juan <Martin>" }],
      actionLabel: "Continue",
      actionUrl: 'https://example.com/?x="test"',
      origin: "https://example.com",
    });
    expect(html).toContain("/brand/padelpathways-logo-email.png");
    expect(html).toContain("max-width:600px");
    expect(html).toContain("#031322");
    expect(html).toContain("#d2eb26");
    expect(html).toContain("&lt;test&gt;");
    expect(html).toContain("a &amp; b");
    expect(html).toContain("Juan &lt;Martin&gt;");
    expect(html).toContain("?x=&quot;test&quot;");
    expect(html).not.toContain("A note from our team");

    const withoutAction = brandedEmailTemplate({
      title: "Hello",
      paragraphs: ["Just a note."],
      origin: "https://example.com",
    });
    expect(withoutAction).not.toContain("&rarr;");
  });
});
