"use client";

import { useEffect, useState } from "react";
import MarketplaceSearch from "./MarketplaceSearch";
import type { MarketplaceSearchValues } from "../../lib/marketplaceSearch";

const STICKY_AFTER_PX = 420;

/**
 * Hero search + compact sticky bar after scroll (Airbnb-style).
 * Shared state keeps fields in sync between hero and sticky bars.
 */
export default function HomeStickySearch() {
  const [stuck, setStuck] = useState(false);
  const [values, setValues] = useState<MarketplaceSearchValues>({
    mode: "venues",
    location: "",
    entity: "",
  });

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > STICKY_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sharedProps = {
    defaultMode: "venues" as const,
    initialValues: values,
    onValuesChange: setValues,
  };

  return (
    <>
      <MarketplaceSearch variant="hero" {...sharedProps} />
      <div
        className={`fixed left-0 right-0 top-14 z-40 border-b border-primary/10 bg-white/95 px-4 py-2 shadow-md backdrop-blur-md transition-all duration-300 sm:top-16 sm:px-6 ${
          stuck ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
        aria-hidden={!stuck}
      >
        <MarketplaceSearch variant="compact" {...sharedProps} className="max-w-6xl" />
      </div>
    </>
  );
}
