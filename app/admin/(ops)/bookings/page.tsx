import AdminBookingsPanel from "@/components/admin/AdminBookingsPanel";
import {
  filterAdminBookings,
  paginateAdminBookings,
  parseAdminBookingSearchParams,
  sortAdminBookings,
  type AdminBookingSearchParams,
} from "@/lib/admin/bookingTable";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { getAdminAccount } from "@/lib/auth/adminSession";
import { PAYMENT_COPY } from "@/lib/coachBookings/constants";
import { listAdminBookings } from "@/lib/queries/coachBookings";

type PageProps = {
  searchParams: Promise<AdminBookingSearchParams>;
};

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const [rawParams, account] = await Promise.all([
    searchParams,
    getAdminAccount(),
  ]);
  const params = parseAdminBookingSearchParams(rawParams);
  const canManage = hasAdminPermission(account, "bookings.manage");

  const allRows = await listAdminBookings();
  const filtered = filterAdminBookings(allRows, params);
  const sorted = sortAdminBookings(filtered, params);
  const { rows, total, page, pageCount } = paginateAdminBookings(
    sorted,
    params.page
  );

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
        params={{ ...params, page }}
        total={total}
        pageCount={pageCount}
        canManage={canManage}
        // eslint-disable-next-line react-hooks/purity -- intentional request-time clock for UI eligibility
        nowMs={Date.now()}
      />
    </div>
  );
}
