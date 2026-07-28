"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  cancelAdminInvitationAction,
  changeAdminMemberRoleAction,
  createAdminInvitationAction,
  reactivateAdminMemberAction,
  resendAdminInvitationAction,
  revokeAdminMemberAction,
  suspendAdminMemberAction,
} from "@/app/admin/(ops)/team/actions";
import {
  ADMIN_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type AdminRole,
} from "@/lib/admin/permissions";
import { invitationEmailStatusLabel } from "@/lib/notifications/emailDelivery";
import { AdminBadge } from "@/components/admin/ui";

const INVITATION_EXPIRY_OPTIONS_HOURS = [24, 72, 168, 336] as const;

type TeamMember = {
  userId: string;
  role: AdminRole;
  status: "active" | "suspended" | "revoked";
  joinedAt: string;
  fullName: string | null;
  email: string | null;
};

type Invitation = {
  id: string;
  email: string;
  role: AdminRole;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: string;
  updatedAt: string;
  invitedByName: string | null;
  lastEmailStatus: "pending" | "sent" | "failed" | null;
  lastSendAttemptAt: string | null;
  lastSentAt: string | null;
  sendCount: number;
  lastEmailErrorCode: string | null;
};

type Board = {
  active: TeamMember[];
  suspended: TeamMember[];
  revoked: TeamMember[];
  pendingInvitations: Invitation[];
  pastInvitations: Invitation[];
};

const EXPIRY_LABELS: Record<number, string> = {
  24: "24 hours",
  72: "3 days",
  168: "7 days",
  336: "14 days",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusTone(
  status: string
): "neutral" | "warn" | "ok" | "bad" {
  if (status === "active" || status === "accepted" || status === "pending") {
    return status === "pending" ? "warn" : "ok";
  }
  if (status === "suspended" || status === "expired") return "warn";
  if (status === "revoked" || status === "cancelled") return "bad";
  return "neutral";
}

export default function AdminTeamPanel({
  board,
  currentUserId,
}: {
  board: Board;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminRole>("support");
  const [inviteExpiry, setInviteExpiry] = useState(168);
  const [oneTimeLink, setOneTimeLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeOwners = useMemo(
    () => board.active.filter((m) => m.role === "owner").length,
    [board.active]
  );

  function flash(ok: boolean, text: string) {
    setMessage(ok ? text : null);
    setError(ok ? null : text);
  }

  function run(action: () => Promise<{ ok: boolean; message: string; invitationLink?: string }>) {
    setMessage(null);
    setError(null);
    setOneTimeLink(null);
    setCopied(false);
    startTransition(async () => {
      const result = await action();
      flash(result.ok, result.message);
      if (result.ok && result.invitationLink) {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        setOneTimeLink(
          result.invitationLink.startsWith("http")
            ? result.invitationLink
            : `${origin}${result.invitationLink}`
        );
      }
      if (result.ok) {
        setInviteOpen(false);
        setInviteEmail("");
        router.refresh();
      }
    });
  }

  async function copyLink() {
    if (!oneTimeLink) return;
    try {
      await navigator.clipboard.writeText(oneTimeLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-8">
      {(message || error) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-950"
          }`}
        >
          {error || message}
          {oneTimeLink ? (
            <div className="mt-3 space-y-2">
              <p className="font-semibold">
                Copy this invitation link now — it won&apos;t be shown again.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="block max-w-full truncate rounded-lg bg-white/80 px-3 py-2 text-xs">
                  {oneTimeLink}
                </code>
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-xl border border-primary/15 bg-white px-3 py-2 text-xs font-semibold"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl">Invite admin</h2>
            <p className="mt-1 text-sm text-primary/55">
              Send a time-limited invitation. At least one Owner must remain
              active ({activeOwners} now).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen((v) => !v)}
            className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
          >
            {inviteOpen ? "Close" : "Invite teammate"}
          </button>
        </div>

        {inviteOpen ? (
          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              run(() =>
                createAdminInvitationAction({
                  email: inviteEmail,
                  role: inviteRole,
                  expiryHours: inviteExpiry,
                })
              );
            }}
          >
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-primary/50">
                Email
              </span>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded-xl border border-primary/15 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
                placeholder="name@example.com"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-primary/50">
                Role
              </span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as AdminRole)}
                className="w-full rounded-xl border border-primary/15 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
              >
                {ADMIN_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-sm leading-6 text-primary/55">
                {ROLE_DESCRIPTIONS[inviteRole]}
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-primary/50">
                Expires in
              </span>
              <select
                value={inviteExpiry}
                onChange={(e) => setInviteExpiry(Number(e.target.value))}
                className="w-full rounded-xl border border-primary/15 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
              >
                {INVITATION_EXPIRY_OPTIONS_HOURS.map((hours) => (
                  <option key={hours} value={hours}>
                    {EXPIRY_LABELS[hours] ?? `${hours} hours`}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <MemberSection
        title="Active team"
        empty="No active team members."
        members={board.active}
        currentUserId={currentUserId}
        activeOwners={activeOwners}
        pending={pending}
        onChangeRole={(userId, newRole) => {
          if (
            !window.confirm(
              `Change this member's role to ${ROLE_LABELS[newRole]}?`
            )
          ) {
            return;
          }
          run(() => changeAdminMemberRoleAction({ userId, newRole }));
        }}
        onSuspend={(userId) => {
          if (!window.confirm("Suspend this team member's admin access?")) {
            return;
          }
          run(() => suspendAdminMemberAction(userId));
        }}
        onRevoke={(userId) => {
          if (
            !window.confirm(
              "Revoke this team member permanently? They will need a new invitation."
            )
          ) {
            return;
          }
          run(() => revokeAdminMemberAction(userId));
        }}
      />

      <InvitationSection
        title="Pending invitations"
        empty="No pending invitations."
        invitations={board.pendingInvitations}
        pending={pending}
        showActions
        onCancel={(id) => {
          if (!window.confirm("Cancel this invitation?")) return;
          run(() => cancelAdminInvitationAction(id));
        }}
        onResend={(id) => {
          if (
            !window.confirm(
              "Rotate the invitation token and send a new email to this address?"
            )
          ) {
            return;
          }
          run(() => resendAdminInvitationAction(id));
        }}
      />

      {board.suspended.length > 0 ? (
        <MemberSection
          title="Suspended"
          empty=""
          members={board.suspended}
          currentUserId={currentUserId}
          activeOwners={activeOwners}
          pending={pending}
          onReactivate={(userId) => {
            run(() => reactivateAdminMemberAction(userId));
          }}
          onRevoke={(userId) => {
            if (!window.confirm("Revoke this suspended member?")) return;
            run(() => revokeAdminMemberAction(userId));
          }}
        />
      ) : null}

      <InvitationSection
        title="Past invitations"
        empty="No past invitations."
        invitations={board.pastInvitations.slice(0, 40)}
        pending={pending}
      />

      {board.revoked.length > 0 ? (
        <MemberSection
          title="Revoked"
          empty=""
          members={board.revoked}
          currentUserId={currentUserId}
          activeOwners={activeOwners}
          pending={pending}
        />
      ) : null}
    </div>
  );
}

function MemberSection({
  title,
  empty,
  members,
  currentUserId,
  activeOwners,
  pending,
  onChangeRole,
  onSuspend,
  onRevoke,
  onReactivate,
}: {
  title: string;
  empty: string;
  members: TeamMember[];
  currentUserId: string;
  activeOwners: number;
  pending: boolean;
  onChangeRole?: (userId: string, role: AdminRole) => void;
  onSuspend?: (userId: string) => void;
  onRevoke?: (userId: string) => void;
  onReactivate?: (userId: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl">{title}</h2>
      {members.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-primary/20 bg-white p-8 text-center text-sm text-primary/55">
          {empty}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-primary/10 bg-surface text-xs uppercase tracking-wide text-primary/60">
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                const isSoleOwner =
                  member.role === "owner" &&
                  member.status === "active" &&
                  activeOwners <= 1;
                return (
                  <tr
                    key={member.userId}
                    className="border-b border-primary/5 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-primary">
                        {member.fullName || "Unnamed admin"}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-medium text-primary/45">
                            you
                          </span>
                        ) : null}
                      </p>
                      <p className="text-primary/55">
                        {member.email || member.userId.slice(0, 8)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {onChangeRole && member.status === "active" ? (
                        <select
                          disabled={pending || isSoleOwner}
                          value={member.role}
                          onChange={(e) =>
                            onChangeRole(
                              member.userId,
                              e.target.value as AdminRole
                            )
                          }
                          className="rounded-lg border border-primary/15 px-2 py-1.5 text-sm disabled:opacity-60"
                          title={
                            isSoleOwner
                              ? "At least one active Owner is required."
                              : undefined
                          }
                        >
                          {ADMIN_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        ROLE_LABELS[member.role]
                      )}
                      {isSoleOwner ? (
                        <p className="mt-1 text-xs text-primary/45">
                          Sole owner — protected
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <AdminBadge tone={statusTone(member.status)}>
                        {member.status}
                      </AdminBadge>
                    </td>
                    <td className="px-4 py-3 text-primary/70">
                      {formatDate(member.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {onReactivate ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => onReactivate(member.userId)}
                            className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        ) : null}
                        {onSuspend && member.status === "active" ? (
                          <button
                            type="button"
                            disabled={pending || isSoleOwner}
                            onClick={() => onSuspend(member.userId)}
                            className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                            title={
                              isSoleOwner
                                ? "At least one active Owner is required."
                                : undefined
                            }
                          >
                            Suspend
                          </button>
                        ) : null}
                        {onRevoke ? (
                          <button
                            type="button"
                            disabled={pending || isSoleOwner}
                            onClick={() => onRevoke(member.userId)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                            title={
                              isSoleOwner
                                ? "At least one active Owner is required."
                                : undefined
                            }
                          >
                            Revoke
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function emailDeliveryTone(
  status: Invitation["lastEmailStatus"]
): "neutral" | "warn" | "ok" | "bad" {
  if (status === "sent") return "ok";
  if (status === "failed") return "bad";
  if (status === "pending") return "warn";
  return "neutral";
}

function InvitationSection({
  title,
  empty,
  invitations,
  pending,
  showActions,
  onCancel,
  onResend,
}: {
  title: string;
  empty: string;
  invitations: Invitation[];
  pending: boolean;
  showActions?: boolean;
  onCancel?: (id: string) => void;
  onResend?: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl">{title}</h2>
      {invitations.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-primary/20 bg-white p-8 text-center text-sm text-primary/55">
          {empty}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-primary/10 bg-surface text-xs uppercase tracking-wide text-primary/60">
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Invitation</th>
                <th className="px-4 py-3 font-semibold">Email delivery</th>
                <th className="px-4 py-3 font-semibold">Expires / sent</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {invitations.map((invite) => (
                <tr
                  key={invite.id}
                  className="border-b border-primary/5 last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-primary">{invite.email}</p>
                    <p className="text-xs text-primary/45">
                      Invited by {invite.invitedByName || "admin"}
                    </p>
                  </td>
                  <td className="px-4 py-3">{ROLE_LABELS[invite.role]}</td>
                  <td className="px-4 py-3">
                    <AdminBadge tone={statusTone(invite.status)}>
                      {invite.status}
                    </AdminBadge>
                  </td>
                  <td className="px-4 py-3">
                    <AdminBadge tone={emailDeliveryTone(invite.lastEmailStatus)}>
                      {invitationEmailStatusLabel(invite.lastEmailStatus)}
                    </AdminBadge>
                    {invite.lastEmailStatus === "failed" &&
                    invite.lastEmailErrorCode ? (
                      <p className="mt-1 text-xs text-red-700">
                        {invite.lastEmailErrorCode.replaceAll("_", " ")}
                      </p>
                    ) : null}
                    {invite.sendCount > 0 ? (
                      <p className="mt-1 text-xs text-primary/45">
                        {invite.sendCount} send
                        {invite.sendCount === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-primary/70">
                    {invite.status === "pending" ? (
                      <>
                        <p>Expires {formatDate(invite.expiresAt)}</p>
                        {invite.lastSentAt ? (
                          <p className="mt-1 text-xs text-primary/45">
                            Last sent {formatDate(invite.lastSentAt)}
                          </p>
                        ) : invite.lastSendAttemptAt ? (
                          <p className="mt-1 text-xs text-primary/45">
                            Last attempt {formatDate(invite.lastSendAttemptAt)}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      formatDate(invite.updatedAt)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {showActions ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onResend?.(invite.id)}
                          className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        >
                          {invite.lastEmailStatus === "failed"
                            ? "Retry email"
                            : "Resend"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onCancel?.(invite.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
