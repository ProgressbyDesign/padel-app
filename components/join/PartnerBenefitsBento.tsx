import Image from "next/image";
import Link from "next/link";
import { Eye, Layers3, MapPin, Search, Users } from "lucide-react";

const COACH_IMAGE = "/images/bento-coach-cutout.jpg";

export default function PartnerBenefitsBento() {
  return (
    <section className="bg-dark py-16 sm:py-24" aria-labelledby="partner-benefits-heading">
      <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent/80">
          For coaches and venues
        </p>
        <h2
          id="partner-benefits-heading"
          className="mt-3 max-w-2xl font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl"
        >
          Show your coaching where players are already looking.
        </h2>
        <p className="mt-3 max-w-xl text-base leading-7 text-white/65">
          A professional presence on Padel Pathways helps the right players find
          you — by goal, location and coaching style.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <article className="relative min-h-[260px] overflow-hidden rounded-[24px] bg-card md:col-span-2">
            <Image
              src={COACH_IMAGE}
              alt=""
              fill
              className="object-cover object-top opacity-40"
              sizes="(max-width: 1024px) 100vw, 66vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-transparent" />
            <div className="relative z-10 flex h-full flex-col justify-end p-8">
              <Search className="h-7 w-7 text-accent" aria-hidden />
              <h3 className="mt-4 font-heading text-3xl font-bold uppercase text-white">
                Be discovered
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">
                Players search coaching by location, level and goals. A clear
                profile makes you easier to find.
              </p>
            </div>
          </article>

          <article className="flex min-h-[260px] flex-col justify-between rounded-[24px] bg-accent p-8">
            <Eye className="h-7 w-7 text-primary" aria-hidden />
            <div>
              <h3 className="font-heading text-2xl font-bold uppercase text-primary">
                Show your experience
              </h3>
              <p className="mt-2 text-sm leading-6 text-primary/75">
                Present coaching, locations, outcomes and imagery once you are
                approved.
              </p>
            </div>
          </article>

          <article className="flex min-h-[220px] flex-col justify-between rounded-[24px] bg-[#aed4e8] p-8">
            <Users className="h-7 w-7 text-primary" aria-hidden />
            <div>
              <h3 className="font-heading text-xl font-bold uppercase text-primary">
                Connect with the right players
              </h3>
              <p className="mt-2 text-sm leading-6 text-primary/75">
                Interest comes through Padel Pathways instead of relying only on
                social messages.
              </p>
            </div>
          </article>

          <article className="flex min-h-[220px] flex-col justify-between rounded-[24px] bg-white p-8">
            <MapPin className="h-7 w-7 text-primary" aria-hidden />
            <div>
              <h3 className="font-heading text-xl font-bold uppercase text-primary">
                Coach + venue connections
              </h3>
              <p className="mt-2 text-sm leading-6 text-primary/70">
                Padel Pathways understands where coaches work and where players
                train.
              </p>
            </div>
          </article>

          <article className="flex min-h-[220px] flex-col justify-between rounded-[24px] border border-white/10 bg-card p-8">
            <Layers3 className="h-7 w-7 text-accent" aria-hidden />
            <div>
              <h3 className="font-heading text-xl font-bold uppercase text-white">
                Manage your presence
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Approved partners can manage their profile from their account.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
