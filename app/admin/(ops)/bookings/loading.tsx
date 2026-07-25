export default function AdminBookingsLoading() {
  return (
    <div
      className="animate-pulse space-y-6"
      aria-busy="true"
      aria-label="Loading bookings"
    >
      <div className="h-3 w-28 rounded bg-primary/10" />
      <div className="h-9 w-40 rounded bg-primary/10" />
      <div className="h-4 w-full max-w-2xl rounded bg-primary/10" />
      <div className="h-14 rounded-xl bg-primary/10" />
      <div className="space-y-3">
        <div className="h-28 rounded-[16px] border border-primary/10 bg-white" />
        <div className="h-28 rounded-[16px] border border-primary/10 bg-white" />
      </div>
    </div>
  );
}
