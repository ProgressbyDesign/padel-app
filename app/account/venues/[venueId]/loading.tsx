export default function ManagedVenueOverviewLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-label="Loading venue overview">
      <div className="h-64 rounded-[24px] bg-white" />
      <div className="h-72 rounded-[24px] bg-white" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-36 rounded-[24px] bg-white" />
        <div className="h-36 rounded-[24px] bg-white" />
        <div className="h-36 rounded-[24px] bg-white" />
      </div>
    </div>
  );
}
