import Image from "next/image";
import Link from "next/link";
import {
  partnerLoginHref,
  partnerSignupHref,
  COACH_APPLICATION_PATH,
  VENUE_APPLICATION_PATH,
} from "@/lib/join/nav";

const COACH_IMAGE = "/images/bento-coach-cutout.jpg";
const VENUE_IMAGE = "/images/hero-padel-overlay.jpg";

export default function PartnerTypeCards({
  authenticated,
}: {
  authenticated: boolean;
}) {
  const coachHref = partnerSignupHref(COACH_APPLICATION_PATH, authenticated);
  const venueHref = partnerSignupHref(VENUE_APPLICATION_PATH, authenticated);

  return (
    <section
      id="partner-types"
      className="scroll-mt-24 bg-surface py-16 sm:py-20"
      aria-labelledby="partner-types-heading"
    >
      <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/45">
          Choose how you join
        </p>
        <h2
          id="partner-types-heading"
          className="mt-3"
        >
          Individual coaches, academies and venues.
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-primary/65">
          Apply with the path that matches how you work. Travel partner
          applications are coming soon.
        </p>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <PartnerTypeCard
            image={COACH_IMAGE}
            status="Available now"
            title="Individual coach"
            description="Apply with your coaching profile. Progress saves to your account so you can finish on any device."
            href={coachHref}
            cta={authenticated ? "Continue application" : "Apply as a coach"}
            ctaKind="join-coach-application"
            loginHref={authenticated ? null : partnerLoginHref(COACH_APPLICATION_PATH)}
            imagePosition="object-top"
          />
          <PartnerTypeCard
            image={VENUE_IMAGE}
            status="Available now"
            title="Academy / Venue"
            description="Register a venue or academy you own, manage, or are authorised to represent. Coaches who only coach at a venue should use the individual coach application."
            href={venueHref}
            cta={
              authenticated
                ? "Continue venue application"
                : "Register your venue / academy"
            }
            ctaKind="join-venue-application"
            loginHref={authenticated ? null : partnerLoginHref(VENUE_APPLICATION_PATH)}
          />
          <article className="flex h-full flex-col overflow-hidden rounded-[24px] border border-primary/10 bg-white shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
            <div className="relative h-40 bg-gradient-to-br from-secondary via-surface to-primary/20">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(205,231,54,0.35),transparent_55%)]" />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                Coming soon
              </p>
              <h3 className="mt-3 text-xl text-primary">Travel Partner</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-primary/65">
                Travel and holiday packages will get a dedicated partner journey.
                This is not the individual coach application.
              </p>
              <span className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-surface px-4 py-2.5 text-sm font-semibold text-primary/55">
                Coming soon
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function PartnerTypeCard({
  image,
  status,
  title,
  description,
  href,
  cta,
  ctaKind,
  loginHref,
  imagePosition = "object-center",
}: {
  image: string;
  status: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  ctaKind: string;
  loginHref: string | null;
  imagePosition?: string;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[24px] border border-primary/10 bg-white shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
      <div className="relative h-40">
        <Image
          src={image}
          alt=""
          fill
          className={`object-cover ${imagePosition}`}
          sizes="(max-width: 1024px) 100vw, 33vw"
        />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
          {status}
        </p>
        <h3 className="mt-3 text-xl text-primary">{title}</h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-primary/65">{description}</p>
        <Link
          href={href}
          data-cta={ctaKind}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
        >
          {cta}
        </Link>
        {loginHref ? (
          <p className="mt-3 text-xs text-primary/55">
            Already have an account?{" "}
            <Link href={loginHref} className="font-semibold text-primary underline">
              Log in
            </Link>
          </p>
        ) : null}
      </div>
    </article>
  );
}
