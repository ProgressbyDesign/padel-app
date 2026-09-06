import Link from "next/link";
import CardArrowButton from "@/components/home/CardArrowButton";

type HomeBentoRegisterCardProps = {
  href: string;
  eyebrow: string;
  title: string;
  copy: string;
  cta: string;
  tone: "coach" | "venue";
};

export default function HomeBentoRegisterCard({
  href,
  eyebrow,
  title,
  copy,
  cta,
  tone,
}: HomeBentoRegisterCardProps) {
  const surface =
    tone === "coach"
      ? "bg-accent text-primary hover:brightness-[0.98]"
      : "bg-[#171c1c] text-surface hover:bg-[#1f2626]";
  const muted = tone === "coach" ? "text-primary/70" : "text-surface/75";
  const arrowAccent = tone === "coach" ? "dark" : "lime";

  return (
    <Link
      href={href}
      className={`group flex min-h-[331px] flex-1 flex-col justify-between rounded-[20px] p-6 transition sm:p-8 ${surface}`}
    >
      <div>
        <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${muted}`}>
          {eyebrow}
        </p>
        <h3 className="mt-3">
          {title}
        </h3>
        <p className={`mt-3 max-w-sm text-base leading-7 sm:text-lg ${muted}`}>{copy}</p>
      </div>
      <span className="mt-8 inline-flex items-center gap-3 text-sm font-semibold">
        {cta}
        <CardArrowButton accent={arrowAccent} />
      </span>
    </Link>
  );
}
