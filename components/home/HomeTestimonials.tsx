"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Quote, Star } from "lucide-react";

export type HomeTestimonial = {
  quote: string;
  name: string;
  location: string;
  image: string;
};

type HomeTestimonialsProps = {
  items: HomeTestimonial[];
};

export default function HomeTestimonials({ items }: HomeTestimonialsProps) {
  const [index, setIndex] = useState(0);
  const count = items.length;

  if (count === 0) return null;

  const active = items[index]!;
  const backOne = items[(index + 1) % count]!;
  const backTwo = items[(index + 2) % count]!;

  const goPrev = () => setIndex((current) => (current - 1 + count) % count);
  const goNext = () => setIndex((current) => (current + 1) % count);

  return (
    <section className="border-b border-primary/10 bg-surface py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            What players say
          </h2>
          <p className="mt-3 text-base text-primary/65 sm:text-lg">
            We make sure you we deliver the best service and our reviews prove it!
          </p>
        </div>

        <div className="relative mx-auto mt-12 max-w-5xl">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-14">
            <div className="relative h-[320px] w-full max-w-[420px] shrink-0 sm:h-[380px] lg:h-[496px] lg:max-w-[491px]">
              <div className="absolute left-0 top-12 h-[88%] w-[78%] overflow-hidden rounded-[20px] shadow-md">
                <Image src={backTwo.image} alt="" fill className="object-cover" sizes="320px" />
                <div className="absolute inset-0 bg-black/40" aria-hidden />
              </div>
              <div className="absolute left-6 top-6 h-[90%] w-[78%] overflow-hidden rounded-[20px] shadow-lg">
                <Image src={backOne.image} alt="" fill className="object-cover" sizes="320px" />
                <div className="absolute inset-0 bg-black/20" aria-hidden />
              </div>
              <div className="absolute left-12 top-0 h-[92%] w-[80%] overflow-hidden rounded-[20px] shadow-xl">
                <Image
                  key={active.image}
                  src={active.image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="360px"
                  priority
                />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <Quote className="h-12 w-12 text-accent" aria-hidden />
              <blockquote className="mt-6 text-xl leading-relaxed text-primary sm:text-2xl sm:leading-9">
                &ldquo;{active.quote}&rdquo;
              </blockquote>
              <div className="mt-6 flex gap-1" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, star) => (
                  <Star key={star} className="h-4 w-4 fill-primary text-primary" aria-hidden />
                ))}
              </div>
              <figcaption className="mt-6">
                <p className="text-xl font-bold text-primary">{active.name}</p>
                <p className="mt-1 text-base text-primary/55">{active.location}</p>
              </figcaption>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-center gap-4 lg:absolute lg:inset-y-0 lg:left-0 lg:right-0 lg:mt-0 lg:justify-between">
            <button
              type="button"
              onClick={goPrev}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-md ring-1 ring-primary/10 transition hover:bg-surface"
              aria-label="Previous testimonial"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-md transition hover:bg-primary/90"
              aria-label="Next testimonial"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-8 flex justify-center gap-2">
            {items.map((item, dotIndex) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className={`h-3 w-3 rounded-full transition ${
                  dotIndex === index ? "bg-primary" : "bg-primary/25"
                }`}
                aria-label={`Go to testimonial ${dotIndex + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}