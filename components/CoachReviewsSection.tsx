"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, Star } from "lucide-react";
import { REVIEW_AREAS, type CoachReviewsData } from "@/lib/coachReviews";

export default function CoachReviewsSection({ data }: { data: CoachReviewsData }) {
  const [visible, setVisible] = useState(5);
  const { summary, reviews } = data;
  return (
    <section id="coach-reviews" className="mt-12 scroll-mt-28 border-t border-primary/15 pt-10" aria-labelledby="coach-reviews-heading">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/60">From players who trained here</p><h2 id="coach-reviews-heading" className="mt-3 text-3xl">Player reviews</h2></div><Link href="/account/bookings" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Review a completed session</Link></div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/75">Only players with a completed booking can leave a review. Each session counts once, with all three areas weighted equally.</p>
      {!data.available ? <p role="status" className="mt-6 rounded-2xl bg-white p-6 text-sm">Reviews are temporarily unavailable. Please try again later.</p> : summary.review_count === 0 ? <div className="mt-6 rounded-2xl bg-white p-6 sm:p-8"><ShieldCheck className="h-7 w-7" aria-hidden /><h3 className="mt-3 text-xl">Be the first to share your experience</h3><p className="mt-2 text-sm leading-6 text-primary/70">No verified session reviews yet. After your coach marks your booking complete, you can review it from your bookings.</p></div> : (
        <div className="mt-7 grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
          <aside aria-label="Review ratings" className="self-start rounded-2xl bg-primary p-6 text-white"><div className="flex items-center gap-3"><Star className="h-7 w-7 fill-accent text-accent" aria-hidden /><p className="text-4xl font-semibold">{Number(summary.rating).toFixed(1)}<span className="ml-2 text-sm font-normal text-white/75">/ 5</span></p></div><p className="mt-2 text-sm text-white/80">{summary.review_count} verified {summary.review_count === 1 ? "session review" : "session reviews"}</p><dl className="mt-7 space-y-5">{REVIEW_AREAS.map((area) => <div key={area.key}><div className="flex justify-between gap-4 text-sm"><dt>{area.label}</dt><dd>{Number(summary[area.key]).toFixed(1)}</dd></div><div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-accent" style={{ width: `${Number(summary[area.key]) * 20}%` }} /></div></div>)}</dl></aside>
          <div><ul className="divide-y divide-primary/15">{reviews.slice(0, visible).map((review) => <li key={review.id} className="py-6 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" aria-hidden />Verified session</p><time className="mt-1 block text-xs text-primary/65" dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</time></div><p className="flex items-center gap-1.5 text-sm font-semibold"><Star className="h-4 w-4 fill-primary" aria-hidden />{Number(review.overall_rating).toFixed(1)} / 5</p></div>{review.body ? <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-primary/85">{review.body}</p> : <p className="mt-4 text-sm text-primary/65">This player left ratings without a written comment.</p>}<dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-primary/70">{REVIEW_AREAS.map((area) => <div key={area.key} className="flex gap-1"><dt>{area.label}:</dt><dd className="font-semibold">{review[area.key]}/5</dd></div>)}</dl></li>)}</ul>{visible < reviews.length ? <button onClick={() => setVisible((count) => count + 5)} className="mt-3 min-h-11 rounded-xl border border-primary/25 px-5 text-sm font-semibold">Show more reviews</button> : null}{summary.review_count > reviews.length ? <p className="mt-4 text-xs text-primary/65">Showing the latest {reviews.length} reviews. Ratings include all {summary.review_count} verified reviews.</p> : null}</div>
        </div>
      )}
    </section>
  );
}
