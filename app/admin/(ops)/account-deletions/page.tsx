import {
  isAccountDeletionStatus,
  type AccountDeletionStatus,
} from "@/lib/accountDeletion/types";
import { listAdminDeletionRequests } from "@/lib/queries/accountDeletionRequests";
import { AdminDeletionRequestsPanel } from "@/components/admin/AdminDeletionRequestsPanel";

type PageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

function selectedStatuses(
  value: string | string[] | undefined
): AccountDeletionStatus[] {
  const values = value ? (Array.isArray(value) ? value : [value]) : [];
  const valid = values.filter(isAccountDeletionStatus);
  return valid.length
    ? valid
    : (["requested", "processing"] as AccountDeletionStatus[]);
}

export default async function AdminAccountDeletionsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const statuses = selectedStatuses(params.status);
  const rows = await listAdminDeletionRequests({ statuses });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Operations
        </p>
        <h1 className="mt-2">Account deletions</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/60">
          Review deletion requests and responsibility summaries. Final Auth
          cleanup is handled separately — do not treat status changes as user
          deletion.
        </p>
        <p className="mt-2 text-sm text-primary/55">
          {rows.length} request{rows.length === 1 ? "" : "s"}
        </p>
      </div>
      <AdminDeletionRequestsPanel
        rows={rows}
        selectedStatuses={statuses}
      />
    </div>
  );
}
