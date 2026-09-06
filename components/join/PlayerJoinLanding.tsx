import Image from "next/image";
import Link from "next/link";
import PlayerBenefitsBento from "@/components/join/PlayerBenefitsBento";
import PlayerSignupSection from "@/components/join/PlayerSignupSection";

const HERO_IMAGE = "/images/hero-padel-overlay.jpg";

export default function PlayerJoinLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="bg-surface">
      <section className="relative overflow-hidden border-b border-primary/10">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(118deg, rgba(3,19,34,0.88) 32%, rgba(3,19,34,0.45) 78%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1366px] px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            For players
          </p>
          <h1 className="mt-4 max-w-3xl text-white">
            Your padel journey, in one place.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-white/85">
            Find coaching that fits your goals, discover where to train and keep
            your Padel Pathways activity together as your game develops.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#register"
              data-cta="player-hero-register"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-primary transition hover:bg-accent-soft"
            >
              Create free account
            </a>
            <Link
              href="/coaches"
              data-cta="player-hero-coaches"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              Explore coaches
            </Link>
          </div>
          <p className="mt-5 text-sm text-white/70">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-white underline underline-offset-4">
              Log in
            </Link>
          </p>
        </div>
      </section>

      <PlayerBenefitsBento />
      <PlayerSignupSection signedIn={signedIn} />
    </div>
  );
}
