export default function AccountLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1680px] animate-pulse px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]"
      aria-label="Loading account"
    >
      <div className="h-4 w-36 rounded bg-primary/10" />
      <div className="mt-4 h-10 w-full max-w-md rounded bg-primary/10" />
      <div className="mt-8 h-24 rounded-[20px] bg-white" />
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-48 rounded-[20px] bg-white" />
        <div className="h-48 rounded-[20px] bg-white" />
      </div>
    </div>
  );
}
