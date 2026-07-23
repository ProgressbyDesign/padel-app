export const VENUE_IMAGES_BUCKET = "venue-images";
export const MAX_VENUE_IMAGES = 10;
export const MAX_VENUE_UPLOAD_BATCH = 4;
export const MAX_VENUE_IMAGE_BYTES = 8 * 1024 * 1024;

export const VENUE_IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type VenueImageMimeType = keyof typeof VENUE_IMAGE_MIME_EXTENSIONS;

export type VenueImageRow = {
  id: string;
  venue_id: string;
  url: string;
  is_primary: boolean;
  created_at: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGED_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

export function isVenueImageMimeType(
  value: string
): value is VenueImageMimeType {
  return value in VENUE_IMAGE_MIME_EXTENSIONS;
}

export function createVenueImageStoragePath(
  venueId: string,
  mimeType: VenueImageMimeType
): string {
  if (!UUID_PATTERN.test(venueId)) {
    throw new Error("Invalid venue identifier.");
  }
  const extension = VENUE_IMAGE_MIME_EXTENSIONS[mimeType];
  return `venues/${venueId}/${crypto.randomUUID()}.${extension}`;
}

export function isManagedVenueImageStoragePath(
  storagePath: string,
  venueId: string
): boolean {
  const parts = storagePath.split("/");
  return (
    UUID_PATTERN.test(venueId) &&
    parts.length === 3 &&
    parts[0] === "venues" &&
    parts[1] === venueId &&
    MANAGED_FILENAME_PATTERN.test(parts[2])
  );
}

export function managedVenueImageStoragePathFromUrl(
  imageUrl: string,
  venueId: string
): string | null {
  try {
    const url = new URL(imageUrl);
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!configuredUrl || url.origin !== new URL(configuredUrl).origin) {
      return null;
    }

    const marker = `/storage/v1/object/public/${VENUE_IMAGES_BUCKET}/`;
    if (!url.pathname.startsWith(marker)) return null;

    const encodedPath = url.pathname.slice(marker.length);
    const storagePath = encodedPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");

    return isManagedVenueImageStoragePath(storagePath, venueId)
      ? storagePath
      : null;
  } catch {
    return null;
  }
}

export function sortVenueImages(images: VenueImageRow[]): VenueImageRow[] {
  return [...images].sort((left, right) => {
    if (left.is_primary !== right.is_primary) {
      return left.is_primary ? -1 : 1;
    }
    const createdComparison = (left.created_at ?? "\uffff").localeCompare(
      right.created_at ?? "\uffff"
    );
    return createdComparison || left.id.localeCompare(right.id);
  });
}
