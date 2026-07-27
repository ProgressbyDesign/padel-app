type AccountAvatarProps = {
  url?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "overlay";
  className?: string;
};

function initialsFrom(name?: string | null, email?: string | null): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    const letters = parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "");
    if (letters.join("")) return letters.join("");
  }
  const trimmedEmail = email?.trim();
  if (trimmedEmail) return trimmedEmail[0]?.toUpperCase() ?? "A";
  return "A";
}

const SIZE_CLASS = {
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-20 w-20 text-2xl",
} as const;

export default function AccountAvatar({
  url,
  name,
  email,
  size = "md",
  tone = "default",
  className = "",
}: AccountAvatarProps) {
  const sizeClass = SIZE_CLASS[size];
  const initials = initialsFrom(name, email);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- account avatars use Supabase public URLs.
      <img
        src={url}
        alt=""
        className={`${sizeClass} rounded-full object-cover ${className}`.trim()}
      />
    );
  }

  const toneClass =
    tone === "overlay"
      ? "bg-white/15 text-white"
      : "bg-primary text-accent";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold ${toneClass} ${sizeClass} ${className}`.trim()}
      aria-hidden
    >
      {initials}
    </span>
  );
}

