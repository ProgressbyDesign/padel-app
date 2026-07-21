export default function ManagedVenueDetailsLoading() {
  return (
    <div
      className="grid animate-pulse gap-8 xl:grid-cols-[minmax(0,1fr)_340px]"
      aria-label="Loading venue details"
    >
      <div className="h-[720px] rounded-[24px] bg-white" />
      <div className="h-72 rounded-[24px] bg-white" />
    </div>
  );
}
