import AuthExperience from "@/components/auth/AuthExperience";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  CoachApplicationApprovedNotice,
} from "@/components/account/applications/CoachApplicationClaimConflict";
import { redirect } from "next/navigation";
import CoachApplicationReadOnly from "@/components/account/applications/CoachApplicationReadOnly";
import CoachApplicationWizard from "@/components/account/applications/CoachApplicationWizard";
import CoachLegacyClaimApplication from "@/components/account/applications/CoachLegacyClaimApplication";
import { isEditableApplicationStatus } from "@/lib/coachProfileApplication/constants";
import { requireAuthenticatedAccount } from "@/lib/auth/session";
import {
  loadCurrentCoachApplication,
  loadLatestCoachApplication,
} from "@/lib/queries/coachProfileApplication";

export const metadata: Metadata = {
  title: "Coach application",
  description: "Apply to join Padel Pathways as an individual coach.",
};

type PageProps = {
  searchParams: Promise<{ mode?: string; coach?: string }>;
};

export default async function CoachApplicationPage({ searchParams }: PageProps) {
  // Ignore legacy claim deep-links (mode=claim_existing&coach=…).
  await searchParams;

  const account = await requireAuthenticatedAccount(
    "/account/applications/coach"
  );
  const [active, latest] = await Promise.all([
    loadCurrentCoachApplication(),
    loadLatestCoachApplication(),
  ]);

  const approvedApp =
    latest?.application.status === "approved" ? latest : null;

  let content: ReactNode;

  if (approvedApp && !active) {
    content = (
      <CoachApplicationApprovedNotice
        coachId={approvedApp.application.coach_id}
      />
    );
  } else if (!active) {
    redirect("/account/personal#coach-verification");
  } else if (active.application.application_mode === "claim_existing") {
    content = <CoachLegacyClaimApplication data={active} />;
  } else if (isEditableApplicationStatus(active.application.status)) {
    content = (
      <CoachApplicationWizard
        initial={active}
        verifiedEmail={account.email}
      />
    );
  } else {
    content = (
      <CoachApplicationReadOnly
        data={active}
        verifiedEmail={account.email}
      />
    );
  }

  return (
    <AuthExperience joining wideForm audience="coach" title="Coach application" description="Your progress saves to your account. Complete your details when you are ready.">
      <Link href="/account/personal#coach-verification" className="mb-3 text-sm font-semibold underline">Back to dashboard</Link>
      {content}
    </AuthExperience>
  );
}