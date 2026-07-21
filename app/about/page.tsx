import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Compass,
  MessageCircle,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import HomeMilestones from "@/components/home/HomeMilestones";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Discover how Padel Pathways helps players find trusted coaches and develop with confidence.",
};

const ABOUT_STATS = {
  coachesListed: 56,
  locationsAvailable: 580,
  countriesCovered: 9,
  enquiriesCompleted: null,
} as const;

const WHY_CARDS = [
  {
    eyebrow: "01",
    title: "The problem",
    copy: "Finding the right coach is often based on guesswork, scattered recommendations and hours of research.",
    tone: "light",
  },
  {
    eyebrow: "02",
    title: "The solution",
    copy: "We research, review and connect players with trusted coaches who match their goals.",
    tone: "accent",
  },
  {
    eyebrow: "03",
    title: "The outcome",
    copy: "Players can invest in their development with more confidence from the first enquiry.",
    tone: "dark",
  },
] as const;

const PROMISE_CARDS: {
  title: string;
  copy: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Trusted coaches",
    copy: "Carefully selected for quality, professionalism and player care.",
    icon: ShieldCheck,
  },
  {
    title: "Clear pathways",
    copy: "Find coaching that matches your level, goals and playing ambitions.",
    icon: Compass,
  },
  {
    title: "Confidence before you book",
    copy: "Reduce the guesswork and choose with more certainty.",
    icon: SearchCheck,
  },
];

const EXPERIENCE_CARDS: {
  title: string;
  copy: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Carefully selected coaches",
    copy: "We work with coaches and academies who meet our standards.",
    icon: CheckCircle2,
  },
  {
    title: "Player-first experience",
    copy: "We focus on clear communication, suitable recommendations and trusted support.",
    icon: MessageCircle,
  },
  {
    title: "Ongoing improvement",
    copy: "We are building a platform designed to help players develop beyond a single lesson.",
    icon: TrendingUp,
  },
];

function CtaLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "light";
}) {
  const styles = {
    primary: "bg-accent text-primary hover:bg-accent-soft",
    secondary:
      "border border-white/25 bg-white/10 text-white hover:bg-white/15",
    light: "bg-white text-primary hover:bg-white/90",
  } as const;

  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition ${styles[variant]}`}
    >
      {children}
      <ArrowUpRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  intro,
  light = false,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  light?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <p
        className={`text-sm font-bold uppercase tracking-[0.16em] ${
          light ? "text-accent" : "text-primary/50"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 text-3xl leading-tight sm:text-4xl lg:text-5xl ${
          light ? "text-white" : "text-primary"
        }`}
      >
        {title}
      </h2>
      {intro ? (
        <p
          className={`mt-5 text-lg leading-8 ${
            light ? "text-white/70" : "text-primary/65"
          }`}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="overflow-hidden bg-surface">
      <section className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6 lg:px-8">
        <div className="relative mx-auto flex min-h-[650px] max-w-[1680px] overflow-hidden rounded-[28px] bg-primary">
          <Image
            src="/images/hero-padel-overlay.jpg"
            alt=""
            fill
            priority
            className="object-cover object-center"
            sizes="(max-width: 1728px) 100vw, 1680px"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(105deg,rgba(2,16,16,0.94)_12%,rgba(3,19,34,0.76)_55%,rgba(3,19,34,0.28)_100%)]"
            aria-hidden
          />
          <div className="relative z-10 flex w-full items-end px-5 py-10 sm:px-10 sm:py-14 lg:px-20 lg:py-20">
            <div className="max-w-5xl">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-accent backdrop-blur-sm">
                About Padel Pathways
              </span>
              <h1 className="mt-6 max-w-5xl text-5xl leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl md:text-7xl lg:text-[76px]">
                Building the future of player development
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/80 sm:text-xl">
                Padel Pathways connects players with trusted, carefully selected
                coaches who can help them improve with confidence — wherever
                they are on their journey.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <CtaLink href="/coaches">Find your coach</CtaLink>
                <CtaLink href="/join" variant="secondary">
                  Become a Padel Pathways Coach
                </CtaLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HomeMilestones stats={ABOUT_STATS} />

      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <div className="mx-auto grid max-w-[1680px] gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-[120px]">
          <div>
            <SectionHeading
              eyebrow="Our story"
              title="Built by players, coaches and people who know the journey"
            />
            <div className="mt-7 max-w-3xl space-y-5 text-base leading-7 text-primary/70 sm:text-lg sm:leading-8">
              <p>
                Padel Pathways was created by people who have experienced every
                stage of the padel journey: passionate beginners, experienced
                coaches, former World Padel Tour players and top UK competitors.
              </p>
              <p>
                Despite our different levels and ambitions, we all faced the
                same challenge. Finding coaching that truly matched our goals,
                playing level and aspirations was harder than it should be.
              </p>
              <p>
                Too often, players spend hours researching coaches, comparing
                academies and hoping they have made the right choice. Finding
                great coaching should not be based on guesswork.
              </p>
              <p className="font-heading text-2xl font-bold text-primary">
                So we built a better way.
              </p>
            </div>
          </div>

          <div className="relative min-h-[480px] overflow-hidden rounded-[28px] bg-card sm:min-h-[600px]">
            <Image
              src="/images/testimonial-2.jpg"
              alt="Padel player enjoying time on court"
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 44vw"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-primary via-primary/20 to-transparent"
              aria-hidden
            />
            <div className="absolute inset-x-5 bottom-5 rounded-[20px] border border-white/15 bg-primary/90 p-6 backdrop-blur-md sm:inset-x-8 sm:bottom-8 sm:p-8">
              <Sparkles className="h-7 w-7 text-accent" aria-hidden />
              <p className="mt-5 font-heading text-2xl font-bold leading-tight text-white sm:text-3xl">
                A clearer route to coaching that fits you.
              </p>
              <p className="mt-3 text-base leading-7 text-white/65">
                Built around player goals, trusted relationships and long-term
                progress.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-primary/10 bg-surface py-16 sm:py-20">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-[120px]">
          <SectionHeading
            eyebrow="A better way"
            title="Why Padel Pathways exists"
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {WHY_CARDS.map((card) => {
              const cardStyles =
                card.tone === "accent"
                  ? "bg-accent text-primary"
                  : card.tone === "dark"
                    ? "bg-primary text-white"
                    : "border border-primary/10 bg-white text-primary";
              const mutedStyles =
                card.tone === "dark" ? "text-white/65" : "text-primary/60";

              return (
                <article
                  key={card.title}
                  className={`flex min-h-[280px] flex-col justify-between rounded-[24px] p-7 sm:p-8 ${cardStyles}`}
                >
                  <span
                    className={`text-sm font-bold tracking-[0.16em] ${
                      card.tone === "dark" ? "text-accent" : "text-primary/45"
                    }`}
                  >
                    {card.eyebrow}
                  </span>
                  <div className="mt-12">
                    <h3
                      className={`text-2xl font-bold ${
                        card.tone === "dark" ? "text-white" : "text-primary"
                      }`}
                    >
                      {card.title}
                    </h3>
                    <p className={`mt-3 text-lg leading-7 ${mutedStyles}`}>
                      {card.copy}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-[1680px] gap-10 overflow-hidden rounded-[28px] bg-primary px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:px-20 lg:py-20">
          <div>
            <SectionHeading
              eyebrow="Our mission"
              title="The right coach can change your journey"
              light
            />
            <div className="mt-8">
              <CtaLink href="/coaches">Find your coach</CtaLink>
            </div>
          </div>
          <div className="space-y-5 text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
            <p className="text-xl font-semibold leading-8 text-white sm:text-2xl">
              Our mission is to become the most trusted platform for connecting
              padel players with the right coaches — close to home, across
              Europe and beyond.
            </p>
            <p>
              We build relationships with respected coaches, academies and
              training destinations, carefully selecting partners for their
              coaching quality, professionalism and player experience.
            </p>
            <p>
              Our role is simple: we do the research, build the relationships
              and give players the confidence to choose coaching that is right
              for them.
            </p>
            <p>
              Whether you are picking up a racket for the first time, preparing
              for competition or chasing your next level of performance, Padel
              Pathways helps you find the coach who can accelerate your journey.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-primary/10 bg-surface py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-[120px]">
          <SectionHeading
            eyebrow="Our standards"
            title="The Padel Pathways Promise"
            intro="Every player deserves access to exceptional coaching and a clear path to improvement. Every coach, academy and destination we recommend is carefully reviewed against our standards for quality, professionalism and player experience."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PROMISE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="rounded-[24px] border border-primary/10 bg-white p-7 shadow-[0_10px_30px_rgba(3,19,34,0.04)] sm:p-8"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-8 text-xl font-bold text-primary">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-primary/60">
                    {card.copy}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-[120px]">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16">
            <div>
              <span className="inline-flex rounded-full bg-accent px-4 py-2 text-sm font-bold uppercase tracking-[0.12em] text-primary">
                5★ Experience Guarantee
              </span>
              <h2 className="mt-5 text-3xl leading-tight text-primary sm:text-4xl lg:text-5xl">
                Book with confidence
              </h2>
              <p className="mt-5 text-lg leading-8 text-primary/65">
                The Padel Pathways 5★ Experience Guarantee is built around
                quality, communication and player satisfaction.
              </p>
            </div>
            <div className="grid gap-4">
              {EXPERIENCE_CARDS.map((card, index) => {
                const Icon = card.icon;
                return (
                  <article
                    key={card.title}
                    className="grid gap-5 rounded-[20px] border border-primary/10 bg-surface p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-accent">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-primary">
                        {card.title}
                      </h3>
                      <p className="mt-1 text-base leading-6 text-primary/60">
                        {card.copy}
                      </p>
                    </div>
                    <span className="hidden font-heading text-2xl font-bold text-primary/20 sm:block">
                      0{index + 1}
                    </span>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-primary px-4 py-16 text-white sm:px-6 sm:py-20 lg:py-24">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-end lg:gap-20">
          <div>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
              <Target className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-8 max-w-3xl text-4xl leading-[1.05] text-white sm:text-5xl lg:text-6xl">
              More than a lesson. A pathway.
            </h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-white/70">
            <p>
              Finding the right coach is only the beginning. Our vision is to
              create a connected coaching ecosystem where players and coaches
              can build lasting relationships, track progress and continue
              developing over time.
            </p>
            <p>
              As the sport grows, Padel Pathways is building towards a future
              where coaching, communication, performance and player development
              are seamlessly connected in one trusted platform.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-accent px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-accent">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-7 text-4xl leading-none text-primary sm:text-5xl lg:text-6xl">
              Own your path.
            </h2>
            <p className="mt-5 text-lg leading-8 text-primary/70">
              Find a certified coach who understands your level, your goals and
              where you want to go next.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <CtaLink href="/coaches" variant="light">
              Find your coach
            </CtaLink>
            <Link
              href="/join"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-accent transition hover:bg-primary/90"
            >
              Become a coach
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
