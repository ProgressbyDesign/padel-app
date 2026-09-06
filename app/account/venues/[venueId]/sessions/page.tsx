import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  durationMinutesFromBlock,
  venueBlockStatusLabel,
} from "@/lib/venueOperations/blocks";
import { filterSessionsByTab } from "@/lib/venueOperations/counts";
import { bookedSessionPriceLine } from "@/lib/venueOperations/pricingDisplay";
import type { VenueSessionListFilter } from "@/lib/venueOperations/types";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";
import { loadManagedVenueShell } from "@/lib/queries/managedVenueShell";
import { loadVenueBookingBlocksWithCoaches } from "@/lib/queries/venueBookingBlocks";

export const metadata: Metadata = {
  title: "Venue sessions",
  description: "Venue-safe booking blocks for this venue.",
};

type PageProps = {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const TABS: Array<{ id: VenueSessionListFilter; label: string }> = [
  { id: "upcoming", label: "Upcoming" },
  { id: "awaiting", label: "Awaiting coach response" },
  { id: "confirmed", label: "Confirmed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "past", label: "Past" },
];

function parseTab(raw: string | undefined): VenueSessionListFilter {
  if (
    raw === "upcoming" ||
    raw === "awaiting" ||
    raw === "confirmed" ||
    raw === "cancelled" ||
    raw === "past"
  ) {
    return raw;
  }
  return "upcoming";
}

function emptyCopy(tab: VenueSessionListFilter): string {
  switch (tab) {
    case "awaiting":
      return "No booking requests are awaiting a coach response.";
    case "confirmed":
      return "No confirmed future sessions.";
    case "cancelled":
      return "No cancelled sessions.";
    case "past":
      return "No past sessions yet.";
    default:
      return "No upcoming sessions.";
  }
}

export default async function ManagedVenueSessionsPage({
  params,
  searchParams,
}: PageProps) {
  const { venueId } = await params;
  const { tab: tabRaw } = await searchParams;
  const tab = parseTab(tabRaw);
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) notFound();

  const blocks = await loadVenueBookingBlocksWithCoaches(venueId);
  const filtered = filterSessionsByTab(blocks, tab);
  const base = `/account/venues/${encodeURIComponent(venueId)}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl text-primary">Sessions</h2>
        <p className="mt-1 text-sm text-primary/60">
          Venue-safe booking activity. Player contact details stay with the
          coach managing each booking.
        </p>
      </div>

      <nav aria-label="Session filters">
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((item) => {
            const href =
              item.id === "upcoming"
                ? `${base}/sessions`
                : `${base}/sessions?tab=${item.id}`;
            const current = item.id === tab;
            return (
              <li key={item.id} className="shrink-0">
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-xl px-3.5 text-sm font-semibold transition ${
                    current
                      ? "bg-primary text-accent"
                      : "border border-primary/15 bg-white text-primary/70 hover:bg-surface hover:text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {filtered.length === 0 ? (
        <p className="rounded-[24px] border border-primary/10 bg-white px-4 py-10 text-center text-sm text-primary/55">
          {emptyCopy(tab)}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((block) => {
            const dateLabel = formatInTimeZone(block.starts_at, block.timezone, {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            const timeLabel = `${formatInTimeZone(block.starts_at, block.timezone, {
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            })}–${formatInTimeZone(block.ends_at, block.timezone, {
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            })}`;
            const duration = durationMinutesFromBlock(block);
            const scheduleHref = `${base}/schedule?coach=${encodeURIComponent(block.coach_id)}`;

            return (
              <li
                key={block.booking_request_id}
                className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-primary">
                      {dateLabel} · {timeLabel}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-primary/80">
                      {block.coach_name}
                      {block.coach_role ? (
                        <span className="font-normal text-primary/55">
                          {" "}
                          · {block.coach_role}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-primary/65">
                      {venueBlockStatusLabel(block.status)}
                    </p>
                    <dl className="mt-3 grid gap-1 text-sm text-primary/70 sm:grid-cols-2">
                      <div>
                        <dt className="inline text-primary/45">Duration: </dt>
                        <dd className="inline font-semibold text-primary">
                          {duration > 0 ? `${duration} min` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-primary/45">Price: </dt>
                        <dd className="inline font-semibold text-primary">
                          {bookedSessionPriceLine(
                            block.price_amount_minor,
                            block.currency
                          ).replace(/^Session price: /, "")}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-primary/45">Requested: </dt>
                        <dd className="inline font-semibold text-primary">
                          {formatInTimeZone(block.requested_at, block.timezone, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hourCycle: "h23",
                          })}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-primary/45">Response: </dt>
                        <dd className="inline font-semibold text-primary">
                          {block.responded_at
                            ? formatInTimeZone(
                                block.responded_at,
                                block.timezone,
                                {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hourCycle: "h23",
                                }
                              )
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={scheduleHref}
                      className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
                    >
                      View in schedule
                    </Link>
                    <Link
                      href={`/coach/${encodeURIComponent(block.coach_id)}`}
                      className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
                    >
                      View coach profile
                    </Link>
                    <Link
                      href={`${base}/sessions/${encodeURIComponent(block.booking_request_id)}`}
                      className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
