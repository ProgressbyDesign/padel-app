"use client";

type BookingCardProps = {
  venueName?: string | null;
};

export default function BookingCard({ venueName }: BookingCardProps) {
  const name = venueName?.trim();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="mb-4 border-b border-slate-100 pb-4">
        <p className="text-sm text-slate-500">From</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          <span className="text-slate-400">—</span>
          <span className="ml-1 text-base font-normal text-slate-500">/ session</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">Pricing coming soon for {name ?? "this venue"}.</p>
      </div>

      <form className="space-y-4" action="#" onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Date
            <input
              type="date"
              name="date"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Time
            <input
              type="time"
              name="time"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
        </div>

        <button
          type="submit"
          className="h-12 w-full rounded-full bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2"
        >
          Check availability
        </button>
      </form>
    </div>
  );
}
