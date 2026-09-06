"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Circle,
} from "lucide-react";
import CompletionProgressRings from "@/components/account/CompletionProgressRings";
import {
  completionItemActionLabel,
  nextRecommendedCompletionItem,
  type CompletionGroup,
  type CompletionGroupScore,
  type CompletionItem,
} from "@/lib/coachProfileCompletion";

type CoachCompletionPanelProps = {
  overallPercent: number;
  groupScores: CompletionGroupScore[];
  groups: CompletionGroup[];
  items: CompletionItem[];
  completedWeighted: number;
  weightedTotal: number;
  improveHref?: string;
};

export default function CoachCompletionPanel({
  overallPercent,
  groupScores,
  groups,
  items,
  completedWeighted,
  weightedTotal,
  improveHref,
}: CoachCompletionPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const nextItem = nextRecommendedCompletionItem(items);
  const nextHref = nextItem?.href ?? improveHref ?? "#";

  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
      <div>
        <h2 className="text-2xl text-primary">Profile completeness</h2>
        <p className="mt-1 text-sm text-primary/60">
          Focus on essential details first, then trust signals and booking
          readiness. This is not a search ranking score.
        </p>
      </div>

      <div className="mt-6">
        <CompletionProgressRings
          overallPercent={overallPercent}
          groupScores={groupScores}
        />
      </div>

      <p className="mt-6 text-sm font-semibold text-primary">
        {completedWeighted} of {weightedTotal} core items complete
      </p>

      {nextItem ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-surface px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Next recommended
            </p>
            <p className="mt-1 text-sm font-semibold text-primary">
              {completionItemActionLabel(nextItem)}
            </p>
          </div>
          <Link
            href={nextHref}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
          >
            Improve profile
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-sm font-semibold text-emerald-800">
          Core profile items look complete.
        </p>
      )}

      <div className="mt-5">
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/15 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surface"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide completion details" : "View completion details"}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      {expanded ? (
        <div id={detailsId} className="mt-6 space-y-6">
          {groups.map((group) => (
            <div key={group.id}>
              <h3 className="text-sm font-semibold tracking-[0.12em] text-primary/45">
                {group.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 rounded-2xl border border-primary/10 px-4 py-3 transition hover:bg-surface"
                    >
                      {item.done ? (
                        <CheckCircle2
                          className="h-5 w-5 shrink-0 text-emerald-600"
                          aria-hidden
                        />
                      ) : (
                        <Circle
                          className="h-5 w-5 shrink-0 text-primary/30"
                          aria-hidden
                        />
                      )}
                      <span className="flex-1 text-sm font-semibold text-primary">
                        {item.label}
                      </span>
                      <ArrowRight
                        className="h-4 w-4 text-primary/40"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <button
            type="button"
            className="text-sm font-semibold text-primary/70 transition hover:text-primary"
            onClick={() => setExpanded(false)}
          >
            Collapse details
          </button>
        </div>
      ) : null}
    </section>
  );
}
