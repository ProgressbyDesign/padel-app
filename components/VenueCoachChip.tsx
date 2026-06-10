import Link from "next/link";
import CoachImage from "./CoachImage";
import type { Coach } from "../lib/coaches";
import { coachListingProfileHref } from "../lib/coachListing";

type VenueCoachChipProps = {
  coach: Coach;
};

export default function VenueCoachChip({ coach }: VenueCoachChipProps) {
  const name = coach.name?.trim() || "Coach";
  const role = coach.role?.trim();

  return (
    <Link
      href={coachListingProfileHref(String(coach.id), "venues")}
      className="flex min-h-[52px] items-center gap-3 rounded-xl border border-primary/15 bg-white px-3 py-2 shadow-sm transition hover:border-primary/25 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
    >
      <CoachImage
        src={coach.image_url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover object-[center_20%] ring-1 ring-primary/12"
      />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-primary">{name}</p>
        {role ? <p className="truncate text-xs text-primary/60">{role}</p> : null}
      </div>
    </Link>
  );
}
