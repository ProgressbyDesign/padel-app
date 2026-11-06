import "server-only";
import { createHash } from "node:crypto";
import { createClient as workerClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { CloudflareStream, type StreamVideo } from "./cloudflare";
import { requireStreamConfig, StreamError, type StreamConfig } from "./config";
import { openCapability, sealCapability, verifyStreamSignature } from "./crypto";

export type StreamSession = { id: string; order_id: string; player_id: string; attempt_id: string; phase: string; provider_uid: string | null; account_id: string | null; upload_ciphertext: string | null; expires_at: string; declared_bytes: number; max_bytes: number; max_seconds: number; mime_type: string; created_at: string; updated_at: string; deletion_reason: string | null; delete_after: string | null };
export type StreamStore = { call<T>(action: string, data: Record<string, unknown>): Promise<T> };
export function streamStore(config: StreamConfig): StreamStore {
  const client = workerClient("http://127.0.0.1:55321", config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { async call<T>(action: string, data: Record<string, unknown>) {
    const result = await client.rpc("passport_stream_worker", { p_action: action, p_data: { ...data, account_id: config.accountId } });
    if (result.error) {
      if (action === "get" && result.error.code === "42501") throw new StreamError("NOT_FOUND", "Video unavailable.", 404);
      throw new StreamError("STATE_CONFLICT", "The upload status changed. Refresh your assessment and retry.", 409, true);
    }
    return result.data as T;
  } };
}
export const uuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export async function authorisedStreamOrder(orderId: string, ownerOnly: boolean) {
  requireStreamConfig();
  if (!uuid(orderId)) throw new StreamError("NOT_FOUND", "Assessment unavailable.", 404);
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) throw new StreamError("UNAUTHENTICATED", "Sign in to continue.", 401);
  const { data: order, error } = await client.from("pp_orders").select("id,player_id,active_attempt_id,payment_state,refund_state,state").eq("id", orderId).maybeSingle();
  if (error || !order || (ownerOnly && order.player_id !== auth.data.claims.sub)) throw new StreamError("NOT_FOUND", "Assessment unavailable.", 404);
  return { client, order };
}
export function requireSameOrigin(request: Request): void {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    if (origin.host !== (request.headers.get("host") ?? new URL(request.url).host)) throw Error();
  } catch { throw new StreamError("ORIGIN_DENIED", "Use your assessment page to change an upload.", 403); }
}
export function requireOwnedVideo(video: StreamVideo, session: StreamSession): void {
  if (video.uid !== session.provider_uid || video.creator !== session.id || video.requireSignedURLs !== true) throw new StreamError("OWNERSHIP_MISMATCH", "The private video could not be verified.", 409);
}

/** Network work occurs outside SQL transactions; SQL applies the result atomically. */
export class StreamLifecycle {
  constructor(private config: StreamConfig, private store: StreamStore, private provider: CloudflareStream) {}
  async session(id: string): Promise<StreamSession> { return this.store.call("get", { id }); }
  async provision(id: string): Promise<{ phase: string; uploadUrl?: string; expiresAt: string }> {
    let session = await this.session(id);
    if (session.phase === "reserved") {
      const claim = await this.store.call<{ claimed: boolean }>("claim", { id, max_bytes: this.config.maxBytes });
      if (claim.claimed) {
        try {
          const created = await this.provider.createSession(session);
          session = await this.store.call<StreamSession>("bind", { id, uid: created.uid, ciphertext: sealCapability(created.uploadUrl, this.config.capabilityKey, id) });
        } catch (error) {
          await this.store.call("uncertain", { id });
          throw error;
        }
      } else session = await this.session(id);
    }
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      session = await this.reconcile(session);
      if (["failed", "uncertain", "creating", "reserved"].includes(session.phase)) throw new StreamError("UPLOAD_EXPIRED", "Upload permission expired. Retry to start a free new attempt.", 410);
    }
    if (session.phase === "bound" && session.upload_ciphertext) return { phase: "uploading", uploadUrl: openCapability(session.upload_ciphertext, this.config.capabilityKey, id), expiresAt: session.expires_at };
    if (["processing", "ready"].includes(session.phase)) return { phase: session.phase, expiresAt: session.expires_at };
    throw new StreamError("SESSION_PENDING", "This upload session needs reconciliation. Check its status before retrying.", 409, true);
  }
  async reconcile(session: StreamSession, eventHash?: string): Promise<StreamSession> {
    if (["ready", "failed", "delete_pending", "deleted"].includes(session.phase)) return session;
    if (!session.provider_uid) {
      // A timed-out creation is never blindly repeated. The non-PII creator ID
      // recovers a provider-issued record if it eventually became visible.
      if (session.phase === "uncertain" || session.phase === "creating") {
        const candidates = (await this.provider.videosForCreator(session.id)).filter((video) => video.creator === session.id);
        if (candidates.length === 1) {
          if (!candidates[0].requireSignedURLs) throw new StreamError("PRIVACY_MISMATCH", "The private upload needs operator review.", 409);
          session = await this.store.call("bind", { id: session.id, uid: candidates[0].uid });
        } else if (candidates.length > 1) throw new StreamError("AMBIGUOUS_CREATION", "The upload needs operator review.", 409);
      }
      if (!session.provider_uid) {
        if (Date.parse(session.expires_at) <= Date.now()) return this.store.call("expire", { id: session.id });
        return session;
      }
    }
    const video = await this.provider.video(session.provider_uid!);
    requireOwnedVideo(video, session);
    let stage = "pending", code: string | undefined;
    if (video.status.state === "error") { stage = "failed"; code = "PROVIDER_PROCESSING_FAILED"; }
    else if (video.status.state === "ready" && video.readyToStream) {
      if (!Number.isFinite(video.duration) || video.duration! <= 0 || video.duration! > session.max_seconds || !Number.isSafeInteger(video.size) || video.size! <= 0 || video.size! > Math.min(session.max_bytes, session.declared_bytes) || !((video.input?.width ?? 0) > 0) || !((video.input?.height ?? 0) > 0)) {
        stage = "failed"; code = "MEDIA_LIMIT_VIOLATION";
      } else stage = "ready";
    } else if (["queued", "inprogress"].includes(video.status.state)) stage = "processing";
    else if (Date.parse(session.expires_at) <= Date.now()) { stage = "failed"; code = "UPLOAD_EXPIRED"; }
    await this.store.call("reconcile", { id: session.id, uid: session.provider_uid, stage, duration: video.duration, bytes: video.size, error_code: code, event_hash: eventHash });
    return this.session(session.id);
  }
  async webhook(body: Buffer, signature: string | null): Promise<void> {
    verifyStreamSignature(body, signature, this.config.webhookSecret);
    let uid: string;
    try { uid = JSON.parse(body.toString("utf8")).uid; if (typeof uid !== "string" || !/^[a-f0-9]{32}$/.test(uid)) throw Error(); }
    catch { throw new StreamError("INVALID_WEBHOOK", "Invalid webhook.", 400); }
    const session = await this.store.call<StreamSession>("get", { uid });
    await this.reconcile(session, createHash("sha256").update(body).digest("hex"));
  }
  async deleteOwned(session: StreamSession): Promise<void> {
    if (session.phase === "deleted") return;
    if (session.phase !== "delete_pending") throw new StreamError("DELETE_DENIED", "Deletion has not been authorised.", 403);
    try {
      const videos = session.provider_uid ? [{ uid: session.provider_uid }] : await this.provider.videosForCreator(session.id);
      for (const item of videos) {
        let video: StreamVideo;
        try { video = await this.provider.video(item.uid); }
        catch (error) { if (error instanceof StreamError && error.code === "PROVIDER_HTTP_404") continue; throw error; }
        if (video.creator !== session.id || (session.provider_uid && video.uid !== session.provider_uid)) throw new StreamError("DELETE_OWNERSHIP", "Video ownership mismatch.", 409);
        await this.provider.deleteVideo(video.uid);
      }
      // Uncertain creation can appear later: do not lose orphan reconciliation
      // until its upload capability has expired and the provider query is final.
      if (!session.provider_uid && Date.parse(session.expires_at) > Date.now()) return;
      await this.store.call("deleted", { id: session.id });
    } catch (error) { await this.store.call("delete_failed", { id: session.id }); throw error; }
  }
}
export function streamLifecycle(config = requireStreamConfig()) { return new StreamLifecycle(config, streamStore(config), new CloudflareStream(config)); }
