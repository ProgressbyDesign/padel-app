import { Link2 } from "lucide-react";
import { isVenueSocialPlatform } from "@/lib/venueSocials";

const PLATFORM_GLYPHS = {
  instagram: "◎",
  facebook: "f",
  tiktok: "♪",
  youtube: "▶",
  linkedin: "in",
  x: "X",
} as const;

export default function SocialPlatformIcon({
  platform,
  className = "",
}: {
  platform: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-accent ${className}`}
      aria-hidden
    >
      {isVenueSocialPlatform(platform) ? (
        PLATFORM_GLYPHS[platform]
      ) : (
        <Link2 className="h-4 w-4" />
      )}
    </span>
  );
}
