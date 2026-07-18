"use server";

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import {
  validateCoachApplicationPayload,
  type CoachApplicationSubmitPayload,
} from "@/lib/coachApplication";

export type SubmitCoachApplicationResult = { ok: true } | { ok: false; message: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeText(s: string | null | undefined): string {
  return escapeHtml((s ?? "").trim() || "—");
}

function safeJoined(arr: string[]): string {
  if (!arr.length) return "—";
  return arr.map((x) => escapeHtml(x)).join(", ");
}

function buildCoachApplicationTeamHtml(payload: CoachApplicationSubmitPayload): string {
  return `
    <h2>New Coach Application</h2>
    <p><strong>Business:</strong> ${safeText(payload.business_name)}</p>
    <p><strong>Contact:</strong> ${safeText(payload.contact_name)}</p>
    <p><strong>Email:</strong> ${safeText(payload.email)}</p>
    <p><strong>Phone:</strong> ${safeText(payload.phone)}</p>
    <p><strong>Location:</strong> ${safeText(payload.based_in)}</p>
    <p><strong>Services:</strong> ${safeJoined(payload.services_offered)}</p>
    <p><strong>Player Levels:</strong> ${safeJoined(payload.player_levels)}</p>
    <p><strong>Price Range:</strong> ${safeText(payload.price_range_per_week)}</p>
    <p><strong>Main Goal:</strong> ${safeText(payload.main_goal)}</p>
  `;
}

function buildCoachApplicationUserHtml(payload: CoachApplicationSubmitPayload): string {
  const first = payload.contact_name.trim().split(/\s+/)[0] || "there";
  const firstName = escapeHtml(first);
  return `
    <p>Hi ${firstName},</p>
    <p>Thanks — we&apos;ve received your application to join Padel Pathways.</p>
    <p>We&apos;ll review your details and get back to you shortly.</p>
    <p style="margin-top:1.5rem;color:#555;font-size:14px;">— Padel Pathways</p>
  `;
}

export async function submitCoachApplication(
  payload: CoachApplicationSubmitPayload
): Promise<SubmitCoachApplicationResult> {
  const err = validateCoachApplicationPayload(payload);
  if (err) return { ok: false, message: err };

  const supabase = await createClient();
  const row = {
    service_type: payload.service_type,
    business_name: payload.business_name,
    contact_name: payload.contact_name,
    email: payload.email,
    phone: payload.phone,
    based_in: payload.based_in,
    operates_multiple_locations: payload.operates_multiple_locations,
    additional_locations: payload.additional_locations,
    services_offered: payload.services_offered,
    offering_description: payload.offering_description,
    player_levels: payload.player_levels,
    player_types_specialty: payload.player_types_specialty,
    price_range_per_week: payload.price_range_per_week,
    accommodation_offered: payload.accommodation_offered,
    full_packages_offered: payload.full_packages_offered,
    availability_type: payload.availability_type,
    seasonal_availability_detail: payload.seasonal_availability_detail,
    capacity_per_week: payload.capacity_per_week,
    website_url: payload.website_url,
    social_media_links: payload.social_media_links,
    media_attachments: payload.media_attachments,
    achievements: payload.achievements,
    special_offer_promoted: payload.special_offer_promoted,
    special_offer_description: payload.special_offer_description,
    lead_delivery_preference: payload.lead_delivery_preference,
    paid_leads_openness: payload.paid_leads_openness,
    main_goal: payload.main_goal,
    raw_payload: payload as unknown as Record<string, unknown>,
  };

  const { error } = await supabase.from("coach_applications").insert(row);
  if (error) {
    console.error("coach_applications insert", error);
    return {
      ok: false,
      message: "We couldn’t submit your application. Please try again in a moment.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.ENQUIRY_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Padel Pathways <matthew@progressbydesign.co.uk>";
  const notifyTo = process.env.ENQUIRY_NOTIFY_EMAIL?.trim();

  const teamHtml = buildCoachApplicationTeamHtml(payload);
  const userHtml = buildCoachApplicationUserHtml(payload);

  if (!apiKey) {
    console.warn(
      "[coach application] RESEND_API_KEY is missing — application saved but no emails were sent."
    );
    return { ok: true };
  }

  const resend = new Resend(apiKey);

  if (notifyTo) {
    try {
      const teamResult = await resend.emails.send({
        from,
        to: notifyTo,
        subject: "New coach application — Padel Pathways",
        html: teamHtml,
      });
      if (teamResult.error) {
        console.error(
          "[coach application] team notify email failed:",
          teamResult.error.name,
          teamResult.error.message,
          teamResult.error.statusCode != null ? `(status ${teamResult.error.statusCode})` : ""
        );
      }
    } catch (e) {
      console.error("[coach application] team notify email exception", e);
    }
  } else {
    console.warn(
      "[coach application] ENQUIRY_NOTIFY_EMAIL is not set — skipping team notification email."
    );
  }

  try {
    const userResult = await resend.emails.send({
      from,
      to: payload.email.trim(),
      subject: "Your Padel Pathways application",
      html: userHtml,
    });
    if (userResult.error) {
      console.error(
        "[coach application] applicant confirmation email failed:",
        userResult.error.name,
        userResult.error.message,
        userResult.error.statusCode != null ? `(status ${userResult.error.statusCode})` : ""
      );
    }
  } catch (e) {
    console.error("[coach application] applicant confirmation email exception", e);
  }

  return { ok: true };
}
