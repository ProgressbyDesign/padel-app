export const MAX_VENUE_SOCIAL_URL_LENGTH = 2048;

export const VENUE_SOCIAL_PLATFORMS = [
  {
    value: "instagram",
    label: "Instagram",
    hosts: ["instagram.com", "www.instagram.com"],
  },
  {
    value: "facebook",
    label: "Facebook",
    hosts: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  },
  {
    value: "tiktok",
    label: "TikTok",
    hosts: ["tiktok.com", "www.tiktok.com"],
  },
  {
    value: "youtube",
    label: "YouTube",
    hosts: ["youtube.com", "www.youtube.com", "youtu.be"],
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    hosts: ["linkedin.com", "www.linkedin.com"],
  },
  {
    value: "x",
    label: "X",
    hosts: ["x.com", "www.x.com"],
  },
] as const;

export const MAX_VENUE_SOCIALS = VENUE_SOCIAL_PLATFORMS.length;

export type VenueSocialPlatform =
  (typeof VENUE_SOCIAL_PLATFORMS)[number]["value"];

export type VenueSocialRow = {
  id: string | number;
  venue_id: string;
  platform: string;
  url: string;
  is_primary: boolean;
  created_at: string | null;
};

export type VenueSocialInput = {
  platform: string;
  url: string;
  isPrimary: boolean;
};

export type VenueSocialUrlResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

const PLATFORM_ORDER = new Map<string, number>(
  VENUE_SOCIAL_PLATFORMS.map((platform, index) => [platform.value, index])
);

export function isVenueSocialPlatform(
  value: string
): value is VenueSocialPlatform {
  return VENUE_SOCIAL_PLATFORMS.some(
    (platform) => platform.value === value
  );
}

export function venueSocialPlatformLabel(platform: string): string {
  return (
    VENUE_SOCIAL_PLATFORMS.find((option) => option.value === platform)?.label ??
    platform
  );
}

export function isValidVenueSocialId(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function parseSafeHttpsUrl(rawValue: string): URL | null {
  const value = rawValue.trim();
  if (
    !value ||
    value.length > MAX_VENUE_SOCIAL_URL_LENGTH ||
    /\s/.test(value)
  ) {
    return null;
  }

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function normalizedUrlString(url: URL): string {
  if (url.pathname === "/") {
    return `${url.origin}${url.search}${url.hash}`;
  }
  if (url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

export function normalizeVenueSocialUrl(
  platform: VenueSocialPlatform,
  rawValue: string
): VenueSocialUrlResult {
  const url = parseSafeHttpsUrl(rawValue);
  if (!url) {
    return {
      ok: false,
      error: "Enter a valid HTTPS URL without credentials or spaces.",
    };
  }

  const platformConfig = VENUE_SOCIAL_PLATFORMS.find(
    (option) => option.value === platform
  );
  if (
    !platformConfig ||
    !(platformConfig.hosts as readonly string[]).includes(url.hostname)
  ) {
    return {
      ok: false,
      error: `Enter a valid ${venueSocialPlatformLabel(platform)} URL.`,
    };
  }

  return { ok: true, value: normalizedUrlString(url) };
}

export function normalizeSafeExternalHttpsUrl(
  rawValue: string
): string | null {
  const url = parseSafeHttpsUrl(rawValue);
  return url ? normalizedUrlString(url) : null;
}

export function venueSocialVisibleUrl(urlValue: string): string {
  const normalized = normalizeSafeExternalHttpsUrl(urlValue);
  if (!normalized) return "Invalid legacy URL";

  const url = new URL(normalized);
  const host = url.hostname.replace(/^www\./, "");
  const visible = `${host}${url.pathname === "/" ? "" : url.pathname}`;
  return visible.length > 46 ? `${visible.slice(0, 43)}…` : visible;
}

export function sortVenueSocials(
  socials: VenueSocialRow[]
): VenueSocialRow[] {
  return [...socials].sort((left, right) => {
    if (left.is_primary !== right.is_primary) {
      return left.is_primary ? -1 : 1;
    }

    const platformComparison =
      (PLATFORM_ORDER.get(left.platform) ?? Number.MAX_SAFE_INTEGER) -
      (PLATFORM_ORDER.get(right.platform) ?? Number.MAX_SAFE_INTEGER);
    if (platformComparison !== 0) return platformComparison;

    const createdComparison = (left.created_at ?? "\uffff").localeCompare(
      right.created_at ?? "\uffff"
    );
    if (createdComparison !== 0) return createdComparison;

    return String(left.id).localeCompare(String(right.id), undefined, {
      numeric: true,
    });
  });
}

export function validPublicVenueSocials(
  socials: VenueSocialRow[] | null | undefined
): VenueSocialRow[] {
  const seenPlatforms = new Set<VenueSocialPlatform>();

  return sortVenueSocials(socials ?? []).flatMap((social) => {
    if (!isVenueSocialPlatform(social.platform)) return [];
    if (seenPlatforms.has(social.platform)) return [];

    const normalized = normalizeVenueSocialUrl(social.platform, social.url);
    if (!normalized.ok) return [];

    seenPlatforms.add(social.platform);
    return [{ ...social, url: normalized.value }];
  });
}
