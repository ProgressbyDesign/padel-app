/** Embed shape from Supabase coach_images joins */
export type CoachImageEmbed = {
  image_url?: string | null;
  is_primary?: boolean | null;
};

export function resolveCoachImageUrl(
  images: CoachImageEmbed[] | null | undefined,
  fallbackImageUrl?: string | null
): string | null {
  const list = images ?? [];
  const primary = list.find((img) => img.is_primary && img.image_url?.trim());
  if (primary?.image_url?.trim()) return primary.image_url.trim();
  const first = list.find((img) => img.image_url?.trim());
  if (first?.image_url?.trim()) return first.image_url.trim();
  const legacy = fallbackImageUrl?.trim();
  return legacy || null;
}

export function normalizeCoachImageUrl(url: string): string {
  return url.trim();
}