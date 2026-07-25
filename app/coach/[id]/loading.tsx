export default function CoachDetailLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1680px] animate-pulse px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]"
      aria-busy="true"
      aria-label="Loading coach profile"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="h-72 rounded-[24px] bg-primary/10" />
          <div className="h-8 w-2/3 rounded bg-primary/10" />
          <div className="h-4 w-full rounded bg-primary/10" />
          <div className="h-4 w-5/6 rounded bg-primary/10" />
        </div>
        <div className="h-80 rounded-[24px] border border-primary/10 bg-white" />
      </div>
    </div>
  );
}
