import AdminBookingsPanel from "@/components/admin/AdminBookingsPanel";
import { PAYMENT_COPY } from "@/lib/coachBookings/constants";
import { listAdminBookings } from "@/lib/queries/coachBookings";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    coach?: string;
    venue?: string;
    requester?: string;
    date?: string;
  }>;
};

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  let rows = await listAdminBookings({
    status: params.status,
    coach: params.coach,
    venue: params.venue,
  });

  const requester = params.requester?.trim().toLowerCase();
  if (requester) {
    rows = rows.filter(
      (row) =>
        row.requester_name.toLowerCase().includes(requester) ||
        row.requester_email.toLowerCase().includes(requester)
    );
  }

  const date = params.date?.trim();
  if (date) {
    rows = rows.filter((row) => row.starts_at.slice(0, 10) === date);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Operations
        </p>
        <h1 className="mt-2">Bookings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/60">
          Review coaching session requests across coaches and venues.{" "}
          {PAYMENT_COPY}
        </p>
      </div>
      <AdminBookingsPanel
        rows={rows}
        initialStatus={params.status ?? null}
        initialCoach={params.coach ?? null}
        initialVenue={params.venue ?? null}
        initialRequester={params.requester ?? null}
        initialDate={params.date ?? null}
        // eslint-disable-next-line react-hooks/purity -- intentional request-time clock for UI eligibility
        nowMs={Date.now()}
      />
    </div>
  );
}
