import Link from "next/link";
import { Compass, MessageCircle, Sparkles, UserRound } from "lucide-react";
import JoinTrustStrip from "@/components/join/JoinTrustStrip";
import PartnerBenefitsBento from "@/components/join/PartnerBenefitsBento";
import PartnerTypeCards from "@/components/join/PartnerTypeCards";

const HERO_BENEFITS = [
  {
    title: "Player discovery",
    copy: "Be found by players actively looking for coaching.",
    icon: Compass,
  },
  {
    title: "A professional profile",
    copy: "Present coaching, location, experience and services clearly.",
    icon: UserRound,
  },
  {
    title: "Qualified enquiries",
    copy: "Interest comes through the Padel Pathways journey, not only social DMs.",
    icon: MessageCircle,
  },
  {
    title: "Grow with your players",
    copy: "Padel Pathways is being built around longer-term player development.",
    icon: Sparkles,
  },
] as const;

export default function PartnerJoinLanding({
  authenticated,
}: {
  authenticated: boolean;
}) {
  return (
    <div className="bg-surface">
      <section className="border-b border-primary/10 bg-gradient-to-b from-white to-surface">
        <div className="mx-auto grid max-w-[1366px] items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
              For coaches &amp; padel businesses
            </p>
            <h1 className="mt-4 max-w-xl font-heading text-4xl font-bold tracking-tight text-primary sm:text-5xl">
              Put your coaching in front of players looking to improve.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-primary/70">
              Padel Pathways connects players with coaches and training
              providers based on their goals, level and where they want to play.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#partner-types"
                data-cta="partner-hero-selection"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-accent transition hover:bg-primary/90"
              >
                Join Padel Pathways
              </a>
              <Link
                href="/login"
                data-cta="partner-hero-login"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-primary/15 bg-white px-6 text-sm font-semibold text-primary transition hover:bg-surface"
              >
                Already a partner? Log in
              </Link>
            </div>
            <p className="mt-5 text-sm text-primary/60">
              Looking to play?{" "}
              <Link
                href="/join/player"
                data-cta="partner-to-player"
                className="font-semibold text-primary underline underline-offset-4"
              >
                Create a player account
              </Link>
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {HERO_BENEFITS.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.title}
                  className="flex gap-4 rounded-[20px] border border-primary/10 bg-white p-4 shadow-[0_8px_24px_rgba(3,19,34,0.04)]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent">
                    <Icon className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-primary/65">{item.copy}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <PartnerTypeCards authenticated={authenticated} />
      <PartnerBenefitsBento />
      <JoinTrustStrip />
    </div>
  );
}
