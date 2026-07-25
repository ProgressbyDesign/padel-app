"use client";
import ES from "country-flag-icons/react/3x2/ES";
import PT from "country-flag-icons/react/3x2/PT";
import IT from "country-flag-icons/react/3x2/IT";
import UK from "country-flag-icons/react/3x2/GB";
import BE from "country-flag-icons/react/3x2/BE";
import FR from "country-flag-icons/react/3x2/FR";
import SE from "country-flag-icons/react/3x2/SE";
import NL from "country-flag-icons/react/3x2/NL";
import DE from "country-flag-icons/react/3x2/DE";
import AE from "country-flag-icons/react/3x2/AE";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  countryCode,
  countryNavLabel,
  defaultActiveCountrySlug,
  sortCountriesForNav,
  type PadelCountry,
} from "@/lib/padelCountries";

const PadelGlobeGL = dynamic(() => import("../globe/PadelGlobeGL"), {
  ssr: false,
  loading: () => <GlobeSkeleton />,
});

const flagComponents = {
  ES,
  PT,
  IT,
  UK,
  BE,
  FR,
  SE,
  NL,
  DE,
  AE,
} as const;

function GlobeSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-48 w-[min(90vw,640px)] animate-pulse rounded-full bg-white/5 ring-1 ring-white/10 md:h-64" />
    </div>
  );
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

function useWebGLAvailable(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => {
      try {
        const canvas = document.createElement("canvas");
        const gl =
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl");
        return Boolean(gl);
      } catch {
        return false;
      }
    },
    () => true
  );
}

type Props = { countries: PadelCountry[] };

function CountryNavOverlay({
  countries,
  activeSlug,
  onSelect,
}: {
  countries: PadelCountry[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="mx-auto max-w-full overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex w-max items-end gap-3 px-2 sm:gap-4 md:gap-5">
        {countries.map((country) => {
          const active = country.slug === activeSlug;

          const code = (
            country.code ?? countryCode(country.name, country.slug)
          ).toUpperCase() as keyof typeof flagComponents;

          const Flag = flagComponents[code];

          return (
            <button
              key={country.slug}
              type="button"
              aria-pressed={active}
              aria-label={`Show ${country.name} on globe`}
              onClick={() => onSelect(country.slug)}
              className={`group flex min-w-[58px] flex-col items-center gap-1.5 text-[10px] font-semibold uppercase tracking-tight transition sm:min-w-[68px] sm:gap-2 sm:text-xs ${
                active ? "text-[#e6fa50]" : "text-white/75 hover:text-white"
              }`}
            >
              <span
                className={`grid h-10 w-10 place-items-center overflow-hidden rounded-full border bg-black/45 text-[11px] font-bold shadow-lg backdrop-blur-md transition sm:h-12 sm:w-12 sm:text-xs ${
                  active
                    ? "border-[#e6fa50] ring-4 ring-[#e6fa50]/20"
                    : "border-white/15 group-hover:border-white/35"
                }`}
              >
                {Flag ? (
                  <Flag
                    aria-hidden="true"
                    className="h-full w-full scale-125 object-cover"
                  />
                ) : (
                  <span>{code}</span>
                )}
              </span>

              <span className="max-w-[72px] truncate">
                {countryNavLabel(country)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function InteractiveGlobeDestinations({ countries }: Props) {
  const reducedMotion = useReducedMotion();
  const webglOk = useWebGLAvailable();
  const navCountries = useMemo(() => sortCountriesForNav(countries), [countries]);
  const [activeSlug, setActiveSlug] = useState(() => defaultActiveCountrySlug(countries));
  const resolvedSlug =
    activeSlug && navCountries.some((country) => country.slug === activeSlug)
      ? activeSlug
      : defaultActiveCountrySlug(countries);

  if (countries.length === 0) return null;

  return (
    <section
      id="destinations"
      className="relative isolate overflow-hidden bg-[#050735] pb-0 text-white"
      aria-labelledby="destinations-globe-heading"
    >  
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(73,255,161,0.12),transparent_35%),radial-gradient(circle_at_50%_85%,rgba(0,64,255,0.2),transparent_45%)]"
        aria-hidden
      />


      <div className="relative z-10 mx-auto mt-0 h-[500px] max-h-[780px] w-full overflow-hidden md:h-[640px] lg:h-[740px] xl:h-[1250px]">
         <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-60 bg-gradient-to-b from-[#050735] via-[#050735]/75 to-transparent" />

              <div className="relative z-40 mx-auto max-w-5xl px-4 pt-12 text-center md:pt-20">
        <h2
          id="destinations-globe-heading"
          className="text-balance font-heading text-4xl font-bold tracking-tight text-white md:text-6xl"
        >
          Popular training destinations
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
          Explore padel training destinations across the countries covered by Padel Pathways.
        </p>
      </div>

        {webglOk ? (
          <>
            <div className="absolute inset-x-0 top-0 h-full overflow-hidden">
              <div className="absolute left-1/2 top-0 h-full w-full -translate-x-1/2">
                <PadelGlobeGL
                  countries={countries}
                  activeSlug={resolvedSlug}
                  reducedMotion={reducedMotion}
                  onCountrySelect={setActiveSlug}
                />
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-40 bg-gradient-to-t from-[#050735] via-[#050735]/75 to-transparent" />

            <div className="absolute inset-x-0 bottom-6 z-40 px-4 md:bottom-8 lg:bottom-10">
              <CountryNavOverlay
                countries={navCountries}
                activeSlug={resolvedSlug}
                onSelect={setActiveSlug}
              />
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
            <GlobeFallbackList countries={navCountries} />
          </div>
        )}
      </div>
    </section>
  );
}

function GlobeFallbackList({ countries }: { countries: PadelCountry[] }) {
  return (
    <div className="flex flex-col justify-center py-8">
      <p className="mb-4 text-center text-sm text-white/60">
        Interactive globe unavailable. Browse destinations below.
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {countries.map((c) => (
          <li key={c.slug}>
            <Link
              href={c.href}
              className="block rounded-xl border border-white/15 bg-white/5 px-3 py-4 text-center text-sm font-medium text-white hover:border-[#2ed8ab]/40 hover:bg-white/10"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}