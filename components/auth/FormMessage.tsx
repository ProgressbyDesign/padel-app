type FormMessageProps = {
  status: "error" | "success";
  children: React.ReactNode;
};

export default function FormMessage({ status, children }: FormMessageProps) {
  return (
    <p
      role={status === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm leading-5 ${
        status === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {children}
    </p>
  );
}
