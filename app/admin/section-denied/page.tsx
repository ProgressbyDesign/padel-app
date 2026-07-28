import Link from "next/link";
import { requireAdminAccess } from "@/lib/auth/adminSession";
import { ROLE_LABELS } from "@/lib/admin/permissions";

type PageProps = {
  searchParams: Promise<{ permission?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function AdminSectionDeniedPage({
  searchParams,
}: PageProps) {
  const account = await requireAdminAccess("access-denied");
  const params = await searchParams;
  const permission = first(params.permission);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
        Admin workspace · {ROLE_LABELS[account.role]}
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary">
        You don&apos;t have access to this section
      </h1>
      <p className="mt-4 text-base leading-7 text-primary/65">
        Your {ROLE_LABELS[account.role].toLowerCase()} role can open the admin
        workspace, but this area needs a different permission
        {permission ? (
          <>
            {" "}
            (<span className="font-semibold text-primary">{permission}</span>)
          </>
        ) : null}
        . Ask an owner if you need access.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
        >
          Back to Admin overview
        </Link>
        <Link
          href="/account"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary"
        >
          Switch workspace
        </Link>
      </div>
    </div>
  );
}
