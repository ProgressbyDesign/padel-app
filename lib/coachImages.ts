export const COACH_IMAGES_BUCKET = "coach-images";
export const MAX_COACH_IMAGES = 10;
export const MAX_COACH_UPLOAD_BATCH = 4;
export const MAX_COACH_IMAGE_BYTES = 8 * 1024 * 1024;

export const COACH_IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type CoachImageMimeType = keyof typeof COACH_IMAGE_MIME_EXTENSIONS;

export type CoachImageRow = {
  id: string;
  coach_id: string;
  image_url: string;
  is_primary: boolean;
  created_at: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGED_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

export function isCoachImageMimeType(
  value: string
): value is CoachImageMimeType {
  return value in COACH_IMAGE_MIME_EXTENSIONS;
}

export function createCoachImageStoragePath(
  coachId: string,
  mimeType: CoachImageMimeType
): string {
  if (!UUID_PATTERN.test(coachId)) {
    throw new Error("Invalid coach identifier.");
  }
  const extension = COACH_IMAGE_MIME_EXTENSIONS[mimeType];
  return `coaches/${coachId}/${crypto.randomUUID()}.${extension}`;
}

export function isManagedCoachImageStoragePath(
  storagePath: string,
  coachId: string
): boolean {
  const parts = storagePath.split("/");
  return (
    UUID_PATTERN.test(coachId) &&
    parts.length === 3 &&
    parts[0] === "coaches" &&
    parts[1] === coachId &&
    MANAGED_FILENAME_PATTERN.test(parts[2])
  );
}

export function managedCoachImageStoragePathFromUrl(
  imageUrl: string,
  coachId: string
): string | null {
  try {
    const url = new URL(imageUrl);
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!configuredUrl || url.origin !== new URL(configuredUrl).origin) {
      return null;
    }

    const marker = `/storage/v1/object/public/${COACH_IMAGES_BUCKET}/`;
    if (!url.pathname.startsWith(marker)) return null;

    const encodedPath = url.pathname.slice(marker.length);
    const storagePath = encodedPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");

    return isManagedCoachImageStoragePath(storagePath, coachId)
      ? storagePath
      : null;
  } catch {
    return null;
  }
}

export function sortCoachImages(images: CoachImageRow[]): CoachImageRow[] {
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
