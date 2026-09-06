import Link from "next/link";
import { getAuthenticatedAccount } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getAdminAccount } from "@/lib/auth/adminSession";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAccessDeniedPage() {
  const account = await getAuthenticatedAccount();
  if (!account) {
    redirect(`/login?next=${encodeURIComponent("/admin")}`);
  }
  const admin = await getAdminAccount();
  if (admin) {
    redirect("/admin");
  }

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("admin_memberships")
    .select("status")
    .eq("user_id", account.id)
    .maybeSingle();
  const suspended =
    membership &&
    (membership.status === "suspended" || membership.status === "revoked");

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
        Admin
      </p>
      <h1 className="mt-3 text-3xl text-primary">
        You don&apos;t have admin access
      </h1>
      <p className="mt-4 text-base leading-7 text-primary/65">
        You&apos;re signed in as {account.email || "this account"}, but this
        workspace is limited to active Padel Pathways admins.
        {suspended
          ? " Your admin membership is suspended or revoked — contact an owner if you need access restored."
          : " This is not a password problem — your account simply isn't an active admin."}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/account/personal"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
        >
          Go to my account
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
