import Link from "next/link";
import { ArrowRight, Globe2, Sparkles, Trophy, Users } from "lucide-react";

const BLOCKS = [
  {
    title: "Top venues",
    body: "Curated clubs and academies — indoor, outdoor, and resort destinations worth the trip.",
    href: "/venues",
    icon: Trophy,
    span: "md:col-span-2",
  },
  {
    title: "Elite coaches",
    body: "Compare levels, outcomes, and locations. Book with confidence before you fly.",
    href: "/coaches",
    icon: Users,
    span: "",
  },
  {
    title: "Premium training",
    body: "Structured programmes for adults and juniors — from first bandeja to tournament prep.",
    href: "/coaches",
    icon: Sparkles,
    span: "",
  },
  {
    title: "Travel & play",
    body: "Train abroad with honest locations and courts you can trust.",
    href: "#destinations",
    icon: Globe2,
    span: "md:col-span-2",
  },
] as const;

export default function HomeValuePromo() {
  return (
    <section className="border-b border-primary/10 bg-dark py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Why Padel Pathways</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Curated padel experiences — not another generic directory
        </h2>
        <p className="mt-3 max-w-xl text-sm text-white/65 sm:text-base">
          Trusted recommendations, premium training, and coaches linked to real venues.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {BLOCKS.map((b) => {
            const Icon = b.icon;
            return (
              <Link
                key={b.title}
                href={b.href}
                className={[
                  "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition",
                  "hover:border-accent/35 hover:bg-white/[0.06]",
                  b.span,
                ].join(" ")}
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/10 blur-2xl transition group-hover:bg-accent/20" />
                <Icon className="relative h-7 w-7 text-accent" aria-hidden />
                <h3 className="relative mt-4 text-lg font-semibold text-white">{b.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-white/65">{b.body}</p>
                <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                  Learn more
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
