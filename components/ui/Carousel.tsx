"use client";

import { Children, isValidElement } from "react";
import { Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

const SLIDE_CLASS = "!box-border !w-[280px] shrink-0 sm:!w-[300px] lg:!w-[320px]";

export type CarouselProps = {
  children: React.ReactNode;
  /** Bullet pagination (useful on mobile when arrows are hidden). Default true. */
  showPagination?: boolean;
  className?: string;
};

/**
 * Horizontal carousel: `slidesPerView: "auto"` + fixed slide widths (280–320px) so
 * the next card always peeks in and card size stays consistent.
 *
 * Breakpoints like `{ 640: { slidesPerView: 1.2 }, ... }` are omitted because they
 * compute slide width from the container and stretch cards; fixed widths match the
 * same “~1.2 / ~2.2 / ~3.2 / ~4 visible” intent at typical viewports.
 */
export default function Carousel({ children, showPagination = true, className = "" }: CarouselProps) {
  const slides = Children.toArray(children).filter((c) => c != null);

  return (
    <div className={`pp-home-carousel relative ${className}`.trim()}>
      <Swiper
        modules={[Navigation, Pagination]}
        slidesPerView="auto"
        spaceBetween={16}
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
        breakpoints={{
          640: { spaceBetween: 18 },
          768: { spaceBetween: 20 },
          1024: { spaceBetween: 22 },
          1280: { spaceBetween: 24 },
        }}
        className="home-swiper pb-10"
      >
        {slides.map((slide, i) => {
          const key = isValidElement(slide) && slide.key != null ? slide.key : i;
          return (
            <SwiperSlide key={key} className={SLIDE_CLASS}>
              {slide}
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
