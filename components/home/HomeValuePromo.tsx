import Link from "next/link";
import { Award, Plane, Trophy } from "lucide-react";

const BLOCKS = [
  {
    id: "top-venues",
    titleLine1: "Top",
    titleLine2: "venues",
    body: "Discover trusted clubs, courts and academies near you.",
    href: "/venues",
    icon: Trophy,
    className: "bg-card text-white",
    iconClassName: "text-accent",
  },
  {
    id: "elite-coaches",
    titleLine1: "Elite",
    titleLine2: "Coaches",
    body: "Compare coaching levels, prices, locations and styles.",
    href: "/coaches",
    icon: Award,
    className: "bg-accent text-primary",
    iconClassName: "text-primary",
  },
  {
    id: "travel-play",
    titleLine1: "Travel &",
    titleLine2: "play",
    body: "Find padel camps and destination venues abroad.",
    href: "#destinations",
    icon: Plane,
    className: "bg-card text-white",
    iconClassName: "text-accent",
  },
] as const;

export default function HomeValuePromo() {
  return (
    <section className="bg-dark py-16 sm:py-24">
      <div className="mx-auto flex max-w-[1366px] flex-col gap-6 px-4 sm:px-6 lg:flex-row">
        {BLOCKS.map((block) => {
          const Icon = block.icon;
          return (
            <Link
              key={block.id}
              href={block.href}
              className={`flex min-h-[280px] flex-1 flex-col gap-4 rounded-[20px] p-9 transition hover:brightness-[1.02] ${block.className}`}
            >
              <Icon className={`h-8 w-8 ${block.iconClassName}`} aria-hidden />
              <div className="mt-auto space-y-8">
                <h3 className={` font-heading text-4xl font-bold leading-[52px] sm:text-[48px] ${
                    block.className.includes("bg-accent") ? "text-primary" : "text-muted"
                  }`}>
                  {block.titleLine1}
                  <br />
                  {block.titleLine2}
                </h3>
                <p
                  className={`text-lg leading-7 ${
                    block.className.includes("bg-accent") ? "text-primary" : "text-muted"
                  }`}
                >
                  {block.body}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
