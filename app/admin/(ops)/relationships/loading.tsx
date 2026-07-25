export default function AdminRelationshipsLoading() {
  return (
    <div
      className="animate-pulse space-y-6"
      aria-busy="true"
      aria-label="Loading relationships"
    >
      <div className="h-3 w-32 rounded bg-primary/10" />
      <div className="h-9 w-64 rounded bg-primary/10" />
      <div className="h-12 rounded-xl bg-primary/10" />
      <div className="space-y-3">
        <div className="h-20 rounded-[16px] border border-primary/10 bg-white" />
        <div className="h-20 rounded-[16px] border border-primary/10 bg-white" />
        <div className="h-20 rounded-[16px] border border-primary/10 bg-white" />
      </div>
    </div>
  );
}
