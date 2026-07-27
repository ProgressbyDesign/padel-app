import type { Metadata } from "next";
import AccountSettingsClient from "@/components/account/settings/AccountSettingsClient";
import { loadAccountSettingsPage } from "@/lib/queries/accountSettings";

export const metadata: Metadata = {
  title: "Account settings",
  description: "Manage your Padel Pathways account details and security.",
};

export default async function AccountSettingsPage() {
  const data = await loadAccountSettingsPage();

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Account
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
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
