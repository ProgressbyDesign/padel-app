import Link from "next/link";
import { JOIN_NAV_ITEMS } from "@/lib/join/nav";

export default function JoinMobileSection({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary/45">
        Join
      </p>
      {JOIN_NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          data-cta={`${item.cta}-mobile`}
          onClick={onNavigate}
          className="block rounded-2xl border border-primary/10 bg-surface/60 px-4 py-3.5 transition hover:bg-surface"
        >
          <p className="text-base font-semibold text-primary">{item.eyebrow}</p>
          <p className="mt-1 text-sm leading-5 text-primary/60">{item.description}</p>
        </Link>
      ))}
    </div>
  );
}
