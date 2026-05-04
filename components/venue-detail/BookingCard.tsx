"use client";

type BookingCardProps = {
  venueName?: string | null;
};

export default function BookingCard({ venueName }: BookingCardProps) {
  const name = venueName?.trim();

  return (
    <div className="rounded-2xl border border-primary/15 bg-white p-6 shadow-sm ring-1 ring-primary/8">
      <div className="mb-4 border-b border-primary/10 pb-4">
        <p className="text-sm text-primary/60">From</p>
        <p className="mt-1 text-2xl font-semibold text-primary">
          <span className="text-primary/45">—</span>
          <span className="ml-1 text-base font-normal text-primary/60">/ session</span>
        </p>
        <p className="mt-1 text-xs text-primary/60">Pricing coming soon for {name ?? "this venue"}.</p>
      </div>

      <form className="space-y-4" action="#" onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-primary/60">
            Date
            <input
              type="date"
              name="date"
              className="mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3 py-2.5 text-sm text-primary outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-primary/60">
            Time
            <input
              type="time"
              name="time"
              className="mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3 py-2.5 text-sm text-primary outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </label>
        </div>

        <button
          type="submit"
          className="h-12 w-full rounded-full bg-primary text-sm font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
        >
          Check availability
        </button>
      </form>
    </div>
  );
}
