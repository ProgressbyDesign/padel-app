import Link from "next/link";
import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-primary">{title}</h1>
        {description ? <p className="mt-1 text-sm text-primary/70">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function AdminCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-primary/10 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-primary/60">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg border border-primary/10 bg-white p-4 shadow-sm transition hover:border-secondary/40"
      >
        {inner}
      </Link>
    );
  }
  return <div className="rounded-lg border border-primary/10 bg-white p-4 shadow-sm">{inner}</div>;
}

export function AdminEmpty({ message }: { message: string }) {
  return <p className="rounded-lg border border-dashed border-primary/20 bg-white/60 px-4 py-8 text-center text-sm text-primary/60">{message}</p>;
}

export function AdminBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warn" | "ok" | "bad";
}) {
  const tones = {
    neutral: "bg-primary/5 text-primary/80",
    warn: "bg-amber-100 text-amber-900",
    ok: "bg-emerald-100 text-emerald-900",
    bad: "bg-red-100 text-red-900",
  };
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function AdminTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-primary/10 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function AdminTh({ children }: { children?: ReactNode }) {
  return (
    <th className="border-b border-primary/10 bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary/70">
      {children}
    </th>
  );
}

export function AdminTd({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-primary/5 px-3 py-2 align-top text-primary ${className}`}>{children}</td>;
}

export function AdminInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-primary/15 px-3 py-2 text-sm text-primary outline-none focus:border-secondary ${props.className ?? ""}`}
    />
  );
}

export function AdminTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded border border-primary/15 px-3 py-2 text-sm text-primary outline-none focus:border-secondary ${props.className ?? ""}`}
    />
  );
}

export function AdminSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded border border-primary/15 px-3 py-2 text-sm text-primary outline-none focus:border-secondary ${props.className ?? ""}`}
    />
  );
}

export function AdminButton({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const variants = {
    primary: "bg-primary text-white hover:bg-primary/90",
    secondary: "border border-primary/20 bg-white text-primary hover:bg-surface",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      type="button"
      {...props}
      className={`rounded px-3 py-2 text-sm font-medium disabled:opacity-50 ${variants[variant]} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function PaginationBar({
  page,
  total,
  pageSize,
  basePath,
  searchParams,
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;

  function hrefFor(p: number) {
    const q = new URLSearchParams();
    q.set("page", String(p));
    if (searchParams) {
      for (const [k, v] of Object.entries(searchParams)) {
        if (v) q.set(k, v);
      }
    }
    return `${basePath}?${q.toString()}`;
  }

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-primary/70">
      <span>
        Page {page} of {totalPages} ({total} total)
      </span>
      <div className="flex gap-2">
        {prev ? (
          <Link href={hrefFor(prev)} className="rounded border border-primary/15 px-3 py-1 hover:bg-white">
            Previous
          </Link>
        ) : (
          <span className="rounded border border-primary/10 px-3 py-1 opacity-40">Previous</span>
        )}
        {next ? (
          <Link href={hrefFor(next)} className="rounded border border-primary/15 px-3 py-1 hover:bg-white">
            Next
          </Link>
        ) : (
          <span className="rounded border border-primary/10 px-3 py-1 opacity-40">Next</span>
        )}
      </div>
    </div>
  );
}

export function qualityBadge(status: string | null, approved: boolean | null) {
  if (approved) return <AdminBadge tone="ok">Approved</AdminBadge>;
  if (status === "needs_review") return <AdminBadge tone="warn">Needs review</AdminBadge>;
  if (status === "rejected") return <AdminBadge tone="bad">Rejected</AdminBadge>;
  return <AdminBadge tone="neutral">{status ?? "pending"}</AdminBadge>;
}
