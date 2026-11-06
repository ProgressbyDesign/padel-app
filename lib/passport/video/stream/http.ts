import "server-only";
import { requireStreamConfig, StreamError, logStreamFailure } from "./config";
import { CloudflareStream } from "./cloudflare";
import { authorisedStreamOrder, requireOwnedVideo, requireSameOrigin, streamLifecycle, streamStore, uuid, type StreamSession } from "./service";
import { VIDEO_MIMES, type VideoMime } from "../validation";

export const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
export async function boundedRequest(request: Request, max = 65536): Promise<Buffer> {
  if (Number(request.headers.get("content-length")) > max || !request.body) throw new StreamError("BODY_LIMIT", "Invalid request.", 413);
  const reader = request.body.getReader(); const parts: Uint8Array[] = []; let size = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); throw new StreamError("BODY_LIMIT", "Invalid request.", 413); } parts.push(value); } }
  finally { reader.releaseLock(); }
  return Buffer.concat(parts);
}
export async function sessionEndpoint(request: Request, orderId: string): Promise<Response> {
  const config = requireStreamConfig();
  const { client, order } = await authorisedStreamOrder(orderId, true);
  requireSameOrigin(request);
  if (request.method === "DELETE") {
    const result = await client.rpc("passport_stream_cancel", { p_order: order.id });
    if (result.error) throw new StreamError("CANCEL_DENIED", "This upload cannot be cancelled. Refresh its status.", 409);
    // This branch follows owner authentication AND the actor-authorised cancel
    // RPC above. Revoke only that cancelled attempt's durably owned video.
    try {
      const sessions = await streamStore(config).call<StreamSession[]>("for_order", { order_id: order.id });
      const cancelled = sessions.find((item) => item.attempt_id === order.active_attempt_id);
      if (cancelled?.phase === "delete_pending") await streamLifecycle(config).deleteOwned(cancelled);
    } catch (error) { logStreamFailure("cancel_cleanup", error); }
    // A provider outage leaves the audited queue intact for admin retry.
    return Response.json({ cancelled: true, deletionPending: true }, { headers: privateHeaders });
  }
  if (order.payment_state !== "paid" || order.refund_state !== "none") throw new StreamError("FUNDING_REQUIRED", "Confirmed payment is required before uploading.", 409);
  let body: { requestId: string; bytes: number; mime: string; fingerprint: string };
  try { body = JSON.parse((await boundedRequest(request, 4096)).toString("utf8")); }
  catch (error) { if (error instanceof StreamError) throw error; throw new StreamError("INVALID_REQUEST", "Choose a video and try again.", 400); }
  if (!uuid(body.requestId ?? "") || !Number.isSafeInteger(body.bytes) || body.bytes <= 0 || body.bytes > config.maxBytes || !VIDEO_MIMES.includes(body.mime as VideoMime) || !/^[a-f0-9]{64}$/.test(body.fingerprint ?? "")) throw new StreamError("INVALID_FILE", "The selected video exceeds the size or format limits.", 400);
  const reservation = await client.rpc("passport_stream_reserve", { p_order: order.id, p_key: body.requestId, p_bytes: body.bytes, p_mime: body.mime, p_fingerprint: body.fingerprint });
  if (reservation.error) throw new StreamError("SESSION_CONFLICT", "The upload has changed. Check its status or select your file again.", 409);
  const response = await streamLifecycle(config).provision(reservation.data.id);
  return Response.json(response, { headers: privateHeaders });
}

export async function statusEndpoint(request: Request, orderId: string): Promise<Response> {
  const config = requireStreamConfig();
  const { order, client } = await authorisedStreamOrder(orderId, true);
  requireSameOrigin(request);
  if (!order.active_attempt_id) return Response.json({ phase: "not_started" }, { headers: privateHeaders });
  const attempt = await client.from("pp_submission_attempts").select("id,provider_reference").eq("id", order.active_attempt_id).maybeSingle();
  // An unbound creation is found only through this actor's reserved order.
  const sessions = await streamStore(config).call<StreamSession[]>("for_order", { order_id: order.id });
  const session = sessions.find((item) => item.attempt_id === attempt.data?.id);
  if (!session) return Response.json({ phase: "not_started" }, { headers: privateHeaders });
  const reconciled = await streamLifecycle(config).reconcile(session);
  return Response.json({ phase: reconciled.phase }, { headers: privateHeaders });
}

export async function playbackEndpoint(orderId: string, attemptId?: string): Promise<Response> {
  const config = requireStreamConfig();
  const { client, order } = await authorisedStreamOrder(orderId, false);
  if (!order.active_attempt_id) throw new StreamError("NOT_READY", "Video is not ready.", 409);
  if (attemptId && !uuid(attemptId)) throw new StreamError("NOT_READY", "Video is unavailable.", 404);
  const { data: attempt } = await client.from("pp_submission_attempts").select("id,provider,provider_reference,upload_state").eq("id", attemptId ?? order.active_attempt_id).eq("order_id", order.id).maybeSingle();
  if (!attempt || attempt.provider !== "cloudflare_stream" || attempt.upload_state !== "ready") throw new StreamError("NOT_READY", "Video is not ready.", 409);
  const store = streamStore(config), session = await store.call<StreamSession>("get", { uid: attempt.provider_reference });
  if (session.attempt_id !== attempt.id || session.phase !== "ready") throw new StreamError("NOT_READY", "Video is unavailable.", 409);
  const provider = new CloudflareStream(config);
  const video = await provider.video(session.provider_uid!); requireOwnedVideo(video, session);
  if (!video.readyToStream || video.status.state !== "ready") throw new StreamError("NOT_READY", "Video is unavailable.", 409);
  return Response.json(await provider.playback(session.provider_uid!), { headers: privateHeaders });
}
export async function streamResponse(operation: string, handler: () => Promise<Response>): Promise<Response> {
  try { return await handler(); }
  catch (error) { logStreamFailure(operation, error); return Response.json({ code: error instanceof StreamError ? error.code : "INTERNAL", error: error instanceof StreamError ? error.message : "The video request could not be completed. Your order is safe." }, { status: error instanceof StreamError ? error.status : 503, headers: privateHeaders }); }
}
