import AuthExperience from "@/components/auth/AuthExperience";
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
        <h2 className="text-xl text-primary">
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
    <AuthExperience joining wideForm audience="venue" title="Venue application" description="Your progress saves to your account. Complete your details when you are ready.">
      <Link href="/account/applications" className="mb-5 text-sm font-semibold underline">Back to applications</Link>
      {content}
    </AuthExperience>
  );
}