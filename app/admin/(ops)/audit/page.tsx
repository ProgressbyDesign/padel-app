import { humanizeAuditAction } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/auth/adminSession";
import {
  listAdminAuditEvents,
  listKnownAuditActions,
} from "@/lib/queries/adminAudit";
import AdminAuditPanel from "@/components/admin/AdminAuditPanel";

type PageProps = {
  searchParams: Promise<{
    actor?: string;
    action?: string;
    target_type?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const account = await requireAdminPermission("audit.read");
  const params = await searchParams;
  const events = await listAdminAuditEvents({
    actor: params.actor,
    action: params.action,
    targetType: params.target_type,
    from: params.from,
    to: params.to,
  });

  const actionOptions = listKnownAuditActions().map((value) => ({
    value,
    label: humanizeAuditAction(value),
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Operations
        </p>
        <h1 className="mt-2">Audit log</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/60">
          Review administrative actions across invitations, applications,
          relationships, and account requests.
        </p>
      </div>
      <AdminAuditPanel
        events={events}
        actionOptions={actionOptions}
        isOwner={account.role === "owner"}
        initial={{
          actor: params.actor ?? "",
          action: params.action ?? "",
          targetType: params.target_type ?? "",
          from: params.from ?? "",
          to: params.to ?? "",
        }}
      />
    </div>
  );
}
