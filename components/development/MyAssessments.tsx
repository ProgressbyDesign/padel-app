import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { EmptyPanel, PageIntro, panel, primaryAction, secondaryAction } from "./DevelopmentUi";
import { assessmentStatus, canSubmit, type SubmissionRecord } from "@/lib/passport/video/contracts";

export default function MyAssessments({ submissionIntent = false, records = [], feedback = {} }: { submissionIntent?: boolean; records?: SubmissionRecord[]; feedback?: Record<string, { assessor: string; summary: string }> }) {
  return <>
    <PageIntro title="My Assessments" description="A coach's view on your game, with clear feedback and a next step to practise." />
    {records.length ? <div className="grid gap-4">{records.map(({ order, attempt, skillTitle }) => <article key={order.id} className={panel}>
      <p className="text-xs font-semibold text-primary/65">Isolated local test record</p><h2 className="mt-2 text-2xl">{skillTitle}</h2>
      <p className="mt-3 font-semibold">{order.refund_state !== "none" ? "Refund resolution in progress" : assessmentStatus[order.state]}</p>
      {feedback[order.id] ? <div className="mt-3 text-sm"><p>Assessor: {feedback[order.id].assessor}</p>{feedback[order.id].summary ? <p className="mt-2 whitespace-pre-line">{feedback[order.id].summary}</p> : null}</div> : null}
      <p className="mt-2 text-sm">Payment: {order.payment_state === "paid" ? "Confirmed by server" : order.payment_state === "refunded" ? "Refunded" : "Awaiting confirmation"}{attempt ? ` · Video attempt ${attempt.attempt_number}` : ""}</p>
      {attempt?.recording_guidance ? <p className="mt-3 text-sm leading-6">Replacement guidance: {attempt.recording_guidance}</p> : null}
      {order.review_due_at ? <p className="mt-3 text-sm">Review target: <time dateTime={order.review_due_at}>{new Date(order.review_due_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</time></p> : null}
      <Link className={`${canSubmit(order, attempt) ? primaryAction : secondaryAction} mt-4`} href={`/account/development/assessments/${order.id}`}>{canSubmit(order, attempt) ? order.state === "replacement_requested" ? "Upload free replacement" : "Continue video submission" : "View assessment"}</Link>
    </article>)}</div> : <EmptyPanel icon={<ClipboardList size={28} />} title="Your first assessment starts with a skill"><p>No assessment orders are available here. Explore the sample Bandeja journey, then see how a submission would work. Local uploads require an authorised, server-funded test order.</p><Link href="/account/development/skills/improver-bandeja" className={`${secondaryAction} mt-5`}>Practise the Bandeja</Link><Link href="/account/development/assessments?intent=submit#submission-preview" className={`${primaryAction} mt-3`}>About video assessments</Link></EmptyPanel>}
    {submissionIntent ? <section id="submission-preview" className={`${panel} mt-6 scroll-mt-24`}><h2 className="text-2xl">A focused clip. A useful next step.</h2><ol className="mt-5 list-inside list-decimal space-y-3 text-sm leading-6"><li>Choose your skill and an approved assessor.</li><li>Check the coach&apos;s price before ordering. £35 is a suggested pilot price.</li><li>Submit a usable clip of up to 90 seconds.</li><li>Receive a Developing or Verified assessment, with a target of 72 hours after a valid submission is received.</li></ol><p className="mt-5 rounded-xl bg-secondary/20 p-4 text-sm leading-6">Checkout is not enabled. Video uploads are limited to isolated local test orders with confirmed funding. This preview cannot mark an order paid.</p></section> : null}
    <section className={`${panel} mt-6`}><h2 className="text-xl">Clear expectations</h2><ul className="mt-4 list-inside list-disc space-y-3 text-sm leading-6 text-primary/75"><li>Your account and Passport are free during the pilot.</li><li>Both Developing and Verified count as a delivered paid assessment.</li><li>A later reassessment is a new paid service.</li><li>Unusable footage gets a free replacement under the same order.</li><li>A technical upload failure must never require another payment.</li></ul></section>
  </>;
}
