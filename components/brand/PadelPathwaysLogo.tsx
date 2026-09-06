import Image from "next/image";
import Link from "next/link";

const LOGO_SRC = {
  white: "/brand/padelpathways-logo-white.svg",
  color: "/brand/padelpathways-logo-color.svg",
  dark: "/brand/padelpathways-logo-dark.svg",
} as const;

export type PadelPathwaysLogoVariant = keyof typeof LOGO_SRC;

type PadelPathwaysLogoProps = {
  variant?: PadelPathwaysLogoVariant | "black";
  className?: string;
  href?: string;
  priority?: boolean;
};

function resolveVariant(
  variant: PadelPathwaysLogoProps["variant"]
): PadelPathwaysLogoVariant {
  if (variant === "black") return "color";
  return variant ?? "color";
}

export default function PadelPathwaysLogo({
  variant = "color",
  className = "",
  href = "/",
  priority = true,
}: PadelPathwaysLogoProps) {
  const tone = resolveVariant(variant);

  const logo = (
    <span
      className={`inline-flex h-8 max-w-[168px] items-center sm:h-10 sm:max-w-[220px] lg:h-[42px] lg:max-w-[254px] ${className}`}
    >
      <Image
        src={LOGO_SRC[tone]}
        alt="Padel Pathways"
        width={254}
        height={59}
        className="h-full w-auto shrink-0 object-contain"
        sizes="(max-width: 640px) 168px, (max-width: 1024px) 220px, 254px"
        priority={priority}
      />
    </span>
  );

  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      {logo}
    </Link>
  );
}
