import "server-only";
import { developmentPreviewEnabled } from "@/lib/development/flags";
import { streamConfig } from "./stream/config";

/** No fallback to an existing project's URL/service key. */
export function localVideoEnabled(): boolean {
  return developmentPreviewEnabled() && process.env.PADEL_PASSPORT_MOCK_VIDEO === "true"
    && process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:55321";
}

export function requireLocalVideo(): void {
  if (!localVideoEnabled()) throw new Error("Local video preview is unavailable.");
}
export function videoProviderMode(): "mock" | "cloudflare_stream" | null {
  if (streamConfig()) return "cloudflare_stream";
  return localVideoEnabled() ? "mock" : null;
}
