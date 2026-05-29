"use client";

import { Children, isValidElement } from "react";
import { Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

const FIXED_SLIDE_CLASS =
  "!box-border !w-[280px] shrink-0 sm:!w-[300px] lg:!w-[320px]";

export type CarouselVariant = "fixedCards" | "fullBleed";

export type CarouselProps = {
  children: React.ReactNode;
  variant?: CarouselVariant;
  /** Bullet pagination (useful on mobile when arrows are hidden). Default true. */
  showPagination?: boolean;
  className?: string;
};

/**
 * - `fixedCards`: `slidesPerView: "auto"` + fixed slide widths (peek).
 * - `fullBleed`: edge-to-edge section; responsive fractional `slidesPerView`
 *   (~1.1 mobile → ~5 desktop) with fluid slide width.
 */
export default function Carousel({
  children,
  variant = "fixedCards",
  showPagination = true,
  className = "",
}: CarouselProps) {
  const slides = Children.toArray(children).filter((c) => c != null);

  const swiper = (
    <Swiper
      modules={[Navigation, Pagination]}
      slidesPerView={variant === "fullBleed" ? 1.08 : "auto"}
      spaceBetween={variant === "fullBleed" ? 16 : 16}
      speed={400}
      loop={false}
      grabCursor
      watchOverflow
      navigation
      pagination={
        showPagination
          ? {
              clickable: true,
              dynamicBullets: true,
            }
          : false
      }
      breakpoints={
        variant === "fullBleed"
          ? {
              640: { slidesPerView: 1.15, spaceBetween: 16 },
              768: { slidesPerView: 2.35, spaceBetween: 18 },
              1024: { slidesPerView: 3.35, spaceBetween: 20 },
              1280: { slidesPerView: 4.35, spaceBetween: 22 },
              1536: { slidesPerView: 5, spaceBetween: 24 },
            }
          : {
              640: { spaceBetween: 18 },
              768: { spaceBetween: 20 },
              1024: { spaceBetween: 22 },
              1280: { spaceBetween: 24 },
            }
      }
      className="home-swiper pb-10"
    >
      {slides.map((slide, i) => {
        const key = isValidElement(slide) && slide.key != null ? slide.key : i;
        const slideCls =
          variant === "fullBleed" ? "!box-border !h-auto" : FIXED_SLIDE_CLASS;
        return (
          <SwiperSlide key={key} className={slideCls}>
            <div className={variant === "fullBleed" ? "h-full w-full" : undefined}>
              {slide}
            </div>
          </SwiperSlide>
        );
      })}
    </Swiper>
  );

  if (variant === "fullBleed") {
    return (
      <div
        className={`pp-home-carousel relative left-1/2 right-1/2 -ml-[50vw] w-screen max-w-[100vw] overflow-x-hidden ${className}`.trim()}
      >
        <div className="px-4 sm:px-6 lg:px-10 xl:px-14">{swiper}</div>
      </div>
    );
  }

  return (
    <div className={`pp-home-carousel relative ${className}`.trim()}>{swiper}</div>
  );
}
