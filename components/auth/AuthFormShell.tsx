import Link from "next/link";
import PadelPathwaysLogo from "@/components/brand/PadelPathwaysLogo";

type AuthFormShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export default function AuthFormShell({
  title,
  description,
  children,
}: AuthFormShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1680px] justify-center px-4 py-10 sm:px-6 sm:py-16 lg:px-[120px]">
      <section className="w-full max-w-md rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(3,19,34,0.08)] sm:p-8">
        <div className="mb-7">
          <PadelPathwaysLogo className="h-9" />
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-primary">{title}</h1>
          <p className="mt-2 text-base leading-6 text-primary/65">{description}</p>
        </div>
        {children}
        <p className="mt-7 text-center text-xs leading-5 text-primary/50">
          By continuing, you agree to use Padel Pathways responsibly.{" "}
          <Link href="/contact" className="font-medium text-primary underline underline-offset-4">
            Contact us
          </Link>{" "}
          if you need help.
        </p>
      </section>
    </div>
  );
}
