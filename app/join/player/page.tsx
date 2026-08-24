import type { Metadata } from "next";
import PlayerJoinLanding from "@/components/join/PlayerJoinLanding";
import { getAuthenticatedAccount } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Join Padel Pathways as a Player",
  description:
    "Create a free Padel Pathways player account to find coaches, discover venues, and keep your bookings in one place.",
};

export default async function PlayerJoinPage() {
  const account = await getAuthenticatedAccount();
  return <PlayerJoinLanding signedIn={Boolean(account)} />;
}
