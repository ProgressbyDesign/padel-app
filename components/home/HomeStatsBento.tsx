import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { HomeStats } from "@/lib/queries/homeStats";

type HomeStatsBentoProps = {
  stats: HomeStats;
};

function formatStat(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export default function HomeStatsBento({ stats }: HomeStatsBentoProps) {
  const tiles = [
    {
      label: "Coaches listed",
      value: formatStat(stats.coachesListed),
      sub: "Verified profiles worldwide",
      className: "md:col-span-2 md:row-span-2",
      accent: true,
    },
    {
      label: "Venues",
      value: formatStat(stats.locationsAvailable),
      sub: "Courts & academies",
      className: "md:col-span-2",
      accent: false,
    },
    {
      label: "Countries",
      value: formatStat(stats.countriesCovered),
      sub: "Train abroad",
      className: "",
      accent: false,
    },
    {
      label: "Enquiries",
      value: formatStat(stats.enquiriesCompleted),
      sub: stats.enquiriesCompleted != null ? "Players matched" : "Growing weekly",
      className: "md:col-span-2",
      accent: false,
    },
  ] as const;

  return (
    <section className="border-b border-primary/10 bg-dark py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Platform pulse</p>
            <h2 className="mt-2 text-white">
              Padel Pathways by the numbers
            </h2>
          </div>
          <Link
            href="/venues"
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:text-white"
          >
            Explore venues
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:grid-rows-2">
          {tiles.map((t) => (
            <div
              key={t.label}
              className={[
                "flex flex-col justify-between rounded-2xl border p-5 sm:p-6",
                t.accent
                  ? "border-accent/30 bg-gradient-to-br from-primary/80 to-dark md:min-h-[220px]"
                  : "border-white/10 bg-white/[0.04]",
                t.className,
              ].join(" ")}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{t.label}</p>
              <div className="mt-4">
                <p
                  className={[
                    "font-semibold tabular-nums tracking-tight text-white",
                    t.accent ? "text-4xl sm:text-5xl md:text-6xl" : "text-3xl sm:text-4xl",
                  ].join(" ")}
                >
                  {t.value}
                </p>
                <p className="mt-2 text-xs text-white/55 sm:text-sm">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
