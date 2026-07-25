export default function AdminLoading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl animate-pulse space-y-6 px-4 py-10 sm:px-6"
      aria-busy="true"
      aria-label="Loading admin"
    >
      <div className="h-3 w-28 rounded bg-primary/10" />
      <div className="h-9 w-48 rounded bg-primary/10" />
      <div className="h-4 w-full max-w-xl rounded bg-primary/10" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-32 rounded-[20px] border border-primary/10 bg-white" />
        <div className="h-32 rounded-[20px] border border-primary/10 bg-white" />
      </div>
    </div>
  );
}
