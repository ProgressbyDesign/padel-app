"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { linkCoachVenuesAdmin, searchVenuesAdminAction } from "@/app/actions/admin";
import type { CoachForLinking } from "@/lib/admin/types";
import { AdminBadge, AdminButton, AdminCard, AdminInput } from "./ui";

export default function CoachVenueLinker({ coaches }: { coaches: CoachForLinking[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [manualSearch, setManualSearch] = useState<Record<string, string>>({});
  const [manualHits, setManualHits] = useState<
    Record<string, { id: string; name: string; city: string | null; country: string | null; website: string | null }[]>
  >({});

  function toggle(coachId: string, venueId: string) {
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[coachId] ?? []);
      if (set.has(venueId)) set.delete(venueId);
      else set.add(venueId);
      next[coachId] = set;
      return next;
    });
  }

  function saveLinks(coachId: string) {
    const ids = [...(selected[coachId] ?? [])];
    if (ids.length === 0) {
      setError("Select at least one venue.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await linkCoachVenuesAdmin(coachId, ids, ids[0] ?? null);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  async function searchForCoach(coachId: string) {
    const term = manualSearch[coachId] ?? "";
    const res = await searchVenuesAdminAction(term);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setManualHits((prev) => ({ ...prev, [coachId]: res.venues }));
  }

  if (coaches.length === 0) {
    return <p className="text-sm text-primary/60">No unlinked coaches match this filter.</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {coaches.map((coach) => {
        const picked = selected[coach.id] ?? new Set<string>();
        const hits = manualHits[coach.id] ?? [];
        return (
          <AdminCard key={coach.id}>
            <div className="flex flex-wrap gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-primary/5">
                {coach.image_url ? (
                  <Image src={coach.image_url} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-primary/40">No img</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-primary">{coach.name ?? "Unnamed coach"}</h3>
                <p className="text-xs text-primary/60">
                  {[coach.email, coach.phone].filter(Boolean).join(" · ") || "No contact"}
                </p>
                {coach.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-primary/70">{coach.description}</p>
                ) : null}
              </div>
            </div>

            {coach.suggestions.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase text-primary/50">Suggestions</p>
                <ul className="space-y-2">
                  {coach.suggestions.map((s) => (
                    <li key={`${s.venueId}-${s.reason}`} className="flex flex-wrap items-center gap-2 text-sm">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={picked.has(s.venueId)}
                          onChange={() => toggle(coach.id, s.venueId)}
                        />
                        <span className="font-medium">{s.venueName}</span>
                      </label>
                      <AdminBadge tone="warn">{s.reasonLabel}</AdminBadge>
                      {s.website ? (
                        <span className="text-xs text-primary/50">{s.website}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-sm text-primary/50">No automatic suggestions.</p>
            )}

            <div className="mt-4 border-t border-primary/10 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-primary/50">Manual venue search</p>
              <div className="flex flex-wrap gap-2">
                <AdminInput
                  placeholder="Name, city, country, website…"
                  value={manualSearch[coach.id] ?? ""}
                  onChange={(e) => setManualSearch((p) => ({ ...p, [coach.id]: e.target.value }))}
                  className="max-w-sm flex-1"
                />
                <AdminButton type="button" variant="secondary" onClick={() => searchForCoach(coach.id)}>
                  Search
                </AdminButton>
              </div>
              {hits.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {hits.map((v) => (
                    <li key={v.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={picked.has(v.id)}
                          onChange={() => toggle(coach.id, v.id)}
                        />
                        {v.name}
                        {(v.city || v.country) && (
                          <span className="text-primary/50">
                            ({[v.city, v.country].filter(Boolean).join(", ")})
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <AdminButton
              type="button"
              className="mt-4"
              disabled={pending || picked.size === 0}
              onClick={() => saveLinks(coach.id)}
            >
              {pending ? "Saving…" : `Save ${picked.size} venue link(s)`}
            </AdminButton>
          </AdminCard>
        );
      })}
    </div>
  );
}
