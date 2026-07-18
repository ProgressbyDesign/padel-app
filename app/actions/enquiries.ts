"use server";

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildTeamEnquiryEmailHtml, buildUserConfirmationEmailHtml } from "@/lib/enquiryEmail";
import {
  pickPrimaryVenueFromCoachRow,
  venueLocationLabels,
} from "@/lib/coachVenueGeo";
import { validateEnquiryPayload, type EnquirySubmitPayload } from "@/lib/enquiryPayload";

export type SubmitEnquiryResult = { ok: true } | { ok: false; message: string };

function buildEnquirySourceUrl(
  subjectType: "coach" | "venue" | null,
  subjectSlug: string | null,
  coachId: string | null,
  venueId: string | null
): string | null {
  const baseRaw = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!subjectType) return null;
  const pathSegment = (subjectSlug?.trim() || coachId || venueId)?.trim();
  if (!pathSegment) return null;
  const path = `${subjectType}/${encodeURIComponent(pathSegment)}`;
  if (baseRaw) return `${baseRaw}/${path}`;
  return `/${path}`;
}

export async function submitEnquiry(payload: EnquirySubmitPayload): Promise<SubmitEnquiryResult> {
  const err = validateEnquiryPayload(payload);
  if (err) return { ok: false, message: err };

  const supabase = await createClient();
  const coachId = payload.coachId?.trim() || null;
  const venueId = payload.venueId?.trim() || null;

  let subjectType: "coach" | "venue" | null = null;
  let subjectName: string | null = null;
  let subjectSlug: string | null = null;
  let subjectLocation: string | null = null;

  if (coachId) {
    const { data: coach, error: coachFetchError } = await supabase
      .from("coaches")
      .select(
        `
        name,
        slug,
        coach_venues (
          is_primary,
          venues (
            city,
            country
          )
        )
      `
      )
      .eq("id", coachId)
      .maybeSingle();

    if (coachFetchError) {
      console.warn("[enquiry] coach lookup failed (using id fallback in email):", coachFetchError.message);
    }

    subjectType = "coach";
    subjectName = coach?.name?.trim() ?? null;
    subjectSlug = coach?.slug?.trim() ?? null;
    const primaryVenue = coach ? pickPrimaryVenueFromCoachRow(coach) : null;
    const loc = venueLocationLabels(primaryVenue);
    subjectLocation = loc.full || null;
  } else if (venueId) {
    const { data: venue, error: venueFetchError } = await supabase
      .from("venues")
      .select("name, city, country")
      .eq("id", venueId)
      .maybeSingle();

    if (venueFetchError) {
      console.warn("[enquiry] venue lookup failed (using id fallback in email):", venueFetchError.message);
    }

    subjectType = "venue";
    subjectName = venue?.name?.trim() ?? null;
    subjectSlug = null;
    subjectLocation =
      [venue?.city, venue?.country]
        .filter((x): x is string => Boolean(x && String(x).trim()))
        .join(", ") || null;
  }

  const sourceUrl = buildEnquirySourceUrl(subjectType, subjectSlug, coachId, venueId);

  const startDate = payload.preferred_start_date?.trim() || null;

  const row = {
    coach_id: coachId,
    venue_id: venueId,
    subject_type: subjectType,
    subject_name: subjectName,
    subject_slug: subjectSlug,
    source_url: sourceUrl,
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

  const teamEmailPayload = {
    ...payload,
    subject_name: subjectName,
    subject_type: subjectType,
    subject_location: subjectLocation,
    source_url: sourceUrl,
  };

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.ENQUIRY_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Padel Pathways <matthew@progressbydesign.co.uk>";
  const notifyTo = process.env.ENQUIRY_NOTIFY_EMAIL?.trim();

  if (!apiKey) {
    console.warn(
      "[enquiry] RESEND_API_KEY is missing — enquiry saved but no emails were sent."
    );
    return { ok: true };
  }

  const resend = new Resend(apiKey);

  if (notifyTo) {
    try {
      const teamResult = await resend.emails.send({
        from,
        to: notifyTo,
        subject: "New enquiry — Padel Pathways",
        html: buildTeamEnquiryEmailHtml(teamEmailPayload),
      });
      if (teamResult.error) {
        console.error(
          "[enquiry] team notify email failed:",
          teamResult.error.name,
          teamResult.error.message,
          teamResult.error.statusCode != null ? `(status ${teamResult.error.statusCode})` : ""
        );
      }
    } catch (e) {
      console.error("[enquiry] team notify email exception", e);
    }
  } else {
    console.warn("[enquiry] ENQUIRY_NOTIFY_EMAIL is not set — skipping team notification email.");
  }

  try {
    const userResult = await resend.emails.send({
      from,
      to: payload.email.trim(),
      subject: "We received your enquiry",
      html: buildUserConfirmationEmailHtml(payload),
    });
    if (userResult.error) {
      console.error(
        "[enquiry] user confirmation email failed:",
        userResult.error.name,
        userResult.error.message,
        userResult.error.statusCode != null ? `(status ${userResult.error.statusCode})` : ""
      );
    }
  } catch (e) {
    console.error("[enquiry] user confirmation email exception", e);
  }

  return { ok: true };
}
