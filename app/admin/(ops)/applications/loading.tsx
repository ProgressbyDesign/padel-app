export default function AdminApplicationsLoading() {
  return (
    <div
      className="animate-pulse space-y-6"
      aria-busy="true"
      aria-label="Loading applications"
    >
      <div className="h-3 w-32 rounded bg-primary/10" />
      <div className="h-9 w-56 rounded bg-primary/10" />
      <div className="h-24 rounded-[20px] border border-primary/10 bg-white" />
      <div className="h-40 rounded-[20px] border border-primary/10 bg-white" />
    </div>
  );
}
