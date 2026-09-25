import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./productEmail", async importOriginal => ({ ...await importOriginal<typeof import("./productEmail")>(), sendProductEmail: send }));
import { sendCoachApplicationStatusEmail, sendVenueApplicationStatusEmail } from "./applicationEmails";
import { registrationTemplate, registrationCopies } from "./registrationTemplate";

describe("application email journey", () => {
  beforeEach(() => {
    send.mockClear();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
    vi.stubEnv("APPLICATION_NOTIFY_EMAIL", "admin@example.com");
    vi.stubEnv("REGISTRATION_TEST_COPY_EMAILS", "tester@example.com,admin@example.com,tester@example.com");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("sends submission receipt and authenticated review link without approving", async () => {
    await sendCoachApplicationStatusEmail({ to: "player@example.com", status: "submitted", mode: "create_new", applicationId: "app-123", coachName: "Coach Test" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toMatchObject({ from: "Padel Pathways <hello@padelpathways.com>", to: "player@example.com", bcc: ["tester@example.com", "admin@example.com"] });
    expect(send.mock.calls[1][0].html).toContain('https://example.com/admin/applications/coaches/app-123#decision');
    expect(send.mock.calls[1][0].bcc).toEqual(["tester@example.com"]);
  });
  it("escapes review feedback and routes approvals to the dashboard", async () => {
    await sendCoachApplicationStatusEmail({ to: "player@example.com", status: "approved", mode: "create_new", note: '<script>alert("bad")</script>' });
    const html = send.mock.calls[0][0].html;
    expect(html).toContain("profile is now published");
    expect(html).toContain('href="https://example.com/account"');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("does not claim venue publication after approval", async () => {
    await sendVenueApplicationStatusEmail({ to: "owner@example.com", status: "approved", mode: "create_new" });
    expect(send.mock.calls[0][0].html).not.toContain("now published");
  });
  it("supports disabling test copies", () => {
    vi.stubEnv("REGISTRATION_TEST_COPY_EMAILS", "");
    expect(registrationCopies("owner@example.com")).toEqual([]);
  });
  it("includes a logo and escapes text and link attributes", () => {
    const html = registrationTemplate({ title: "<test>", paragraphs: ["a & b"], actionLabel: "Continue", actionUrl: 'https://example.com/?x="test"', origin: "https://example.com" });
    expect(html).toContain("/brand/padelpathways-logo-email.png");
    expect(html).toContain("&lt;test&gt;");
    expect(html).toContain("a &amp; b");
    expect(html).toContain("?x=&quot;test&quot;");
  });
});
