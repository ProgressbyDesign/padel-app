"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import type { PadelCountry } from "@/lib/padelCountries";

type Props = {
  countries: PadelCountry[];
  activeSlug: string;
  reducedMotion: boolean;
  onCountrySelect: (slug: string) => void;
};

const FOCUS_MS = 1000;
// const AUTO_ROTATE_RESUME_MS = 5000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function povAltitudeForWidth(width: number): number {
  if (width < 640) return 1.75;
  if (width < 1024) return 1.5;
  return 0.75;
}

export default function PadelGlobeGL({
  countries,
  activeSlug,
  reducedMotion,
  onCountrySelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const prevSlugRef = useRef(activeSlug);
  const prevDimsRef = useRef({ width: 0, height: 0 });
  const [dims, setDims] = useState({ width: 0, height: 0 });
  // const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  const activeCountry =
    countries.find((country) => country.slug === activeSlug) ?? countries[0];

  const htmlElementsData = useMemo(
    () => [...countries],
    [countries, activeSlug]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setDims({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls();
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.6;
    // controls.autoRotate = !reducedMotion;
      controls.autoRotate = false;
    // controls.autoRotateSpeed = 0.35;
  }, [reducedMotion, dims.width, dims.height]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !dims.width || !dims.height || !activeCountry) return;

    const dimsChanged =
      dims.width !== prevDimsRef.current.width ||
      dims.height !== prevDimsRef.current.height;
    prevDimsRef.current = { width: dims.width, height: dims.height };

    if (!dimsChanged) return;

    const altitude = povAltitudeForWidth(dims.width);

    function povLatOffsetForWidth(width: number): number {
  if (width < 640) return 4;
  if (width < 1024) return 6;
  return 2;
}
const latOffset = povLatOffsetForWidth(dims.width);

    globe.pointOfView(
      {
        lat: activeCountry.lat + latOffset,
        lng: activeCountry.lng,
        altitude,
      },
      0
    );
  }, [dims.width, dims.height, activeCountry]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !activeCountry || !dims.width) return;

    const altitude = povAltitudeForWidth(dims.width);
    const slugChanged = prevSlugRef.current !== activeSlug;
    prevSlugRef.current = activeSlug;

    if (!slugChanged) return;

    globe.pointOfView(
      {
        lat: activeCountry.lat,
        lng: activeCountry.lng,
        altitude,
      },
      reducedMotion ? 0 : FOCUS_MS
    );

    const controls = globe.controls();
    controls.autoRotate = false;

    if (reducedMotion) return;

      // const timeout = window.setTimeout(() => {
      //   controls.autoRotate = true;
      // }, AUTO_ROTATE_RESUME_MS);

      // return () => window.clearTimeout(timeout);
  }, [activeCountry, activeSlug, reducedMotion, dims.width]);

  const buildMarkerElement = useCallback(
    (country: PadelCountry) => {
      const active = country.slug === activeSlug;
      const safeName = escapeHtml(country.name);
      const safeHref = escapeHtml(country.href);

      const stemHiddenClass =
        "pointer-events-none absolute left-1/2 top-1/2 h-4 w-1 -translate-x-1/2 border-l border-dotted border-[#e6fa50]/45 translate-y-1 opacity-0 transition-all duration-300 ease-out";
      const stemVisibleClass =
        "pointer-events-none absolute left-1/2 top-1/2 h-4 w-1 -translate-x-1/2 border-l border-dotted border-[#e6fa50]/45 translate-y-[2px] opacity-100 transition-all duration-300 ease-out";

      const root = document.createElement("div");
      root.className = "pointer-events-none relative h-12 w-12 overflow-visible";

      let label: HTMLDivElement | null = null;
      if (active) {
        label = document.createElement("div");
        label.className =
          "pointer-events-auto absolute left-1/2 top-1/2 max-w-[120px] -translate-x-1/2 -translate-y-[64px] rounded-full border border-[#e6fa50]/25 bg-[#050735]/85 px-3 py-1.5 text-center opacity-0 shadow-xl backdrop-blur-md transition-all duration-300 ease-out";
        label.innerHTML = `
          <div class="text-[11px] font-bold leading-tight text-white">${safeName}</div>
          <a href="${safeHref}" class="block text-[10px] font-semibold text-[#e6fa50] hover:text-[#f2ff8a]">Explore</a>
        `;
        root.appendChild(label);
      }

      const stem = document.createElement("div");
      stem.className = stemHiddenClass;
      root.appendChild(stem);

      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Select ${country.name}`);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.className = [
        "group pointer-events-auto absolute left-1/2 top-1/2 grid h-10 w-10 cursor-pointer place-items-center rounded-full",
        "transition-transform duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6fa50]",
      ].join(" ");
      button.style.transform = "translate(-50%, -50%)";

      button.innerHTML = active
        ? `
          <span class="absolute inset-0 rounded-full bg-[#e6fa50]/20 animate-pulse"></span>
          <span class="relative h-3.5 w-3.5 rounded-full bg-[#e6fa50] shadow-[0_0_18px_rgba(230,250,80,0.9)] transition-all duration-300 ease-out"></span>
        `
        : `
          <span class="absolute inset-0 rounded-full bg-white/10 transition-all duration-300 ease-out group-hover:bg-[#e6fa50]/15"></span>
          <span class="relative h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.55)] transition-all duration-300 ease-out group-hover:h-3 group-hover:w-3 group-hover:bg-[#e6fa50] group-hover:shadow-[0_0_16px_rgba(230,250,80,0.75)]"></span>
        `;

      button.onmouseenter = () => {
        if (active) return;
        button.style.transform = "translate(-50%, calc(-50% - 14px)) scale(1.1)";
      };

      button.onmouseleave = () => {
        if (active) return;
        button.style.transform = "translate(-50%, -50%) scale(1)";
      };

      button.onclick = (event) => {
        event.stopPropagation();
        onCountrySelect(country.slug);
      };

      root.appendChild(button);

      if (active) {
        const animateActive = () => {
          button.style.transform = "translate(-50%, calc(-50% - 14px))";
          stem.className = stemVisibleClass;
          if (label) {
            label.className =
              "pointer-events-auto absolute left-1/2 top-1/2 max-w-[120px] -translate-x-1/2 -translate-y-[72px] rounded-full border border-[#e6fa50]/25 bg-[#050735]/85 px-3 py-1.5 text-center opacity-100 shadow-xl backdrop-blur-md transition-all duration-300 ease-out";
          }
        };

        if (reducedMotion) {
          animateActive();
        } else {
          window.requestAnimationFrame(animateActive);
        }
      }

      return root;
    },
    [activeSlug, onCountrySelect, reducedMotion]
  );

  if (dims.width === 0 || dims.height === 0) {
    return <div ref={containerRef} className="h-full w-full" />;
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <Globe
        ref={globeRef}
        width={dims.width}
        height={dims.height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="/textures/earth/earth-day.jpg"
        showAtmosphere
        atmosphereColor="rgba(73,255,161,0.18)"
        atmosphereAltitude={0.14}
        globeCurvatureResolution={4}
        htmlElementsData={htmlElementsData}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={(d: object) =>
          (d as PadelCountry).slug === activeSlug ? 0.05 : 0.035
        }
        htmlTransitionDuration={reducedMotion ? 0 : 280}
        htmlElement={(d: object) => buildMarkerElement(d as PadelCountry)}
      />
    </div>
  );
}