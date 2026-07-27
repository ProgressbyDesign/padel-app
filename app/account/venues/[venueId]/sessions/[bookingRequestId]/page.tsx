import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  durationMinutesFromBlock,
  venueBlockStatusLabel,
} from "@/lib/venueOperations/blocks";
import { bookedSessionPriceCaption } from "@/lib/venueOperations/pricingDisplay";
import { formatInTimeZone, ymdInTimeZone } from "@/lib/coachAvailability/timezone";
import { loadManagedVenueShell } from "@/lib/queries/managedVenueShell";
import { loadVenueBookingBlockDetail } from "@/lib/queries/venueBookingBlocks";

export const metadata: Metadata = {
  title: "Session details",
  description: "Venue-safe booking block details.",
};

type PageProps = {
  params: Promise<{ venueId: string; bookingRequestId: string }>;
};

export default async function ManagedVenueSessionDetailPage({
  params,
}: PageProps) {
  const { venueId, bookingRequestId } = await params;
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) notFound();

  const block = await loadVenueBookingBlockDetail(venueId, bookingRequestId);
  if (!block) notFound();

  const base = `/account/venues/${encodeURIComponent(venueId)}`;
  const duration = durationMinutesFromBlock(block);
  const dayYmd = ymdInTimeZone(block.starts_at, block.timezone);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary/45">
          <Link href={`${base}/sessions`} className="hover:text-primary">
            Sessions
          </Link>
          <span aria-hidden> / </span>
          Details
        </p>
        <h2 className="mt-2 text-2xl font-bold text-primary">
          {formatInTimeZone(block.starts_at, block.timezone, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h2>
        <p className="mt-1 text-sm text-primary/60">
          {formatInTimeZone(block.starts_at, block.timezone, {
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          })}
          –
          {formatInTimeZone(block.ends_at, block.timezone, {
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          })}{" "}
          · {block.timezone}
        </p>
      </div>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Coach
            </dt>
            <dd className="mt-1 font-semibold text-primary">
              <Link
                href={`/coach/${encodeURIComponent(block.coach_id)}`}
                className="hover:underline"
              >
                {block.coach_name}
              </Link>
              {block.coach_role ? (
                <span className="font-normal text-primary/55">
                  {" "}
                  · {block.coach_role}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Status
            </dt>
            <dd className="mt-1 font-semibold text-primary">
              {venueBlockStatusLabel(block.status)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Duration
            </dt>
            <dd className="mt-1 font-semibold text-primary">
              {duration > 0 ? `${duration} minutes` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Price
            </dt>
            <dd className="mt-1 font-semibold text-primary">
              {bookedSessionPriceCaption(
                block.price_amount_minor,
                block.currency
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Requested
            </dt>
            <dd className="mt-1 font-semibold text-primary">
              {formatInTimeZone(block.requested_at, block.timezone, {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Responded
            </dt>
            <dd className="mt-1 font-semibold text-primary">
              {block.responded_at
                ? formatInTimeZone(block.responded_at, block.timezone, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                  })
                : "—"}
            </dd>
          </div>
          {block.cancelled_at ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                Cancelled
              </dt>
              <dd className="mt-1 font-semibold text-primary">
                {formatInTimeZone(block.cancelled_at, block.timezone, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                })}
              </dd>
            </div>
          ) : null}
          {block.completed_at ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                Completed
              </dt>
              <dd className="mt-1 font-semibold text-primary">
                {formatInTimeZone(block.completed_at, block.timezone, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                })}
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-6 rounded-xl border border-primary/10 bg-surface/70 px-3 py-2.5 text-xs leading-5 text-primary/65">
          Player contact details are shared only with the coach managing the
          booking.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`${base}/schedule?coach=${encodeURIComponent(block.coach_id)}`}
            className="inline-flex min-h-10 items-center rounded-xl border border-primary/15 px-4 text-sm font-semibold text-primary hover:bg-surface"
          >
            View in schedule
            <span className="sr-only"> for {dayYmd}</span>
          </Link>
          <Link
            href={`/coach/${encodeURIComponent(block.coach_id)}`}
            className="inline-flex min-h-10 items-center rounded-xl border border-primary/15 px-4 text-sm font-semibold text-primary hover:bg-surface"
          >
            View coach profile
          </Link>
        </div>
      </section>
    </div>
  );
}
