import type { CompletionGroupScore } from "@/lib/coachProfileCompletion";

type RingProps = {
  percent: number;
  size: number;
  strokeWidth: number;
  label: string;
  emphasize?: boolean;
};

function ProgressRing({
  percent,
  size,
  strokeWidth,
  label,
  emphasize = false,
}: RingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${label}: ${clamped}% complete`}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-primary/10"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-primary transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`font-bold tabular-nums text-primary ${
              emphasize ? "text-xl sm:text-2xl" : "text-sm sm:text-base"
            }`}
          >
            {clamped}%
          </span>
        </div>
      </div>
      <p
        className={`text-center font-semibold text-primary ${
          emphasize ? "text-sm sm:text-base" : "text-xs sm:text-sm"
        }`}
      >
        {label}
      </p>
    </div>
  );
}

export default function CompletionProgressRings({
  overallPercent,
  groupScores,
}: {
  overallPercent: number;
  groupScores: CompletionGroupScore[];
}) {
  const essential =
    groupScores.find((group) => group.id === "essential")?.percent ?? 0;
  const trust = groupScores.find((group) => group.id === "trust")?.percent ?? 0;
  const booking =
    groupScores.find((group) => group.id === "booking")?.percent ?? 0;

  return (
    <div className="flex flex-wrap items-end justify-center gap-6 sm:gap-8">
      <ProgressRing
        percent={overallPercent}
        size={120}
        strokeWidth={10}
        label="Overall"
        emphasize
      />
      <div className="flex flex-wrap items-end justify-center gap-5 sm:gap-6">
        <ProgressRing
          percent={essential}
          size={84}
          strokeWidth={8}
          label="Essential"
        />
        <ProgressRing percent={trust} size={84} strokeWidth={8} label="Trust" />
        <ProgressRing
          percent={booking}
          size={84}
          strokeWidth={8}
          label="Booking"
        />
      </div>
    </div>
  );
}
