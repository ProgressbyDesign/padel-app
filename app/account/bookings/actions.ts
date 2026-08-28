"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccount } from "@/lib/auth/adminSession";
import { hasAdminPermission } from "@/lib/admin/permissions";
import {
  BOOKING_ERROR_COPY,
  bookingMutationErrorMessage,
} from "@/lib/coachBookings/errors";
import {
  buildBookingAcceptedPlayerEmailHtml,
  buildBookingCancelledEmailHtml,
  buildBookingDeclinedPlayerEmailHtml,
  buildBookingRequestCoachEmailHtml,
  buildBookingRequestPlayerEmailHtml,
  sendBookingEmail,
} from "@/lib/coachBookings/email";
import {
  isPlayerLevel,
  type PlayerLevel,
} from "@/lib/coachBookings/constants";
import type { BookingActionResult } from "@/lib/coachBookings/types";
import {
  hasAcceptedCompetitor,
  loadBookingById,
  validateBookableSlot,
} from "@/lib/queries/coachBookings";
import { resolveCoachNotificationEmail } from "@/lib/notifications/resolveRecipientEmail";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";

async function requireClaimsUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;
  return userId;
}

async function requireCoachMemberOrAdmin(coachId: string): Promise<string | null> {
  if (!isValidCoachId(coachId)) return null;
  const userId = await requireClaimsUserId();
  if (!userId) return null;

  const admin = await getAdminAccount();
  if (admin) {
    if (!hasAdminPermission(admin, "bookings.manage")) return null;
    return userId;
  }

  const supabase = await createClient();
  const { data: membership, error } = await supabase
    .from("coach_memberships")
    .select("coach_id")
    .eq("coach_id", coachId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !membership) return null;
  return userId;
}

function revalidateBookingPaths(input: {
  bookingId: string;
  coachId: string;
  venueId: string;
  relationshipId: string;
}) {
  revalidatePath("/account");
  revalidatePath("/account/bookings");
  revalidatePath(`/account/bookings/${input.bookingId}`);
  revalidatePath(`/account/coaches/${input.coachId}`);
  revalidatePath(`/account/coaches/${input.coachId}/bookings`);
  revalidatePath(`/account/coaches/${input.coachId}/availability`);
  revalidatePath(
    `/account/coaches/${input.coachId}/availability/${input.relationshipId}`
  );
  revalidatePath(`/account/venues/${input.venueId}`);
  revalidatePath(`/account/venues/${input.venueId}/schedule`);
  revalidatePath(`/account/venues/${input.venueId}/sessions`);
  revalidatePath(`/account/venues/${input.venueId}/coaches`);
  revalidatePath(
    `/account/venues/${input.venueId}/coaches/${input.coachId}/availability`
  );
  revalidatePath(`/coach/${input.coachId}`);
  revalidatePath(`/venue/${input.venueId}`);
  revalidatePath("/admin/bookings");
}

export async function createCoachBookingRequest(input: {
  coachId: string;
  relationshipId: string;
  startsAt: string;
  endsAt: string;
  requesterName: string;
  requesterPhone: string;
  playerLevel: string;
  message: string;
  paymentAcknowledged: boolean;
}): Promise<BookingActionResult> {
  const userId = await requireClaimsUserId();
  if (!userId) return { ok: false, message: BOOKING_ERROR_COPY.AUTH };

  if (!input.paymentAcknowledged) {
    return {
      ok: false,
      message: "Please confirm that payment is arranged directly with the coach.",
    };
  }

  const slot = await validateBookableSlot({
    coachId: input.coachId,
    relationshipId: input.relationshipId,
    startsAt: input.startsAt,
  });
  if (!slot || slot.endsAt !== input.endsAt) {
    return { ok: false, message: BOOKING_ERROR_COPY.STALE_SLOT };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const accountEmail =
    typeof claimsData?.claims?.email === "string"
      ? claimsData.claims.email.trim()
      : "";
  if (!accountEmail || accountEmail.length < 5) {
    return {
      ok: false,
      message: "Your account email is required to send a booking request.",
    };
  }

  const name = input.requesterName.trim();
  if (name.length < 2 || name.length > 120) {
    return { ok: false, message: "Enter your name (2–120 characters)." };
  }

  const phone = input.requesterPhone.trim();
  if (phone && (phone.length < 5 || phone.length > 40)) {
    return { ok: false, message: "Phone must be between 5 and 40 characters." };
  }

  let playerLevel: PlayerLevel | null = null;
  if (input.playerLevel.trim()) {
    if (!isPlayerLevel(input.playerLevel.trim())) {
      return { ok: false, message: "Choose a valid player level." };
    }
    playerLevel = input.playerLevel.trim() as PlayerLevel;
  }

  const message = input.message.trim();
  if (message.length > 1000) {
    return { ok: false, message: "Message must be 1000 characters or fewer." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("coach_booking_requests")
    .insert({
      coach_venue_id: input.relationshipId,
      requester_user_id: userId,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      requester_name: name || profile?.full_name || "Player",
      requester_email: accountEmail,
      requester_phone: phone || null,
      player_level: playerLevel,
      message: message || null,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { ok: false, message: bookingMutationErrorMessage(error) };
  }

  const booking = await loadBookingById(String(created.id));
  if (booking) {
    void sendBookingEmail({
      to: accountEmail,
      subject: "Your coaching session request was sent",
      html: buildBookingRequestPlayerEmailHtml(booking),
    });
    const coachEmail =
      booking.coach?.email?.trim() ||
      (await resolveCoachNotificationEmail(booking.coach_id));
    if (coachEmail) {
      void sendBookingEmail({
        to: coachEmail,
        subject: "New coaching session request",
        html: buildBookingRequestCoachEmailHtml(booking),
      });
    }
  }

  revalidateBookingPaths({
    bookingId: String(created.id),
    coachId: slot.coachId,
    venueId: slot.venueId,
    relationshipId: slot.relationshipId,
  });

  return {
    ok: true,
    message: "Request sent.",
    bookingId: String(created.id),
  };
}

async function mutateBookingStatus(input: {
  bookingId: string;
  status: "accepted" | "declined" | "cancelled" | "completed";
  as: "coach" | "player" | "admin";
}): Promise<BookingActionResult> {
  const booking = await loadBookingById(input.bookingId);
  if (!booking) return { ok: false, message: "Booking not found." };

  let userId: string | null = null;
  if (input.as === "player") {
    userId = await requireClaimsUserId();
    if (!userId || userId !== booking.requester_user_id) {
      return { ok: false, message: "You do not have access to this booking." };
    }
    if (input.status !== "cancelled") {
      return { ok: false, message: BOOKING_ERROR_COPY.HISTORICAL };
    }
    if (booking.status !== "requested" && booking.status !== "accepted") {
      return { ok: false, message: BOOKING_ERROR_COPY.HISTORICAL };
    }
  } else {
    userId = await requireCoachMemberOrAdmin(booking.coach_id);
    if (!userId) {
      return { ok: false, message: "You do not have access to this coach." };
    }
  }

  if (input.status === "accepted" || input.status === "declined") {
    if (booking.status !== "requested") {
      return { ok: false, message: BOOKING_ERROR_COPY.HISTORICAL };
    }
  }
  if (input.status === "cancelled") {
    if (booking.status !== "requested" && booking.status !== "accepted") {
      return { ok: false, message: BOOKING_ERROR_COPY.HISTORICAL };
    }
  }
  if (input.status === "completed") {
    if (booking.status !== "accepted") {
      return { ok: false, message: BOOKING_ERROR_COPY.HISTORICAL };
    }
    if (new Date(booking.ends_at).getTime() > Date.now()) {
      return {
        ok: false,
        message: "You can mark a session complete only after it has ended.",
      };
    }
  }

  if (input.status === "accepted") {
    const competitor = await hasAcceptedCompetitor(
      booking.coach_id,
      booking.starts_at,
      booking.ends_at,
      booking.id
    );
    if (competitor) {
      return { ok: false, message: BOOKING_ERROR_COPY.OVERLAP_ACCEPT };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_booking_requests")
    .update({ status: input.status })
    .eq("id", input.bookingId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: bookingMutationErrorMessage(
        error,
        input.status === "accepted"
          ? BOOKING_ERROR_COPY.STALE_ACCEPT
          : BOOKING_ERROR_COPY.HISTORICAL
      ),
    };
  }

  const updated = await loadBookingById(input.bookingId);
  if (updated) {
    if (input.status === "accepted") {
      void sendBookingEmail({
        to: updated.requester_email,
        subject: "Your coaching session request was accepted",
        html: buildBookingAcceptedPlayerEmailHtml(updated),
      });
    } else if (input.status === "declined") {
      void sendBookingEmail({
        to: updated.requester_email,
        subject: "Your coaching session request was declined",
        html: buildBookingDeclinedPlayerEmailHtml(updated),
      });
    } else if (input.status === "cancelled") {
      void sendBookingEmail({
        to: updated.requester_email,
        subject: "Coaching session cancelled",
        html: buildBookingCancelledEmailHtml(updated, "player"),
      });
      const coachEmail =
        updated.coach?.email?.trim() ||
        (input.as === "player"
          ? await resolveCoachNotificationEmail(updated.coach_id)
          : null);
      if (coachEmail && input.as === "player") {
        void sendBookingEmail({
          to: coachEmail,
          subject: "A player cancelled a coaching session",
          html: buildBookingCancelledEmailHtml(updated, "coach"),
        });
      }
    }
  }

  revalidateBookingPaths({
    bookingId: booking.id,
    coachId: booking.coach_id,
    venueId: booking.venue_id,
    relationshipId: booking.coach_venue_id,
  });

  const messages = {
    accepted: "Request accepted.",
    declined: "Request declined.",
    cancelled: "Booking cancelled.",
    completed: "Session marked complete.",
  } as const;

  return { ok: true, message: messages[input.status], bookingId: booking.id };
}

export async function acceptCoachBookingRequest(
  bookingId: string
): Promise<BookingActionResult> {
  return mutateBookingStatus({ bookingId, status: "accepted", as: "coach" });
}

export async function declineCoachBookingRequest(
  bookingId: string
): Promise<BookingActionResult> {
  return mutateBookingStatus({ bookingId, status: "declined", as: "coach" });
}

export async function cancelCoachBookingRequest(
  bookingId: string
): Promise<BookingActionResult> {
  return mutateBookingStatus({ bookingId, status: "cancelled", as: "coach" });
}

export async function completeCoachBookingRequest(
  bookingId: string
): Promise<BookingActionResult> {
  return mutateBookingStatus({ bookingId, status: "completed", as: "coach" });
}

export async function cancelPlayerBookingRequest(
  bookingId: string
): Promise<BookingActionResult> {
  return mutateBookingStatus({ bookingId, status: "cancelled", as: "player" });
}
