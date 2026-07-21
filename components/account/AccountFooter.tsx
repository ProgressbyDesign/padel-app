import Link from "next/link";

export default function AccountFooter() {
  return (
    <footer className="mt-auto border-t border-primary/10 bg-white">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-4 py-5 text-sm text-primary/60 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-[120px]">
        <p>© {new Date().getFullYear()} Padel Pathways</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Account footer">
          <Link href="/account" className="transition hover:text-primary">
            Account
          </Link>
          <Link href="/contact" className="transition hover:text-primary">
            Contact
          </Link>
          <Link href="/" className="transition hover:text-primary">
            Back to site
          </Link>
        </nav>
      </div>
    </footer>
  );
}
