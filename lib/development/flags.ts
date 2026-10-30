import "server-only";

/** Local opt-in only. A production build is always closed, even if the flag is set. */
export function developmentPreviewEnabled(): boolean {
  return process.env.NODE_ENV === "development"
    && !process.env.VERCEL
    && process.env.PADEL_PASSPORT_PREVIEW === "true";
}
