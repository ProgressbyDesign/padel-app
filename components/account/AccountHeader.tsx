import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

type AccountHeaderProps = {
  email: string;
};

export default function AccountHeader({ email }: AccountHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-primary/10 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/45">
          Signed in as
        </p>
        <p className="mt-1 truncate text-base font-medium text-primary">
          {email || "Your account"}
        </p>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/15 px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/25 hover:bg-surface sm:w-auto"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Log out
        </button>
      </form>
    </div>
  );
}
