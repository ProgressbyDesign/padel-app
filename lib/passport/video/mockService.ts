import "server-only";
import { createClient as createWorkerClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, isAbsolute } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { runPassportCommand } from "../operations";
import { recordTrustedPassportEvent } from "../providerEvents";
import type { AssessmentOrder, VideoSubmissionAttempt } from "../types";
import { requireLocalVideo } from "./localConfig";
import { MAX_VIDEO_BYTES, validateVideo, videoLimit } from "./validation";
import { probeLocalVideo } from "./probe";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Never under public/. No client path, URL, provider ID or filename is accepted.
const directory = resolve(process.cwd(), ".next/cache/passport-private-mock");
const locks = new Set<string>(); // Mock is intentionally single-process, not production coordination.
export class VideoRequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

async function authorisedOrder(id: string, ownerOnly: boolean) {
  requireLocalVideo();
  if (!uuid.test(id)) throw new VideoRequestError("Assessment not found.", 404);
  const client = await createClient();
  const { data: auth, error } = await client.auth.getClaims();
  if (error || !auth?.claims?.sub) throw new VideoRequestError("Sign in to continue.", 401);
  // The user's RLS client, never the worker, decides record visibility.
  const response = await client.from("pp_orders").select("*").eq("id", id).maybeSingle();
  const order = response.data as AssessmentOrder | null;
  if (response.error || !order || (ownerOnly && order.player_id !== auth.claims.sub)) throw new VideoRequestError("Assessment not found.", 404);
  return { client, order };
}

function worker() {
  requireLocalVideo();
  const key = process.env.PADEL_PASSPORT_MOCK_SERVICE_KEY;
  const probe = process.env.PADEL_PASSPORT_MOCK_FFPROBE;
  if (!key || !probe || !isAbsolute(probe) || !existsSync(probe)) throw new VideoRequestError("Local video tooling is not configured.", 503);
  return createWorkerClient("http://127.0.0.1:55321", key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function boundedBody(request: Request): Promise<Buffer> {
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_VIDEO_BYTES) throw new VideoRequestError("Choose a video smaller than 50 MB.", 413);
  if (!request.body) throw new VideoRequestError("Choose a video first.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_VIDEO_BYTES) { await reader.cancel(); throw new VideoRequestError("Choose a video smaller than 50 MB.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

export async function receiveMockVideo(request: Request, orderId: string): Promise<void> {
  // Fail closed before reading bytes or allocating an attempt.
  const { client, order } = await authorisedOrder(orderId, true);
  const origin = request.headers.get("origin");
  // Next may reconstruct request.url with an internal hostname. Compare the
  // browser's immutable Origin with the actual Host, not a forwarded header.
  if (!origin || new URL(origin).host !== (request.headers.get("host") ?? new URL(request.url).host)) throw new VideoRequestError("Please upload from your assessment page.", 403);
  const requestId = request.headers.get("x-request-id") ?? "";
  if (!uuid.test(requestId)) throw new VideoRequestError("A valid upload request is required.");
  if (order.payment_state !== "paid" || order.refund_state !== "none" || !["awaiting_submission", "replacement_requested", "processing", "ready_for_review"].includes(order.state)) {
    throw new VideoRequestError("This order is not accepting a video. No payment has been changed.", 409);
  }
  const transport = worker();
  if (locks.has(order.id)) throw new VideoRequestError("An upload is already running. Check its status before retrying.", 409);
  locks.add(order.id);
  let temporary: string | undefined;
  try {
    // Read/inspect before allocating: an interrupted transfer creates no DB attempt.
    const bytes = await boundedBody(request);
    const mime = request.headers.get("content-type") ?? "";
    const preliminary = validateVideo({ bytes: bytes.length, mime, duration: 1 });
    if (preliminary) throw new VideoRequestError(preliminary);
    await mkdir(directory, { recursive: true });
    temporary = join(directory, `${randomUUID()}.pending`);
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    const metadata = await probeLocalVideo(temporary).catch(() => {
      throw new VideoRequestError("This video could not be played. Export an H.264 MP4 copy and try again.", 422);
    });
    const invalid = validateVideo({ ...metadata, bytes: bytes.length }, videoLimit(order.terms_snapshot.max_video_seconds, order.terms_snapshot.evidence_requirements.max_seconds));
    if (invalid) throw new VideoRequestError(invalid);
    let attemptId = order.active_attempt_id;
    if (["awaiting_submission", "replacement_requested"].includes(order.state)) {
      attemptId = (await runPassportCommand("begin_attempt", { order_id: orderId }, requestId)).id ?? null;
    }
    if (!attemptId || !uuid.test(attemptId)) throw new VideoRequestError("Refresh your assessment and retry.", 409);
    const { data: current } = await client.from("pp_orders").select("active_attempt_id").eq("id", orderId).maybeSingle();
    if (current?.active_attempt_id !== attemptId) throw new VideoRequestError("The upload attempt has changed. Refresh before retrying.", 409);
    const { data, error } = await client.from("pp_submission_attempts").select("*").eq("id", attemptId).eq("order_id", orderId).maybeSingle();
    const attempt = data as VideoSubmissionAttempt | null;
    if (error || !attempt) throw new VideoRequestError("Refresh your assessment and retry.", 409);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const reference = `mock:${attemptId}:${digest}` as const;
    if (attempt.provider_reference && attempt.provider_reference !== reference) throw new VideoRequestError("Retry with the same video, or wait for your assessor to request a replacement.", 409);
    // Content-addressed bytes prevent a competing/stale request from replacing
    // the file selected by the transactional provider reference.
    const target = join(directory, `${attemptId}-${digest}.video`);
    if (attempt.upload_state === "ready") {
      // Lost success response: restore the identical local bytes, no second event/SLA.
      await recordTrustedPassportEvent(transport, "media", `${reference}:ready`, {
        order_id: orderId, attempt_id: attemptId, provider: "mock", provider_reference: reference,
        stage: "ready", duration_seconds: metadata.duration, bytes: bytes.length, mime_type: metadata.mime,
      });
      await rename(temporary, target); temporary = undefined; return;
    }
    if (attempt.upload_state === "failed" || attempt.validation_state !== "pending") throw new VideoRequestError("Refresh your assessment before replacing this video.", 409);
    // Retain bytes privately before readiness. Same-content retries use stable event IDs.
    await rename(temporary, target); temporary = undefined;
    const base = { order_id: orderId, attempt_id: attemptId, provider: "mock" as const, provider_reference: reference };
    await recordTrustedPassportEvent(transport, "media", `${reference}:uploaded`, { ...base, stage: "uploaded" });
    await recordTrustedPassportEvent(transport, "media", `${reference}:processing`, { ...base, stage: "processing" });
    await recordTrustedPassportEvent(transport, "media", `${reference}:ready`, { ...base, stage: "ready", duration_seconds: metadata.duration, bytes: bytes.length, mime_type: metadata.mime });
  } finally {
    if (temporary) await rm(temporary, { force: true });
    locks.delete(order.id);
  }
}

export async function readMockVideo(orderId: string, attemptId?: string): Promise<{ bytes: Buffer; mime: string }> {
  const { client, order } = await authorisedOrder(orderId, false);
  if (!order.active_attempt_id || !["ready_for_review", "in_review", "replacement_requested", "completed"].includes(order.state)) throw new VideoRequestError("Video is not ready.", 409);
  // Recheck attempt RLS on every playback; a suspended/unassigned assessor loses access.
  if (attemptId && !uuid.test(attemptId)) throw new VideoRequestError("Video not available.", 404);
  const { data } = await client.from("pp_submission_attempts").select("id,provider,provider_reference,upload_state,mime_type").eq("id", attemptId ?? order.active_attempt_id).eq("order_id", order.id).maybeSingle();
  if (!data || data.provider !== "mock" || data.upload_state !== "ready" || !uuid.test(data.id)) throw new VideoRequestError("Video not available.", 404);
  const prefix = `mock:${data.id}:`;
  const digest = typeof data.provider_reference === "string" && data.provider_reference.startsWith(prefix) ? data.provider_reference.slice(prefix.length) : "";
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new VideoRequestError("Video not available.", 404);
  try { return { bytes: await readFile(join(directory, `${data.id}-${digest}.video`)), mime: data.mime_type }; }
  catch { throw new VideoRequestError("This temporary local clip is no longer available.", 404); }
}
