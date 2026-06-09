export default function CoachCardSkeleton() {
  return (
    <div
      className="animate-pulse overflow-hidden rounded-[20px] bg-white"
      aria-hidden
    >
      <div className="aspect-[285/298] w-full bg-primary/10" />
      <div className="space-y-3 px-4 pb-5 pt-4">
        <div className="h-5 w-[55%] rounded bg-primary/12" />
        <div className="h-4 w-[70%] rounded bg-primary/8" />
        <div className="h-4 w-[50%] rounded bg-primary/8" />
        <div className="h-3.5 w-[65%] rounded bg-primary/8" />
        <div className="flex items-center justify-between pt-2">
          <div className="h-4 w-24 rounded bg-primary/10" />
          <div className="h-9 w-9 rounded-full bg-primary/10" />
        </div>
      </div>
    </div>
  );
}