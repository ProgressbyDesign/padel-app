"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitAssessmentReview } from "@/app/account/coaches/[coachId]/assessments/actions";
import { replacementReasons, type ReviewOrder } from "@/lib/passport/review/model";
import { validateReview, type ReviewInput } from "@/lib/passport/review/validation";
import { panel, primaryAction, secondaryAction } from "@/components/development/DevelopmentUi";

const initial: Omit<ReviewInput, "requestId"> = { outcome: "developing", observations: "", positive_feedback: "", areas_for_improvement: "", recommendations: "", practice_tasks: "", next_step: "", replacement_reason: "", recording_guidance: "", criteria_results: {} };
export default function AssessmentReviewForm({ coachId, order }: { coachId: string; order: ReviewOrder }) {
  const [input, setInput] = useState(initial), [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const replay = useRef<{ payload: string; id: string } | null>(null);
  const router = useRouter();
  const replacement = input.outcome === "replacement_requested";
  function update(key: keyof typeof initial, value: string) { setInput(previous => ({ ...previous, [key]: value })); setError(""); }
  function send(command: "start_review" | "submit_review") {
    if (pending) return;
    const payload = JSON.stringify({ command, input });
    if (!replay.current || replay.current.payload !== payload) replay.current = { payload, id: crypto.randomUUID() };
    const request = { ...input, requestId: replay.current.id };
    if (command === "submit_review") { try { validateReview(request, order); } catch (reason) { setError(reason instanceof Error ? reason.message : "Check the feedback."); return; } }
    setError("");
    startTransition(async () => {
      try {
        const result = await submitAssessmentReview(coachId, order.id, command, request);
        if (!result.ok) setError(result.error ?? "Review unavailable."); else router.refresh();
      } catch { setError("Connection interrupted. Retry without changing the feedback to safely reuse this request."); }
    });
  }
  const textField = (key: "observations" | "positive_feedback" | "areas_for_improvement" | "recommendations" | "practice_tasks" | "next_step" | "recording_guidance", label: string, help?: string) => <label className="block text-sm font-semibold" key={key}>{label}<textarea value={input[key]} onChange={event => update(key, event.target.value)} maxLength={2000} rows={3} className="mt-2 block min-h-24 w-full rounded-xl border border-primary/20 bg-white p-3 font-normal" />{help ? <span className="mt-1 block text-xs font-normal text-primary/65">{help}</span> : null}</label>;
  return <section className={panel}><h2 className="text-2xl">Your assessment</h2><p className="mt-2 text-sm leading-6 text-primary/70">Feedback stays in this tab until sent. Final decisions are immutable. Check the video and every criterion before completing the assessment.</p>
    {order.state === "ready_for_review" ? <button type="button" className={`${secondaryAction} mt-4`} disabled={pending} onClick={() => send("start_review")}>Start review</button> : <p className="mt-4 text-sm font-semibold">Review in progress</p>}
    <form className="mt-6 space-y-6" onSubmit={event => { event.preventDefault(); send("submit_review"); }}>
      <fieldset disabled={pending} className="space-y-6"><legend className="text-sm font-semibold">Review outcome</legend><div className="grid gap-2 sm:grid-cols-3">{[{ id: "developing", label: "Developing" }, { id: "verified", label: "Verified" }, { id: "replacement_requested", label: "Replacement footage" }].map(item => <label key={item.id} className={`flex min-h-12 items-center gap-2 rounded-xl border p-3 text-sm ${input.outcome === item.id ? "border-primary bg-secondary/25" : "border-primary/15"}`}><input type="radio" name="outcome" value={item.id} checked={input.outcome === item.id} onChange={() => update("outcome", item.id)} />{item.label}</label>)}</div>
        <p className="text-sm text-primary/70">{replacement ? "Unassessable footage: no completion, no extra payment. Explain precisely how to record the replacement." : "Developing and Verified both deliver the paid assessment. Verified requires every purchased criterion to be met."}</p>
        {textField("observations", "Assessment summary", "Describe the evidence you observed. At least 10 characters.")}
        {replacement ? <><label className="block text-sm font-semibold">Recording issue<select aria-label="Recording issue" className="mt-2 block min-h-11 w-full rounded-xl border border-primary/20 bg-white p-3" value={input.replacement_reason} onChange={event => update("replacement_reason", event.target.value)}><option value="">Choose an issue</option>{replacementReasons.map(reason => <option key={reason}>{reason}</option>)}</select></label>{textField("recording_guidance", "Replacement recording guidance", "Camera position, visibility and repetitions to change.")}</> : <>
          <fieldset className="rounded-2xl bg-surface p-4"><legend className="px-1 text-sm font-semibold">Rubric v{order.terms_snapshot.standard_version} · evaluate every criterion</legend><div className="space-y-4">{order.terms_snapshot.criteria.map(criterion => <label key={criterion.id} className="block text-sm"><span>{criterion.expectation}</span><select aria-label={`Criterion: ${criterion.expectation}`} value={criterion.id in input.criteria_results ? String(input.criteria_results[criterion.id]) : ""} onChange={event => setInput(previous => ({ ...previous, criteria_results: { ...previous.criteria_results, [criterion.id]: event.target.value === "true" } }))} className="mt-2 block min-h-11 w-full rounded-xl border border-primary/20 bg-white p-3"><option value="" disabled>Evaluate this criterion</option><option value="true">Met</option><option value="false">Developing</option></select></label>)}</div></fieldset>
          {textField("positive_feedback", "What is working")}{textField("areas_for_improvement", "Areas to improve", "Required for Developing; be specific to this player.")}{textField("recommendations", "Technical recommendations")}
          <div><p className="text-sm font-semibold">Practice template</p><p className="mt-1 text-xs text-primary/65">Optional structure to edit; this does not score the player.</p><button type="button" className={`${secondaryAction} mt-2`} onClick={() => update("practice_tasks", "Controlled partner feeds: specify repetitions, target and success measure.\nRecovery drill: specify starting position, movement and progression.")}>Use practice structure</button></div>
          {textField("practice_tasks", "Practice exercises", "One exercise per line. Add 1–8 specific exercises, at least 10 characters each.")}{textField("next_step", "Recommended next step")}
        </>}
      </fieldset>
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      <p className="text-xs text-primary/65">Optional coach-recorded feedback is reserved for a later phase. No response video is required or uploaded here.</p>
      <button type="submit" disabled={pending} className={primaryAction}>{pending ? "Saving…" : replacement ? "Request replacement footage" : input.outcome === "verified" ? "Complete as Verified" : "Complete as Developing"}</button>
    </form>
  </section>;
}
