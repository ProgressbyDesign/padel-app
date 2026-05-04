"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type DestinationSlide = {
  country: string;
  /** Coach PLP filter */
  query: string;
  subtitle: string;
  image: string;
};

const SLIDES: DestinationSlide[] = [
  {
    country: "Spain",
    query: "Spain",
    subtitle: "Marbella · Madrid · Barcelona",
    image:
      "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=900&q=80",
  },
  {
    country: "Italy",
    query: "Italy",
    subtitle: "Rome · Milan · Sicily",
    image:
      "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?auto=format&fit=crop&w=900&q=80",
  },
  {
    country: "Sweden",
    query: "Sweden",
    subtitle: "Stockholm · Gothenburg",
    image:
      "https://images.unsplash.com/photo-1509356843151-3e7d96241e11?auto=format&fit=crop&w=900&q=80",
  },
  {
    country: "France",
    query: "France",
    subtitle: "Paris · Lyon · Nice",
    image:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80",
  },
  {
    country: "Portugal",
    query: "Portugal",
    subtitle: "Lisbon · Porto · Algarve",
    image:
      "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?auto=format&fit=crop&w=900&q=80",
  },
  {
    country: "Netherlands",
    query: "Netherlands",
    subtitle: "Amsterdam · Rotterdam",
    image:
      "https://images.unsplash.com/photo-1512470879762-85229f477c8d?auto=format&fit=crop&w=900&q=80",
  },
  {
    country: "United Kingdom",
    query: "United Kingdom",
    subtitle: "London · Manchester",
    image:
      "https://images.unsplash.com/photo-1513635269976-596ae98878f5?auto=format&fit=crop&w=900&q=80",
  },
  {
    country: "Germany",
    query: "Germany",
    subtitle: "Berlin · Munich · Hamburg",
    image:
      "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80",
  },
  {
    country: "Belgium",
    query: "Belgium",
    subtitle: "Brussels · Antwerp",
    image:
      "https://images.unsplash.com/photo-1556745689-24f431fbc92f?auto=format&fit=crop&w=900&q=80",
  },
  {
    country: "United Arab Emirates",
    query: "United Arab Emirates",
    subtitle: "Dubai · Abu Dhabi",
    image:
      "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=80",
  },
];

export default function DestinationsCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByDir = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.min(el.clientWidth * 0.85, 360) * dir;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollByDir(-1)}
        className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 translate-x-1 items-center justify-center rounded-full border border-primary/15 bg-white text-primary shadow-md transition hover:bg-surface md:flex"
        aria-label="Previous destinations"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollByDir(1)}
        className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-x-1 -translate-y-1/2 items-center justify-center rounded-full border border-primary/15 bg-white text-primary shadow-md transition hover:bg-surface md:flex"
        aria-label="Next destinations"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 pt-1 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory px-1 md:px-12"
        tabIndex={0}
        role="region"
        aria-label="Popular training destinations"
      >
        {SLIDES.map((d) => (
          <Link
            key={d.country}
            href={`/coaches?location=${encodeURIComponent(d.query)}`}
            className="group relative aspect-[4/5] w-[min(72vw,260px)] shrink-0 snap-center overflow-hidden rounded-2xl ring-1 ring-black/5 transition hover:ring-primary/25 md:w-[220px] lg:w-[240px]"
          >
            <Image
              src={d.image}
              alt=""
              fill
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes="(max-width:768px) 72vw, 240px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-lg font-semibold text-white">{d.country}</p>
              <p className="mt-1 text-xs leading-snug text-white/85">{d.subtitle}</p>
              <p className="mt-3 text-xs font-semibold text-white/90">Find coaches →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
