import type { Metadata } from "next";
import PartnerJoinLanding from "@/components/join/PartnerJoinLanding";
import { getAuthenticatedAccount } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Partner with Padel Pathways",
  description:
    "Apply as an individual coach, academy or venue on Padel Pathways, and reach players looking for coaching.",
};

export default async function JoinPage() {
  const account = await getAuthenticatedAccount();
  return <PartnerJoinLanding authenticated={Boolean(account)} />;
}
