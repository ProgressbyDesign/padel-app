export default function VenueDetailLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1680px] animate-pulse px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]"
      aria-busy="true"
      aria-label="Loading venue profile"
    >
      <div className="space-y-6">
        <div className="h-4 w-32 rounded bg-primary/10" />
        <div className="h-10 w-2/3 max-w-lg rounded bg-primary/10" />
        <div className="h-72 rounded-[24px] bg-primary/10" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-40 rounded-[20px] border border-primary/10 bg-white" />
          <div className="h-40 rounded-[20px] border border-primary/10 bg-white" />
        </div>
      </div>
    </div>
  );
}
