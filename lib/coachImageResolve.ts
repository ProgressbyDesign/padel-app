/** Embed shape from Supabase coach_images joins */
export type CoachImageEmbed = {
  image_url?: string | null;
  is_primary?: boolean | null;
};

export function resolveCoachImageUrl(
  images: CoachImageEmbed[] | null | undefined,
  fallbackImageUrl?: string | null
): string | null {
  const gallery = resolveCoachGalleryUrls(images, fallbackImageUrl);
  return gallery[0] ?? null;
}

/** Primary-first gallery URLs; falls back to legacy `image_url` when embeds are empty. */
export function resolveCoachGalleryUrls(
  images: CoachImageEmbed[] | null | undefined,
  fallbackImageUrl?: string | null
): string[] {
  const list = [...(images ?? [])].sort(
    (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
  );
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const img of list) {
    const url = img.image_url?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  const legacy = fallbackImageUrl?.trim();
  if (legacy && !seen.has(legacy)) urls.push(legacy);
  return urls;
}

export function normalizeCoachImageUrl(url: string): string {
  return url.trim();
}