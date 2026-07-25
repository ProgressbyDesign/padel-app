export default function BookCoachLoading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl animate-pulse px-4 py-10 sm:px-6 sm:py-14"
      aria-busy="true"
      aria-label="Loading booking request"
    >
      <div className="h-4 w-40 rounded bg-primary/10" />
      <div className="mt-4 h-10 w-full max-w-md rounded bg-primary/10" />
      <div className="mt-3 h-4 w-full max-w-xl rounded bg-primary/10" />
      <div className="mt-8 h-64 rounded-[24px] border border-primary/10 bg-white" />
    </div>
  );
}
