import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import VenueApplicationReadOnly from "@/components/account/applications/VenueApplicationReadOnly";
import VenueApplicationWizard, {
  StartVenueApplicationButton,
} from "@/components/account/applications/VenueApplicationWizard";
import VenueLegacyClaimApplication from "@/components/account/applications/VenueLegacyClaimApplication";
import { requireAuthenticatedAccount } from "@/lib/auth/session";
import {
  loadCurrentVenueApplication,
  loadLatestVenueApplication,
} from "@/lib/queries/venueProfileApplication";
import { isEditableVenueApplicationStatus } from "@/lib/venueProfileApplication/constants";

export const metadata: Metadata = {
  title: "Venue application",
  description: "Submit your venue details to join Padel Pathways.",
};

export default async function VenueApplicationPage() {
  const account = await requireAuthenticatedAccount(
    "/account/applications/venue"
  );
  const [active, latest] = await Promise.all([
    loadCurrentVenueApplication(),
    loadLatestVenueApplication(),
  ]);

  const approvedClaim =
    latest?.application.status === "approved" &&
    latest.application.application_mode === "claim_existing"
      ? latest
      : null;

  let content: ReactNode;

  if (approvedClaim && !active) {
    content = <VenueLegacyClaimApplication data={approvedClaim} />;
  } else if (
    !active ||
    active.application.status === "declined" ||
    active.application.status === "withdrawn"
  ) {
    content = (
      <section className="rounded-[24px] border border-primary/10 bg-white p-6">
        <h2 className="text-xl font-bold text-primary">
          Start your application
        </h2>
        <p className="mt-2 text-sm text-primary/65">
          {active?.application.status === "declined" ||
          active?.application.status === "withdrawn"
            ? "Your previous application is closed. You can start a new draft when ready."
            : "Create a draft to begin. Only you can view or edit this application."}
        </p>
        <div className="mt-5">
          <StartVenueApplicationButton />
        </div>
      </section>
    );
  } else if (active.application.application_mode === "claim_existing") {
    content = <VenueLegacyClaimApplication data={active} />;
  } else if (isEditableVenueApplicationStatus(active.application.status)) {
    content = (
      <VenueApplicationWizard
        initial={active}
        verifiedEmail={account.email}
      />
    );
  } else {
    content = <VenueApplicationReadOnly data={active} />;
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
          Academy or venue
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Venue application
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-6 text-primary/65">
          Submit your venue details. Your progress is saved to your account.
        </p>
      </div>

      <div className="mt-8">{content}</div>
    </div>
  );
}
