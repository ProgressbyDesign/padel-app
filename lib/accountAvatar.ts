export const ACCOUNT_AVATARS_BUCKET = "account-avatars";
export const MAX_ACCOUNT_AVATAR_BYTES = 5 * 1024 * 1024;

export const ACCOUNT_AVATAR_MIME_TYPES = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
} as const;

export type AccountAvatarMimeType = keyof typeof ACCOUNT_AVATAR_MIME_TYPES;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoragePublicUrlClient = {
  storage: {
    from: (bucket: string) => {
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

export function isAccountAvatarMimeType(
  value: string
): value is AccountAvatarMimeType {
  return value in ACCOUNT_AVATAR_MIME_TYPES;
}

export function accountAvatarStoragePath(userId: string): string {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error("Invalid account identifier.");
  }
  return `accounts/${userId}/avatar`;
}

export function isAccountAvatarStoragePath(
  storagePath: string,
  userId: string
): boolean {
  const parts = storagePath.split("/");
  return (
    UUID_PATTERN.test(userId) &&
    parts.length === 3 &&
    parts[0] === "accounts" &&
    parts[1] === userId &&
    parts[2] === "avatar"
  );
}

export function accountAvatarPublicUrl(
  supabase: StoragePublicUrlClient,
  path: string
): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  const { data } = supabase.storage
    .from(ACCOUNT_AVATARS_BUCKET)
    .getPublicUrl(trimmed);
  return data.publicUrl?.trim() || null;
}

/** Cache-busted public URL for an account avatar storage path. */
export function accountAvatarDisplayUrl(
  path: string | null | undefined,
  updatedAt: string | null | undefined
): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;

  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredUrl) return null;

  const encodedPath = trimmed
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const publicUrl = `${configuredUrl.replace(/\/$/, "")}/storage/v1/object/public/${ACCOUNT_AVATARS_BUCKET}/${encodedPath}`;

  const bust = updatedAt?.trim();
  if (!bust) return publicUrl;
  return `${publicUrl}?v=${encodeURIComponent(bust)}`;
}
