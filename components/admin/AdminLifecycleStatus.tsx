import { AdminBadge } from "@/components/admin/ui";
import {
  buildAdminLifecycleSummary,
  onboardingAdminLabel,
} from "@/lib/lifecycle/adminStatus";

/**
 * Four-axis lifecycle summary. Verification, Account, Launch and Visibility are
 * deliberately shown side by side so Approved is never read as Published.
 */
export function AdminLifecycleStatus({
  isApproved,
  hasAccount,
  launchSelectionStatus,
  publicationStatus,
  onboardingStatus,
}: {
  isApproved: boolean | null | undefined;
  hasAccount: boolean | null | undefined;
  launchSelectionStatus: unknown;
  publicationStatus: unknown;
  onboardingStatus?: unknown;
}) {
  const rows = buildAdminLifecycleSummary({
    isApproved,
    hasAccount,
    launchSelectionStatus,
    publicationStatus,
  });

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-primary/10 bg-surface/50 p-3"
          >
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              {row.label}
            </dt>
            <dd className="mt-2">
              <AdminBadge tone={row.tone}>{row.value}</AdminBadge>
              <p className="mt-2 text-xs leading-5 text-primary/55">
                {row.hint}
              </p>
            </dd>
          </div>
        ))}
      </dl>

      {onboardingStatus === undefined ? null : (
        <p className="text-xs text-primary/55">
          Onboarding:{" "}
          <span className="font-semibold text-primary/75">
            {onboardingAdminLabel(onboardingStatus)}
          </span>{" "}
          (read-only)
        </p>
      )}

      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
        Approved does not mean Published. Only Visibility = Published makes a
        profile visible to anonymous visitors.
      </p>
    </div>
  );
}
