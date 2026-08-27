"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { JOIN_NAV_ITEMS } from "@/lib/join/nav";

export default function JoinNavMenu({
  overlay = false,
}: {
  overlay?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const menuId = useId();
  const triggerId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const triggerClass = overlay
    ? "bg-white text-primary shadow-md hover:bg-white/95"
    : "bg-primary text-accent shadow-sm hover:bg-primary/90";

  return (
    <div ref={rootRef} className="relative">
      <button
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-cta="join-nav-toggle"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            queueMicrotask(() => firstItemRef.current?.focus());
          }
        }}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition sm:px-5 ${triggerClass}`}
      >
        Join
        <ChevronDown
          className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-primary/10 bg-white p-2 shadow-[0_12px_40px_rgba(3,19,34,0.12)]"
        >
          {JOIN_NAV_ITEMS.map((item, index) => (
            <Link
              key={item.id}
              ref={index === 0 ? firstItemRef : undefined}
              href={item.href}
              role="menuitem"
              data-cta={item.cta}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 text-left transition hover:bg-surface focus:bg-surface focus:outline-none"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/45">
                {item.eyebrow}
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
