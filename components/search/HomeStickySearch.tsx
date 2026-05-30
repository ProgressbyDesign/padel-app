"use client";

import { useRef, useState } from "react";
import MarketplaceSearch from "./MarketplaceSearch";
import StickySearchBar from "./StickySearchBar";
import type { MarketplaceSearchValues } from "../../lib/marketplaceSearch";

/**
 * Hero search + compact sticky bar after scroll (Airbnb-style).
 * Shared state keeps fields in sync between hero and sticky bars.
 */
export default function HomeStickySearch() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<MarketplaceSearchValues>({
    mode: "venues",
    location: "",
    entity: "",
  });

  const sharedProps = {
    defaultMode: "venues" as const,
    initialValues: values,
    onValuesChange: setValues,
  };

  return (
    <>
      <div ref={heroRef}>
        <MarketplaceSearch variant="hero" {...sharedProps} />
      </div>
      <StickySearchBar anchorRef={heroRef}>
        <MarketplaceSearch variant="compact" {...sharedProps} className="max-w-6xl" />
      </StickySearchBar>
    </>
  );
}
