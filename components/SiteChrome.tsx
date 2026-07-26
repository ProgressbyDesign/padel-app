"use client";

import { usePathname } from "next/navigation";
import AccountFooter from "./account/AccountFooter";
import AppFooter from "./AppFooter";
import AppHeader from "./AppHeader";
import type { AccountNavContext } from "@/lib/workspace/resolve";

export default function SiteChrome({
  children,
  accountNav,
}: {
  children: React.ReactNode;
  accountNav: AccountNavContext | null;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const isAccount = pathname?.startsWith("/account");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <AppHeader accountNav={accountNav} />
      <main className="flex-1">{children}</main>
      {isAccount ? <AccountFooter /> : <AppFooter />}
    </>
  );
}
