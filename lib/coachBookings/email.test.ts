import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAYMENT_COPY } from "@/lib/coachBookings/constants";
import type { CoachBookingRequest } from "@/lib/coachBookings/types";
import {
  buildBookingAcceptedPlayerEmailHtml,
  buildBookingCancelledEmailHtml,
  buildBookingDeclinedPlayerEmailHtml,
  buildBookingRequestCoachEmailHtml,
  buildBookingRequestPlayerEmailHtml,
  sendBookingEmail,
} from "@/lib/coachBookings/email";

const send = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/notifications/productEmail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications/productEmail")>()),
  sendProductEmail: send,
}));

const booking: CoachBookingRequest = {
  id: "booking-1",
  coach_venue_id: "rel-1",
  coach_id: "coach-1",
  venue_id: "venue-1",
  requester_user_id: "player-1",
  status: "requested",
  starts_at: "2026-10-04T09:00:00.000Z",
  ends_at: "2026-10-04T10:00:00.000Z",
  timezone: "Europe/Madrid",
  requester_name: "Juan <Martin>",
  requester_email: "juan@example.com",
  requester_phone: "+34 600 000 000",
  player_level: "intermediate",
  message: "Line one\n<script>alert(1)</script>",
  price_amount_minor: null,
  currency: null,
  pricing_source: null,
  responded_at: null,
  cancelled_at: null,
  completed_at: null,
  created_at: "2026-09-28T08:00:00.000Z",
  updated_at: "2026-09-28T08:00:00.000Z",
  coach: {
    id: "coach-1",
    name: "Coach Ana",
    role: null,
    image_url: null,
    price_from: null,
    email: "coach@example.com",
    phone: null,
  },
  venue: {
    id: "venue-1",
    name: "Marbella Padel Club",
    city: "Marbella",
    country: "Spain",
  },
};

describe("branded booking emails", () => {
  beforeEach(() => {
    send.mockClear();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
    vi.stubEnv("EMAIL_TEST_COPY_EMAILS", "");
    vi.stubEnv("REGISTRATION_TEST_COPY_EMAILS", "legacy@example.com");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("tells the player the request is waiting and keeps payment copy", () => {
    const html = buildBookingRequestPlayerEmailHtml(booking);
    expect(html).toContain("Coaching request sent");
    expect(html).toContain("waiting for the coach");
    expect(html).toContain("Coach Ana");
    expect(html).toContain("Marbella Padel Club");
    expect(html).toContain("Europe/Madrid");
    expect(html).toContain(PAYMENT_COPY);
    expect(html).toContain("https://example.com/account/bookings/booking-1");
    expect(html).toContain("#031322");
    expect(html).not.toContain("legacy@example.com");
  });

  it("shows the coach the player details already available on the request", () => {
    const html = buildBookingRequestCoachEmailHtml(booking);
    expect(html).toContain("New coaching session request");
    expect(html).toContain("juan@example.com");
    expect(html).toContain("+34 600 000 000");
    expect(html).toContain("Juan &lt;Martin&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("white-space:pre-line");
    expect(html).toContain("https://example.com/account/coaches/coach-1/bookings");
    expect(html).toContain(PAYMENT_COPY);
  });

  it("accepts, declines and cancels with the right audience", () => {
    expect(buildBookingAcceptedPlayerEmailHtml(booking)).toContain(
      "does not take payment"
    );
    expect(buildBookingAcceptedPlayerEmailHtml(booking)).toContain(PAYMENT_COPY);
    const declined = buildBookingDeclinedPlayerEmailHtml(booking);
    expect(declined).toContain("wasn't available this time");
    expect(declined).toContain("https://example.com/coach/coach-1");
    expect(declined).not.toContain(PAYMENT_COPY);
    expect(buildBookingCancelledEmailHtml(booking, "coach", "player")).toContain(
      "The player cancelled"
    );
    expect(buildBookingCancelledEmailHtml(booking, "player", "coach")).toContain(
      "was cancelled"
    );
    expect(buildBookingCancelledEmailHtml(booking, "player", "coach")).not.toContain(
      "You cancelled"
    );
  });

  it("sends through the shared product email helper", async () => {
    await sendBookingEmail({
      to: "player@example.com",
      subject: "Coaching request sent",
      html: "<p>Ready</p>",
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "player@example.com",
        from: "Padel Pathways <hello@padelpathways.com>",
        replyTo: "hello@padelpathways.com",
        bcc: [],
        logLabel: "booking-email",
      })
    );
  });

  it("does not send when the app origin is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    await sendBookingEmail({
      to: "player@example.com",
      subject: "Coaching request sent",
      html: "<p>Ready</p>",
    });
    expect(send).not.toHaveBeenCalled();
  });
});
