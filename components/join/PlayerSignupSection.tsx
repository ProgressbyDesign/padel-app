import Link from "next/link";
import SignupForm from "@/components/auth/SignupForm";

export default function PlayerSignupSection({
  signedIn,
}: {
  signedIn: boolean;
}) {
  return (
    <section
      id="register"
      className="scroll-mt-24 border-t border-primary/10 bg-surface py-16 sm:py-24"
      aria-labelledby="player-register-heading"
    >
      <div className="mx-auto grid max-w-[1100px] items-start gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/45">
            Ready to start?
          </p>
          <h2
            id="player-register-heading"
            className="mt-3"
          >
            Create your free player account
          </h2>
          <p className="mt-4 text-base leading-7 text-primary/70">
            It is free, and we do not ask for payment details. Your account lets
            you start using Padel Pathways — search coaches, explore venues, and
            keep your activity in one place.
          </p>
        </div>

        <div className="rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(3,19,34,0.06)] sm:p-8">
          {signedIn ? (
            <div className="space-y-4">
              <h3 className="text-xl text-primary">You are already signed in</h3>
              <p className="text-sm leading-6 text-primary/65">
                Continue to your account to manage bookings and your player
                journey.
              </p>
              <Link
                href="/account"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-base font-semibold text-accent"
              >
                Go to my account
              </Link>
            </div>
          ) : (
            <SignupForm
              nextPath="/account"
              submitLabel="Create my player account"
            />
          )}
        </div>
      </div>
    </section>
  );
}
