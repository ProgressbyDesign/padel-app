import { requireAdminPermission } from "@/lib/auth/adminSession";
import { loadEmailServiceDiagnostic } from "@/lib/notifications/emailServiceDiagnostic";
import { loadAdminTeamBoard } from "@/lib/queries/adminTeam";
import AdminEmailServiceDiagnostic from "@/components/admin/AdminEmailServiceDiagnostic";
import AdminTeamPanel from "@/components/admin/AdminTeamPanel";

export default async function AdminTeamPage() {
  const account = await requireAdminPermission("team.manage");
  const [board, emailDiagnostic] = await Promise.all([
    loadAdminTeamBoard(),
    account.role === "owner" ? loadEmailServiceDiagnostic() : null,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Operations
        </p>
        <h1 className="mt-2">Team</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/60">
          Invite admins, manage roles, and keep at least one active Owner.
        </p>
      </div>
      {emailDiagnostic ? (
        <AdminEmailServiceDiagnostic diagnostic={emailDiagnostic} />
      ) : null}
      <AdminTeamPanel board={board} currentUserId={account.id} />
    </div>
  );
}
