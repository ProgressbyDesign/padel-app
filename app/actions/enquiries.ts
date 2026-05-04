"use server";

import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { buildTeamEnquiryEmailHtml, buildUserConfirmationEmailHtml } from "@/lib/enquiryEmail";
import { validateEnquiryPayload, type EnquirySubmitPayload } from "@/lib/enquiryPayload";

export type SubmitEnquiryResult = { ok: true } | { ok: false; message: string };

export async function submitEnquiry(payload: EnquirySubmitPayload): Promise<SubmitEnquiryResult> {
  console.log("🚀 submitEnquiry CALLED");
  const err = validateEnquiryPayload(payload);
  if (err) return { ok: false, message: err };

  const coachId = payload.coachId?.trim() || null;
  const venueId = payload.venueId?.trim() || null;

  const startDate = payload.preferred_start_date?.trim() || null;

  const row = {
    coach_id: coachId,
    venue_id: venueId,
    full_name: payload.full_name.trim(),
    email: payload.email.trim(),
    phone: payload.phone?.trim() || null,
    age: payload.age,
    nationality: payload.nationality?.trim() || null,
    current_location_country: payload.current_location_country?.trim() || null,
    current_location_city: payload.current_location_city?.trim() || null,
    playing_level: payload.playing_level?.trim() || null,
    playing_duration: payload.playing_duration?.trim() || null,
    main_goals: payload.main_goals.length ? payload.main_goals : null,
    goals_detail: payload.goals_detail?.trim() || null,
    preferred_destinations: payload.preferred_destinations.length ? payload.preferred_destinations : null,
    preferred_duration: payload.preferred_duration?.trim() || null,
    preferred_start_date: startDate,
    training_type: payload.training_type?.trim() || null,
    budget_range: payload.budget_range?.trim() || null,
    accommodation: payload.accommodation?.trim() || null,
    trained_abroad: payload.trained_abroad?.trim() || null,
    injuries: payload.injuries?.trim() || null,
    anything_else: payload.anything_else?.trim() || null,
    wants_personalised_recommendation: Boolean(payload.wants_personalised_recommendation),
  };

  const { error } = await supabase.from("enquiries").insert(row);
  if (error) {
    console.error("enquiries insert", error);
    console.error("Supabase error:", error.message, error.details);
    return {
      ok: false,
      message: "We couldn’t send your enquiry. Please try again in a moment.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.ENQUIRY_FROM_EMAIL ??
    process.env.RESEND_FROM_EMAIL ??
    "Padel Pathways <matthew@progressbydesign.co.uk>";
  const notifyTo = process.env.ENQUIRY_NOTIFY_EMAIL?.trim();

  if (apiKey) {
    const resend = new Resend(apiKey);
    if (notifyTo) {
      try {
        await resend.emails.send({
          from,
          to: notifyTo,
          subject: "New enquiry — Padel Pathways",
          html: buildTeamEnquiryEmailHtml(payload),
        });
      } catch (e) {
        console.error("enquiry team email", e);
      }
    }
    try {
      await resend.emails.send({
        from,
        to: payload.email.trim(),
        subject: "We received your enquiry",
        html: buildUserConfirmationEmailHtml(payload),
      });
    } catch (e) {
      console.error("enquiry user confirmation email", e);
    }
  }

  return { ok: true };
}
