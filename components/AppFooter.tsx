import Link from "next/link";

export default function AppFooter() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-dark">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-base font-semibold text-white">Padel</p>
            <p className="mt-1 max-w-xs text-sm text-white/70">Find courts and coaching abroad.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Footer">
            <Link href="/venues" className="text-white/75 transition hover:text-white">
              Venues
            </Link>
            <Link href="/contact" className="text-white/75 transition hover:text-white">
              Contact
            </Link>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
            <a href="#" className="transition hover:text-white/80">
              Privacy
            </a>
            <a href="#" className="transition hover:text-white/80">
              Terms
            </a>
            <a href="#" className="transition hover:text-white/80">
              Cookies
            </a>
          </div>
          <p className="text-xs text-white/55">© {new Date().getFullYear()} Padel. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
