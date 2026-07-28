import type { EmailServiceDiagnostic } from "@/lib/notifications/emailServiceDiagnostic";

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminEmailServiceDiagnostic({
  diagnostic,
}: {
  diagnostic: EmailServiceDiagnostic;
}) {
  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">Email service</h2>
          <p className="mt-1 text-sm text-primary/55">
            Resend configuration for admin invitation delivery. Secrets and
            invitation links are never shown here.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <DiagnosticItem
          label="API key configured"
          value={yesNo(diagnostic.apiKeyConfigured)}
        />
        <DiagnosticItem
          label="Sender configured"
          value={yesNo(diagnostic.senderConfigured)}
        />
        <DiagnosticItem
          label="Application URL configured"
          value={yesNo(diagnostic.applicationUrlConfigured)}
        />
        <DiagnosticItem
          label="Sender address"
          value={diagnostic.senderAddress ?? "—"}
        />
        <DiagnosticItem
          label="Application origin"
          value={diagnostic.applicationOrigin ?? "—"}
        />
        <DiagnosticItem
          label="Last invitation email result"
          value={diagnostic.lastInvitationEmailResult}
        />
        <DiagnosticItem
          label="Last safe provider error code"
          value={diagnostic.lastSafeProviderErrorCode ?? "—"}
        />
        <DiagnosticItem
          label="Last send attempt"
          value={formatDate(diagnostic.lastSendAttemptAt)}
        />
      </dl>

      {!diagnostic.apiKeyConfigured ||
      !diagnostic.senderConfigured ||
      !diagnostic.applicationUrlConfigured ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Set <code className="text-xs">RESEND_API_KEY</code>,{" "}
          <code className="text-xs">RESEND_FROM_EMAIL</code>, and{" "}
          <code className="text-xs">NEXT_PUBLIC_APP_URL</code> in your deployment
          environment, then redeploy or restart the server so the values load.
        </p>
      ) : null}
    </section>
  );
}

function DiagnosticItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-surface/50 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-primary/50">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-primary">{value}</dd>
    </div>
  );
}
