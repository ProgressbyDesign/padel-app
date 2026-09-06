import type { Metadata } from "next";
import Link from "next/link";
import AccountSettingsClient from "@/components/account/settings/AccountSettingsClient";
import { getAdminAccount } from "@/lib/auth/adminSession";
import { loadAccountSettingsPage } from "@/lib/queries/accountSettings";

export const metadata: Metadata = {
  title: "Account settings",
  description: "Manage your Padel Pathways account details and security.",
};

type PageProps = {
  searchParams: Promise<{ from?: string }>;
};

export default async function AccountSettingsPage({ searchParams }: PageProps) {
  const [{ from }, data, admin] = await Promise.all([
    searchParams,
    loadAccountSettingsPage(),
    getAdminAccount(),
  ]);

  const showAdminContext = Boolean(admin) || from === "admin";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      {showAdminContext ? (
        <div className="mb-6 rounded-2xl border border-primary/10 bg-white px-4 py-3 text-sm text-primary/70">
          <p>
            Your account details are separate from your Admin role and
            permissions.
          </p>
          <Link
            href="/admin"
            className="mt-2 inline-flex font-semibold text-primary underline"
          >
            Back to Admin workspace
          </Link>
        </div>
      ) : null}

      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Account
        </p>
        <h1 className="mt-3 text-3xl text-primary sm:text-4xl">
          Account settings
        </h1>
        <p className="mt-3 text-base leading-6 text-primary/65">
          Update your personal details, security settings, and review linked
          workspaces.
        </p>
      </div>

      <AccountSettingsClient data={data} />
    </div>
  );
}
