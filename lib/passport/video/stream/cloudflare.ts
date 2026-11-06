import "server-only";
import { StreamError, type StreamConfig } from "./config";

export type StreamVideo = { uid: string; creator: string | null; requireSignedURLs: boolean; readyToStream: boolean; status: { state: string }; duration?: number; size?: number; input?: { width?: number; height?: number } };
type Envelope<T> = { success: boolean; result: T };
export const validUid = (uid: string) => /^[a-f0-9]{32}$/.test(uid);
export function validateUploadUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "upload.videodelivery.net" || url.username || url.password || url.port) throw new StreamError("INVALID_UPLOAD_URL", "The upload provider returned an invalid session.");
  return url.href;
}

/** Only official fixed-account endpoints; fetch injection exists for fixtures. */
export class CloudflareStream {
  constructor(private config: StreamConfig, private transport: typeof fetch = fetch) {}
  private async request(path: string, init: RequestInit = {}, allowMissing = false): Promise<Response> {
    let response: Response;
    try { response = await this.transport(`https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/stream${path}`, {
      ...init, headers: { Authorization: `Bearer ${this.config.apiToken}`, ...init.headers }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000),
    }); } catch { throw new StreamError("PROVIDER_CONNECTION", "The video service could not be reached. Your order is safe.", 503, true); }
    if (allowMissing && response.status === 404) return response;
    if (!response.ok) throw new StreamError(`PROVIDER_HTTP_${response.status}`, "The video service could not complete this request.", response.status === 429 ? 429 : 503, response.status === 429 || response.status >= 500);
    return response;
  }
  private async result<T>(response: Response): Promise<T> {
    try { const envelope = await response.json() as Envelope<T>; if (!envelope.success || !envelope.result) throw Error(); return envelope.result; }
    catch { throw new StreamError("PROVIDER_RESPONSE", "The video service returned an invalid response."); }
  }
  async createSession(input: { id: string; declared_bytes: number; max_seconds: number; expires_at: string; mime_type: string }): Promise<{ uid: string; uploadUrl: string }> {
    const b64 = (value: string) => Buffer.from(value).toString("base64");
    const response = await this.request("?direct_user=true", { method: "POST", headers: {
      "Tus-Resumable": "1.0.0", "Upload-Length": String(input.declared_bytes), "Upload-Creator": input.id,
      "Upload-Metadata": `maxDurationSeconds ${b64(String(input.max_seconds))},requiresignedurls,expiry ${b64(new Date(input.expires_at).toISOString())},filetype ${b64(input.mime_type)},name ${b64(input.id)}`,
    } });
    const uid = response.headers.get("stream-media-id") ?? "", location = response.headers.get("location");
    if (!validUid(uid) || !location) throw new StreamError("CREATION_UNCERTAIN", "Upload creation needs reconciliation. Do not create another session.", 503, true);
    return { uid, uploadUrl: validateUploadUrl(location) };
  }
  async video(uid: string): Promise<StreamVideo> {
    if (!validUid(uid)) throw new StreamError("INVALID_VIDEO", "Video unavailable.", 404);
    const video = await this.result<StreamVideo>(await this.request(`/${uid}`));
    if (video.uid !== uid) throw new StreamError("VIDEO_MISMATCH", "Video unavailable.", 409);
    return video;
  }
  async videosForCreator(creator: string): Promise<StreamVideo[]> {
    return this.result<StreamVideo[]>(await this.request(`?creator=${encodeURIComponent(creator)}&limit=100`));
  }
  async deleteVideo(uid: string): Promise<void> {
    if (!validUid(uid)) throw new StreamError("INVALID_VIDEO", "Video unavailable.", 404);
    await this.request(`/${uid}`, { method: "DELETE" }, true);
  }
  async playback(uid: string, now = Date.now()): Promise<{ url: string; expiresAt: number }> {
    if (!validUid(uid)) throw new StreamError("INVALID_VIDEO", "Video unavailable.", 404);
    const exp = Math.floor(now / 1000) + 120;
    const result = await this.result<{ token: string }>(await this.request(`/${uid}/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exp, downloadable: false, flags: { original: false } }) }));
    let expiresAt: number;
    try {
      const claims = JSON.parse(Buffer.from(result.token.split(".")[1], "base64url").toString());
      if (claims.sub !== uid || !Number.isSafeInteger(claims.exp) || claims.exp > exp || claims.exp <= now / 1000 || claims.downloadable === true || claims.flags?.original === true) throw Error();
      expiresAt = claims.exp * 1000;
    } catch { throw new StreamError("INVALID_PLAYBACK_TOKEN", "Private playback is unavailable."); }
    return { url: `https://customer-${this.config.customerCode}.cloudflarestream.com/${result.token}/iframe`, expiresAt };
  }
}
