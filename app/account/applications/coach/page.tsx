import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  CoachApplicationApprovedNotice,
} from "@/components/account/applications/CoachApplicationClaimConflict";
import CoachApplicationEntry from "@/components/account/applications/CoachApplicationEntry";
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
    content = <CoachApplicationEntry />;
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
        <h1 className="mt-3 text-3xl text-primary sm:text-4xl">
          Coach application
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-6 text-primary/65">
          Four short steps. Progress saves to your account.
        </p>
      </div>

      <div className="mt-8">{content}</div>
    </div>
  );
}
