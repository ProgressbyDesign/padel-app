import Link from "next/link";
import CoachImage from "@/components/CoachImage";
import type { PublicCoachAvailabilityCard } from "@/lib/coachAvailability/types";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";
import { coachListingProfileHref } from "@/lib/coachListing";

export default function VenuePublicCoachAvailabilitySection({
  cards,
}: {
  cards: PublicCoachAvailabilityCard[];
}) {
  if (cards.length === 0) return null;

  return (
    <section className="space-y-2 border-t border-primary/10 pt-8">
      <div>
        <h2 className="text-xl font-semibold text-primary">
          Coaches available at this venue
        </h2>
        <p className="mt-1 text-sm text-primary/70">
          Request a session for an upcoming public time.
        </p>
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const next = card.nextSlot;
          const requestHref = next
            ? `/book/coach/${encodeURIComponent(card.coachId)}?${new URLSearchParams(
                {
                  relationship: card.relationshipId,
                  start: next.startsAt,
                }
              ).toString()}`
            : null;

          return (
            <li
              key={card.relationshipId}
              className="rounded-2xl border border-primary/15 bg-white p-4"
            >
              <div className="flex gap-4">
                <CoachImage
                  src={card.imageUrl}
                  alt=""
                  className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl object-cover object-[center_20%]"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-primary">{card.coachName}</p>
                  {card.role ? (
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-primary/60">
                      {card.role}
                    </p>
                  ) : null}
                  {next ? (
                    <p className="mt-2 text-sm text-primary/70">
                      Next:{" "}
                      {formatInTimeZone(next.startsAt, card.timezone, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        hourCycle: "h23",
                      })}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={coachListingProfileHref(card.coachId, "venues")}
                      className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
                    >
                      View availability
                    </Link>
                    {requestHref ? (
                      <Link
                        href={requestHref}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-accent"
                      >
                        Request session
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
