"use client";

import { useState } from "react";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/permissions";

type AuditEvent = {
  id: string;
  actorRole: string | null;
  actorName: string | null;
  actionLabel: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
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

function roleLabel(role: string | null) {
  if (role && role in ROLE_LABELS) {
    return ROLE_LABELS[role as AdminRole];
  }
  return role || "—";
}

export default function AdminAuditPanel({
  events,
  actionOptions,
  isOwner,
  initial,
}: {
  events: AuditEvent[];
  actionOptions: { value: string; label: string }[];
  isOwner: boolean;
  initial: {
    actor: string;
    action: string;
    targetType: string;
    from: string;
    to: string;
  };
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <form className="rounded-2xl border border-primary/10 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-primary/50">
              Actor
            </span>
            <input
              name="actor"
              defaultValue={initial.actor}
              placeholder="Name or id"
              className="w-full rounded-xl border border-primary/15 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-primary/50">
              Action
            </span>
            <select
              name="action"
              defaultValue={initial.action}
              className="w-full rounded-xl border border-primary/15 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
            >
              <option value="">All actions</option>
              {actionOptions.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-primary/50">
              Target type
            </span>
            <input
              name="target_type"
              defaultValue={initial.targetType}
              placeholder="e.g. admin_invitation"
              className="w-full rounded-xl border border-primary/15 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-primary/50">
              From
            </span>
            <input
              type="date"
              name="from"
              defaultValue={initial.from}
              className="w-full rounded-xl border border-primary/15 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-primary/50">
              To
            </span>
            <input
              type="date"
              name="to"
              defaultValue={initial.to}
              className="w-full rounded-xl border border-primary/15 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            type="submit"
            className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
          >
            Apply filters
          </button>
        </div>
      </form>

      {events.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-primary/20 bg-white p-10 text-center text-sm text-primary/55">
          No audit events match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-primary/10 bg-surface text-xs uppercase tracking-wide text-primary/60">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Target</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const open = expanded === event.id;
                return (
                  <tr
                    key={event.id}
                    className="border-b border-primary/5 last:border-0 align-top"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-primary/70">
                      {formatDate(event.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-primary">
                        {event.actorName || "Unknown actor"}
                      </p>
                      <p className="text-xs text-primary/50">
                        {roleLabel(event.actorRole)}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      {event.actionLabel}
                    </td>
                    <td className="px-4 py-3 text-primary/70">
                      <span className="font-medium text-primary/80">
                        {event.targetType}
                      </span>
                      {event.targetId ? (
                        <span className="mt-0.5 block truncate text-xs text-primary/45">
                          {event.targetId}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isOwner && Object.keys(event.details).length > 0 ? (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded(open ? null : event.id)
                            }
                            className="text-xs font-semibold text-primary/60 hover:text-primary"
                          >
                            {open ? "Hide details" : "Details"}
                          </button>
                          {open ? (
                            <pre className="max-w-xs overflow-x-auto rounded-xl bg-surface px-3 py-2 text-left text-[11px] leading-4 text-primary/70">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-primary/35">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
