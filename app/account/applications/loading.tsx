export default function AccountApplicationsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1680px] animate-pulse px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]"
      aria-label="Loading applications"
    >
      <div className="h-5 w-40 rounded bg-primary/10" />
      <div className="mt-6 h-10 w-72 rounded bg-primary/10" />
      <div className="mt-10 h-56 max-w-2xl rounded-[24px] bg-white" />
    </div>
  );
}
