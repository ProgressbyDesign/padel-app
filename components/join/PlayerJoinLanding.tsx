import Link from "next/link";
import AuthExperience from "@/components/auth/AuthExperience";
import SignupForm from "@/components/auth/SignupForm";

export default function PlayerJoinLanding({ signedIn }: { signedIn: boolean }) {
  return <AuthExperience joining title="Your next chapter on court." description="Create your free player account. Find a coach, save your favourites and keep every booking together.">
    {signedIn ? <Link href="/account" className="rounded-xl bg-primary px-6 py-4 text-center font-semibold text-accent">Go to my dashboard</Link> : <SignupForm nextPath="/account" submitLabel="Create my player account" hidePartnerLink />}
  </AuthExperience>;
}
