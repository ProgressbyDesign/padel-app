"use client";

import { useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 768px)";
const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type HomeHeroVideoProps = {
  src: string;
  poster: string;
};

export default function HomeHeroVideo({ src, poster }: HomeHeroVideoProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const reduceMotion = window.matchMedia(REDUCE_MOTION_QUERY);

    const sync = () => {
      setEnabled(desktop.matches && !reduceMotion.matches);
    };

    sync();
    desktop.addEventListener("change", sync);
    reduceMotion.addEventListener("change", sync);
    return () => {
      desktop.removeEventListener("change", sync);
      reduceMotion.removeEventListener("change", sync);
    };
  }, []);

  if (!enabled) return null;

  return (
    <video
      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      aria-hidden
      tabIndex={-1}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
