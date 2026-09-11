import Link from "next/link";
import CoachApplicationEntry from "@/components/account/applications/CoachApplicationEntry";
import type { AccountCoachApplicationSummary } from "@/lib/queries/accountDashboard";
import { APPLICATION_STATUS_LABELS, COACH_APPLICATION_STEPS, isEditableApplicationStatus } from "@/lib/coachProfileApplication/constants";

export default function CoachVerificationCard({ application }: { application: AccountCoachApplicationSummary }) {
  const editable = application && isEditableApplicationStatus(application.status);
  const step = Math.min(4, Math.max(1, application?.currentStep ?? 1));
  return <section id="coach-verification" className="scroll-mt-24 rounded-3xl border border-primary/15 bg-white p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl">{!application ? "Verify your coach account to get started" : editable ? "Complete your coach verification" : "Your coach verification"}</h2>
      {application ? <span className="rounded-full bg-surface px-3 py-1 text-sm font-semibold">{APPLICATION_STATUS_LABELS[application.status]}</span> : null}
    </div>
    <p className="mt-3 text-sm leading-6 text-primary/70">{!application ? "Add your coaching details and submit them for review. You can save your progress and return at any time." : editable ? `Step ${step} of 4 · ${COACH_APPLICATION_STEPS[step - 1].label}. Continue where you left off.` : "Your application has been sent for review. You can check its details here."}</p>
    {editable ? <progress aria-label={`Application progress: step ${step} of 4`} value={step} max={4} className="mt-3 h-2 w-full accent-primary" /> : null}
    {application?.reviewNote ? <p className="mt-3 rounded-xl bg-surface p-3 text-sm">{application.reviewNote}</p> : null}
    {application ? <Link href="/account/applications/coach" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-accent">{editable ? "Continue application" : "View application"}</Link> : <CoachApplicationEntry compact />}
  </section>;
}
