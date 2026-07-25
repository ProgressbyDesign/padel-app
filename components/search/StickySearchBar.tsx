"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

type StickySearchBarProps = {
  /** The in-flow search element to watch; the bar appears once it scrolls above the header. */
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  /** Inner max-width wrapper class (defaults to homepage width). */
  innerClassName?: string;
};

// Header height (h-14 mobile / h-16 desktop) — the bar pins just under it.
const HEADER_OFFSET = 64;

const emptySubscribe = () => () => {};

/**
 * Airbnb-style compact search bar that fades + slides in once the page's
 * primary search scrolls behind the header. Rendered through a portal on
 * document.body so it is always viewport-fixed, regardless of any
 * transformed/blurred ancestors.
 */
export default function StickySearchBar({
  anchorRef,
  children,
  innerClassName = "mx-auto max-w-6xl",
}: StickySearchBarProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: `-${HEADER_OFFSET}px 0px 0px 0px`, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [anchorRef]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed left-0 right-0 top-14 z-40 border-b border-primary/10 bg-white px-4 py-2 shadow-md transition-all duration-300 ease-out sm:top-16 sm:px-6 ${
        stuck ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
      }`}
      aria-hidden={!stuck}
    >
      <div className={innerClassName}>{children}</div>
    </div>,
    document.body
  );
}
