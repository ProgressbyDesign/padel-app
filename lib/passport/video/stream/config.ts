import "server-only";
import { developmentPreviewEnabled } from "@/lib/development/flags";

export class StreamError extends Error {
  constructor(readonly code: string, message: string, readonly status = 503, readonly retryable = false) { super(message); }
}
export type StreamConfig = { accountId: string; apiToken: string; webhookSecret: string; customerCode: string; capabilityKey: string; serviceKey: string; maxBytes: number };
export function streamConfig(): StreamConfig | null {
  // Deliberately remains a local release gate in C.2. Adapter code is real;
  // production activation requires a separate reviewed release change.
  if (!developmentPreviewEnabled() || process.env.PADEL_PASSPORT_STREAM_ENABLED !== "true" || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55321") return null;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "", apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN ?? "";
  const webhookSecret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET ?? "", customerCode = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE ?? "";
  const capabilityKey = process.env.PADEL_PASSPORT_STREAM_CAPABILITY_KEY ?? "", serviceKey = process.env.PADEL_PASSPORT_STREAM_SERVICE_KEY ?? "";
  const maxBytes = Number(process.env.PADEL_PASSPORT_VIDEO_MAX_BYTES ?? 50 * 1024 * 1024);
  if (!/^[a-f0-9]{32}$/.test(accountId) || !apiToken || !webhookSecret || !/^[a-zA-Z0-9]+$/.test(customerCode) || !serviceKey
    || !/^[A-Za-z0-9+/]{43}=$/.test(capabilityKey) || Buffer.from(capabilityKey, "base64").length !== 32
    || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 512 * 1024 * 1024) return null;
  return { accountId, apiToken, webhookSecret, customerCode, capabilityKey, serviceKey, maxBytes };
}
export function requireStreamConfig(): StreamConfig {
  const config = streamConfig();
  if (!config) throw new StreamError("UNAVAILABLE", "Video uploads are not available.", 404);
  return config;
}
/** Allowlisted structured fields only. Never log provider bodies/URLs/tokens. */
export function logStreamFailure(operation: string, error: unknown): void {
  console.error("[passport-stream]", { operation, code: error instanceof StreamError ? error.code : "INTERNAL", retryable: error instanceof StreamError && error.retryable });
}
