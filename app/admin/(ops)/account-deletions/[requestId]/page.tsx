import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminDeletionRequestDetailPanel } from "@/components/admin/AdminDeletionRequestsPanel";
import { loadAdminDeletionRequestDetail } from "@/lib/queries/accountDeletionRequests";

type PageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function AdminAccountDeletionDetailPage({
  params,
}: PageProps) {
  const { requestId } = await params;
  const detail = await loadAdminDeletionRequestDetail(requestId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/account-deletions"
          className="text-sm font-semibold text-primary/60 hover:text-primary"
        >
          ← Account deletions
        </Link>
        <h1 className="mt-3">Deletion request</h1>
        <p className="mt-2 text-sm text-primary/60">
          {detail.request.requester_email}
        </p>
      </div>
      <AdminDeletionRequestDetailPanel detail={detail} />
    </div>
  );
}
