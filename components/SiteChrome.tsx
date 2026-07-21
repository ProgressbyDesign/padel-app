"use client";

import { usePathname } from "next/navigation";
import AccountFooter from "./account/AccountFooter";
import AppFooter from "./AppFooter";
import AppHeader from "./AppHeader";

export default function SiteChrome({
  children,
  authenticated,
}: {
  children: React.ReactNode;
  authenticated: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const isAccount = pathname?.startsWith("/account");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <AppHeader authenticated={authenticated} />
      <main className="flex-1">{children}</main>
      {isAccount ? <AccountFooter /> : <AppFooter />}
    </>
  );
}
