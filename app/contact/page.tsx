import Link from "next/link";

export const metadata = {
  title: "Contact",
  description: "Get in touch about padel venues and partnerships.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Contact</h1>
      <p className="mt-3 text-slate-600">
        We&apos;re building the best way to discover padel venues abroad. Questions, feedback, or partnership
        ideas? We&apos;d love to hear from you.
      </p>
      <p className="mt-8 text-sm text-slate-500">
        For now, reach out through your usual channels—an email form will land here soon.
      </p>
      <p className="mt-6">
        <Link href="/venues" className="text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900">
          Browse venues →
        </Link>
      </p>
    </div>
  );
}
