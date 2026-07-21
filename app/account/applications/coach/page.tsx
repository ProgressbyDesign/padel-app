import type { Metadata } from "next";
import Link from "next/link";
import CoachApplicationReadOnly from "@/components/account/applications/CoachApplicationReadOnly";
import CoachApplicationWizard, {
  StartCoachApplicationButton,
} from "@/components/account/applications/CoachApplicationWizard";
import { isEditableApplicationStatus } from "@/lib/coachProfileApplication/constants";
import { requireAuthenticatedAccount } from "@/lib/auth/session";
import { loadCurrentCoachApplication } from "@/lib/queries/coachProfileApplication";

export const metadata: Metadata = {
  title: "Coach application",
  description: "Apply to join Padel Pathways as an individual coach.",
};

export default async function CoachApplicationPage() {
  const account = await requireAuthenticatedAccount("/account/applications/coach");
  const current = await loadCurrentCoachApplication();

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]">
      <nav aria-label="Breadcrumb">
        <Link
          href="/account/applications"
          className="text-sm font-semibold text-primary/60 transition hover:text-primary"
        >
          ← Applications
        </Link>
      </nav>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Individual coach
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Coach application
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-6 text-primary/65">
          A short four-step application. Your progress is saved to your account.
        </p>
      </div>

      <div className="mt-8">
        {!current ||
        current.application.status === "declined" ||
        current.application.status === "withdrawn" ? (
          <section className="rounded-[24px] border border-primary/10 bg-white p-6">
            <h2 className="text-xl font-bold text-primary">Start your application</h2>
            <p className="mt-2 text-sm text-primary/65">
              {current?.application.status === "declined" ||
              current?.application.status === "withdrawn"
                ? "Your previous application is closed. You can start a new draft when ready."
                : "Create a draft to begin. Only you can view or edit this application."}
            </p>
            <div className="mt-5">
              <StartCoachApplicationButton />
            </div>
          </section>
        ) : isEditableApplicationStatus(current.application.status) ? (
          <CoachApplicationWizard
            initial={current}
            verifiedEmail={account.email}
          />
        ) : (
          <CoachApplicationReadOnly
            data={current}
            verifiedEmail={account.email}
          />
        )}
      </div>
    </div>
  );
}
