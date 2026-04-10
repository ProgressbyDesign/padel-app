import Link from "next/link";

export default function AppFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-slate-50/50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Padel</p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">Find courts and coaching abroad.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Footer">
            <Link href="/venues" className="text-slate-600 transition hover:text-slate-900">
              Venues
            </Link>
            <Link href="/contact" className="text-slate-600 transition hover:text-slate-900">
              Contact
            </Link>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-slate-200/80 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <a href="#" className="transition hover:text-slate-600">
              Privacy
            </a>
            <a href="#" className="transition hover:text-slate-600">
              Terms
            </a>
            <a href="#" className="transition hover:text-slate-600">
              Cookies
            </a>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Padel. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
