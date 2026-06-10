"use client";

import { useState } from "react";
import { COACH_PLACEHOLDER_IMAGE, coachDisplayImageUrl } from "../lib/coachImage";

type CoachImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
};

export default function CoachImage({ src, alt, className, loading = "lazy" }: CoachImageProps) {
  const [currentSrc, setCurrentSrc] = useState(() => coachDisplayImageUrl(src));

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        if (currentSrc !== COACH_PLACEHOLDER_IMAGE) {
          setCurrentSrc(COACH_PLACEHOLDER_IMAGE);
        }
      }}
    />
  );
}