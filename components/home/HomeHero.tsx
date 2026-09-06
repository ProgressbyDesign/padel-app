import Image from "next/image";
import HomeHeroVideo from "@/components/home/HomeHeroVideo";
import HomeStickySearch from "@/components/search/HomeStickySearch";
import { HERO_POSTER_SRC, HERO_VIDEO_SRC } from "@/lib/home/heroMedia";

export default function HomeHero() {
  return (
    <section className="relative -mt-16 min-h-[min(88vh,815px)] overflow-hidden">
      <Image
        src={HERO_POSTER_SRC}
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      {HERO_VIDEO_SRC ? (
        <HomeHeroVideo src={HERO_VIDEO_SRC} poster={HERO_POSTER_SRC} />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(119.61deg, rgba(0, 36, 54, 0.8) 39.53%, rgba(0, 36, 54, 0.3) 76.64%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-[min(88vh,815px)] max-w-[1680px] flex-col justify-center px-4 pb-20 pt-28 sm:px-6 sm:pb-24">
        <h1 className="mx-auto max-w-4xl text-center text-white drop-shadow-sm">
          Train with some of the world&apos;s most trusted padel coaches.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-center text-lg text-white/90 sm:text-xl">
          Book with confidence through the Padel Pathways 5★ Experience Guarantee.
        </p>
        <div className="mt-10 sm:mt-12">
          <HomeStickySearch />
        </div>
      </div>
    </section>
  );
}
