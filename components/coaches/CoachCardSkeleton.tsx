export default function CoachCardSkeleton() {
  return (
    <div
      className="animate-pulse rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(0,60,60,0.08)] ring-1 ring-primary/12"
      aria-hidden
    >
      <div className="aspect-video w-full rounded-xl bg-primary/12" />
      <div className="mt-4 space-y-3">
        <div className="h-6 w-[65%] rounded-md bg-primary/12" />
        <div className="h-4 w-[45%] rounded-md bg-primary/8" />
        <div className="h-10 w-full rounded-md bg-primary/8" />
        <div className="flex gap-3 border-t border-primary/10 pt-3">
          <div className="h-3 w-16 rounded bg-primary/8" />
          <div className="h-3 w-20 rounded bg-primary/8" />
        </div>
        <div className="h-10 w-full rounded-xl bg-primary/12 sm:ml-auto sm:w-2/5" />
      </div>
    </div>
  );
}
