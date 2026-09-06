import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookingRequestForm from "@/components/bookings/BookingRequestForm";
import { requireAuthenticatedAccount } from "@/lib/auth/session";
import { validateBookableSlot } from "@/lib/queries/coachBookings";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Request a coaching session",
  description: "Send a booking request for a coaching session.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
  searchParams: Promise<{ relationship?: string; start?: string }>;
};

export default async function BookCoachSessionPage({
  params,
  searchParams,
}: PageProps) {
  const { coachId } = await params;
  const query = await searchParams;

  if (!isValidCoachId(coachId)) notFound();

  const relationshipId = query.relationship?.trim() ?? "";
  const startsAt = query.start?.trim() ?? "";
  const nextPath = `/book/coach/${encodeURIComponent(coachId)}?${new URLSearchParams(
    {
      relationship: relationshipId,
      start: startsAt,
    }
  ).toString()}`;

  const account = await requireAuthenticatedAccount(nextPath);

  if (!relationshipId || !startsAt) {
    return (
      <UnavailableSlot
        coachId={coachId}
        title="Choose a session time"
        body="Select an available time from the coach or venue page to continue."
      />
    );
  }

  const slot = await validateBookableSlot({
    coachId,
    relationshipId,
    startsAt,
  });

  if (!slot) {
    return (
      <UnavailableSlot
        coachId={coachId}
        title="This time is no longer available"
        body="That session may have been taken, removed from the schedule, or is no longer public."
      />
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", account.id)
    .maybeSingle();

  const defaultName = profile?.full_name?.trim() || "";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <BookingRequestForm
        slot={slot}
        defaultName={defaultName}
        accountEmail={account.email}
      />
    </div>
  );
}

function UnavailableSlot({
  coachId,
  title,
  body,
}: {
  coachId: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="rounded-[24px] border border-primary/10 bg-white p-6 sm:p-8">
        <h1 className="text-2xl text-primary">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-primary/65">{body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/coach/${encodeURIComponent(coachId)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
          >
            View other times
          </Link>
          <Link
            href={`/coach/${encodeURIComponent(coachId)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary/70"
          >
            Return to coach profile
          </Link>
        </div>
      </section>
    </div>
  );
}
