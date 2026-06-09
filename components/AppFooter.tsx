import Link from "next/link";
import PadelPathwaysLogo from "@/components/brand/PadelPathwaysLogo";

const links = [
  { href: "/coaches", label: "Find a coach" },
  { href: "/venues", label: "Find a venue" },
  { href: "/venues", label: "Training camps" },
  { href: "/join", label: "List your venue" },
  { href: "/join", label: "Become a coach" },
] as const;

function SocialIcon({ label }: { label: string }) {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold transition hover:bg-primary/15">
      {label}
    </span>
  );
}

export default function AppFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden bg-accent text-primary">
      <div className="relative mx-auto max-w-[1680px] px-4 pb-10 pt-12 sm:px-6 lg:px-[120px] lg:pb-12 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.6fr] lg:gap-16">
          <div className="max-w-md space-y-4">
            <PadelPathwaysLogo variant="black" />
            <p className="max-w-sm text-base leading-6 text-primary">
              Your worldwide padel destination. Book courts, join events, and experience the
              fastest-growing sport in the UK.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">Links</h2>
            <nav className="mt-7 flex flex-col gap-4 text-base" aria-label="Footer">
              {links.map((item) => (
                <Link key={item.label} href={item.href} className="transition hover:opacity-70">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">Social</h2>
            <div className="mt-7 flex items-center gap-3">
              <a href="#" aria-label="Facebook" className="transition hover:opacity-70">
                <SocialIcon label="f" />
              </a>
              <a href="#" aria-label="Instagram" className="transition hover:opacity-70">
                <SocialIcon label="ig" />
              </a>
            </div>
          </div>
        </div>

        <p
          className="pointer-events-none mt-16 select-none font-heading text-[clamp(3.5rem,14vw,10rem)] font-bold leading-[0.9] tracking-[-0.03em] text-primary lg:mt-20"
          aria-hidden
        >
          PADEL PATHWAYS
        </p>

        <p className="relative z-10 mt-8 text-lg text-primary/70">
          © {new Date().getFullYear()} Padel Pathways | All rights reserved
        </p>
      </div>
    </footer>
  );
}