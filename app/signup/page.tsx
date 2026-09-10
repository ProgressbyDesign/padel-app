import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthExperience from "@/components/auth/AuthExperience";
import SignupForm from "@/components/auth/SignupForm";
import { safeInternalPath } from "@/lib/auth/redirects";
import { getAuthenticatedAccount } from "@/lib/auth/session";
import { signupPageCopy } from "@/lib/auth/signupCopy";

export const metadata: Metadata = {
  title: "Create player account",
  description: "Create your free Padel Pathways player account.",
};

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next);
  const copy = signupPageCopy(nextPath);

  if (await getAuthenticatedAccount()) {
    redirect(nextPath);
  }

  return (
    <AuthExperience joining audience={nextPath.includes("/applications/coach") ? "coach" : nextPath.includes("/applications/venue") ? "venue" : "player"} title={copy.title} description={copy.description}>
      <SignupForm nextPath={nextPath} />
    </AuthExperience>
  );
}
