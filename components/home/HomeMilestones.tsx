import type { HomeStats } from "@/lib/queries/homeStats";

type HomeMilestonesProps = {
  stats: HomeStats;
};

function formatStat(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export default function HomeMilestones({ stats }: HomeMilestonesProps) {
  const items = [
    { value: formatStat(stats.coachesListed), label: "Verified coaches" },
    { value: formatStat(stats.locationsAvailable), label: "Courts & academies" },
    { value: formatStat(stats.countriesCovered), label: "Travel destinations" },
  ] as const;

  return (
    <section className="bg-accent py-14 sm:py-16">
      <div className="mx-auto grid max-w-[1680px] grid-cols-1 items-center justify-center gap-10 px-4 md:grid-cols-3 md:gap-12 lg:gap-20 lg:px-[120px]">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-3 text-center text-primary sm:gap-4">
            <p className="font-heading text-5xl font-bold leading-none sm:text-[56px] lg:text-[64px]">{item.value}</p>
            <p className="max-w-[14rem] text-sm font-bold uppercase tracking-[0.8px] sm:text-base">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}