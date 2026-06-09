import type { HomeStats } from "../LandingPage";

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
      <div className="mx-auto flex max-w-[1680px] flex-col items-center justify-center gap-12 px-4 sm:flex-row sm:gap-16 lg:gap-28 lg:px-[120px]">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-4 text-center text-primary">
            <p className="font-heading text-5xl font-bold leading-none sm:text-[64px]">{item.value}</p>
            <p className="max-w-[220px] text-base font-bold uppercase tracking-[0.8px]">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}