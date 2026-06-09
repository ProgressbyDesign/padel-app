import { ArrowRight } from "lucide-react";

type CardArrowButtonProps = {
  className?: string;
  accent?: "lime" | "dark";
};

export default function CardArrowButton({ className = "", accent = "lime" }: CardArrowButtonProps) {
  const circle =
    accent === "lime"
      ? "bg-accent text-primary"
      : "bg-[#171c1c] text-accent";

  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${circle} ${className}`}
      aria-hidden
    >
      <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
    </span>
  );
}