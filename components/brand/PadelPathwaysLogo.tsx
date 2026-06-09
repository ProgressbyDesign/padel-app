import Image from "next/image";
import Link from "next/link";

type PadelPathwaysLogoProps = {
  variant?: "white" | "black";
  className?: string;
  href?: string;
};

export default function PadelPathwaysLogo({
  variant = "black",
  className = "",
  href = "/",
}: PadelPathwaysLogoProps) {
  const tone = variant === "white" ? "brightness-0 invert" : "";

  const logo = (
    <span className={`inline-flex h-[42px] w-[254px] max-w-full items-center ${className}`}>
      <Image
        src="/brand/padelpathways-logo-color.svg"
        alt=""
        width={250}
        height={48}
        className={`h-full w-auto shrink-0 object-contain ${tone}`}
        priority
      />
      <span className="sr-only">Padel Pathways</span>
    </span>
  );

  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      {logo}
    </Link>
  );
}