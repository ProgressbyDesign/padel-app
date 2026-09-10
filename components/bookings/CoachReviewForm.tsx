"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { submitCoachReview } from "@/app/account/bookings/review-actions";
import { REVIEW_AREAS, type ReviewArea, type ReviewScores } from "@/lib/coachReviews";

export default function CoachReviewForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [scores, setScores] = useState<ReviewScores>({ coaching_quality: 0, player_progress: 0, value_for_money: 0 });
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  function rate(key: ReviewArea, value: number) { setScores((previous) => ({ ...previous, [key]: value })); }

  if (submitted) return <p role="status" className="rounded-2xl bg-white p-6 text-primary">{message}</p>;
  return (
    <form id="write-review" className="scroll-mt-24 space-y-6 rounded-[24px] border border-primary/15 bg-white p-5 sm:p-7" onSubmit={(event) => {
      event.preventDefault();
      setMessage(null);
      startTransition(async () => {
        try {
          const result = await submitCoachReview({ bookingId, ...scores, body });
          setMessage(result.message);
          if (result.ok) { setSubmitted(true); router.refresh(); }
        } catch { setMessage("Your review could not be saved. Please try again."); }
      });
    }}>
      <div><p className="text-xs font-semibold uppercase tracking-wider text-primary/65">Your experience matters</p><h2 className="mt-2 text-2xl">Review your coach</h2><p className="mt-3 text-sm leading-6 text-primary/75">Your session is complete. Help other players find the right coach with an honest review.</p></div>
      {REVIEW_AREAS.map((area) => <fieldset key={area.key} disabled={pending}><legend className="font-semibold">{area.label}</legend><p id={`${area.key}-help`} className="mt-1 text-sm leading-6 text-primary/70">{area.description}</p><div className="mt-3 flex flex-wrap items-center gap-1" aria-describedby={`${area.key}-help`}>{[1, 2, 3, 4, 5].map((score) => <label key={score} className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg"><input className="peer sr-only" type="radio" name={area.key} value={score} checked={scores[area.key] === score} onChange={() => rate(area.key, score)} required aria-label={`${score} ${score === 1 ? "star" : "stars"}`} /><span className="absolute inset-0 rounded-lg peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary" /><Star aria-hidden className={`h-7 w-7 ${scores[area.key] >= score ? "fill-primary text-primary" : "text-primary/35"}`} /></label>)}<span className="ml-2 text-xs text-primary/65">{scores[area.key] ? `${scores[area.key]} / 5` : "Select a rating"}</span></div></fieldset>)}
      <label className="block text-sm font-semibold">Your review <span className="font-normal text-primary/65">(optional)</span><textarea disabled={pending} value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border border-primary/25 bg-surface p-3 font-normal" placeholder="What worked well, and what could have been better?" /><span className="mt-1 block text-xs font-normal text-primary/65">{body.length} / 2,000 characters</span></label>
      <p className="text-xs leading-5 text-primary/70">Your ratings and comment will be public as a verified player review. Your name, email and booking details are not shown. Avoid including personal information. One review per completed session.</p>
      {message ? <p role="alert" className="text-sm text-red-800">{message}</p> : null}
      <button disabled={pending || REVIEW_AREAS.some((area) => scores[area.key] === 0)} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-accent disabled:opacity-50 sm:w-auto">{pending ? "Publishing…" : "Publish review"}</button>
    </form>
  );
}
