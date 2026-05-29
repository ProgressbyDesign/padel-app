"use client";

import Image from "next/image";
import Link from "next/link";
import Carousel from "../ui/Carousel";

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
  return (
    <Carousel variant="fullBleed" showPagination>
      {SLIDES.map((d) => (
        <Link
          key={d.country}
          href={`/coaches?location=${encodeURIComponent(d.query)}`}
          className="group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl ring-1 ring-black/5 transition hover:ring-primary/25"
        >
          <Image
            src={d.image}
            alt=""
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width:768px) 85vw, (max-width:1280px) 33vw, 24vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-lg font-semibold text-white">{d.country}</p>
            <p className="mt-1 text-xs leading-snug text-white/85">{d.subtitle}</p>
            <p className="mt-3 text-xs font-semibold text-white/90">Find coaches →</p>
          </div>
        </Link>
      ))}
    </Carousel>
  );
}
