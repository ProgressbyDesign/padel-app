"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Upload } from "lucide-react";
import type { SubmissionRecord } from "@/lib/passport/video/contracts";
import { assessmentStatus, canSubmit } from "@/lib/passport/video/contracts";
import { inspectBrowserVideo, mockVideoProvider } from "@/lib/passport/video/browserProvider";
import { cancelBrowserUpload, reconcileBrowserUpload, streamBrowserProvider } from "@/lib/passport/video/stream/browser";
import { MAX_VIDEO_BYTES, validateVideo, videoLimit, VIDEO_MIMES } from "@/lib/passport/video/validation";
import StreamPlayback from "./StreamPlayback";
import { panel, primaryAction, secondaryAction, ProgressBar } from "./DevelopmentUi";

type Stage = "idle" | "checking" | "preview" | "uploading" | "processing" | "done" | "error";

export default function VideoSubmission({ record, provider = "mock", maxBytes = MAX_VIDEO_BYTES }: { record: SubmissionRecord; provider?: "mock" | "cloudflare_stream"; maxBytes?: number }) {
  const { order, attempt, skillTitle } = record;
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [interactive, setInteractive] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef<string | null>(null);
  const busy = stage === "checking" || stage === "uploading" || stage === "processing";
  const allowed = canSubmit(order, attempt);
  const maxSeconds = videoLimit(order.terms_snapshot.max_video_seconds, order.terms_snapshot.evidence_requirements.max_seconds);

  useEffect(() => { setInteractive(true); return () => controller.current?.abort(); }, []);
  useEffect(() => {
    if (!file) { setUrl(""); return; }
    const next = URL.createObjectURL(file); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  async function selectVideo(next?: File) {
    if (!next) return;
    controller.current?.abort();
    const check = new AbortController(); controller.current = check;
    setFile(null); setError(""); setStage("checking");
    try {
      const preliminary = validateVideo({ bytes: next.size, mime: next.type, duration: 1 }, maxSeconds, maxBytes);
      if (preliminary) throw new Error(preliminary);
      let seconds = 0;
      try { seconds = await inspectBrowserVideo(next, check.signal); }
      catch (reason) {
        if (provider !== "cloudflare_stream" || check.signal.aborted) throw reason;
        setError("This browser cannot preview this recording. You may upload it for processing; the 90-second limit will still be checked by the video service.");
      }
      if (check.signal.aborted) return;
      const invalid = validateVideo({ bytes: next.size, mime: next.type, duration: seconds || 1 }, maxSeconds, maxBytes);
      if (invalid) throw new Error(invalid);
      setDuration(seconds); setFile(next); setStage("preview");
      requestId.current = crypto.randomUUID();
    } catch (reason) {
      if (!check.signal.aborted) { setError(reason instanceof Error ? reason.message : "Choose another video."); setStage("error"); }
    }
  }

  async function upload() {
    if (!file || busy || !allowed) return;
    const transfer = new AbortController(); controller.current = transfer;
    requestId.current ??= crypto.randomUUID();
    setError(""); setProgress(0); setStage("uploading");
    try {
      await (provider === "cloudflare_stream" ? streamBrowserProvider : mockVideoProvider).upload({ orderId: order.id, requestId: requestId.current, file, signal: transfer.signal,
        onProgress: setProgress, onProcessing: () => setStage("processing") });
      if (!transfer.signal.aborted) { setStage("done"); setFile(null); router.refresh(); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload interrupted. Retry with no additional payment."); setStage("error");
    }
  }

  async function checkStatus(cancel = false) {
    if (busy) return;
    setStage("processing"); setError("");
    try {
      if (cancel) await cancelBrowserUpload(order.id);
      else await reconcileBrowserUpload(order.id);
      setStage("idle"); router.refresh();
    } catch (reason) { setStage("error"); setError(reason instanceof Error ? reason.message : "Please check your upload status again."); }
  }

  return <div className="space-y-5">
    <section className={panel}>
      <p className="text-sm font-semibold text-primary/65">Local test assessment · {assessmentStatus[order.state]}</p>
      <h1 className="mt-2 text-3xl">Your {skillTitle} video</h1>
      <p className="mt-3 text-sm leading-6 text-primary/75">Show your current technique. Your assessor will give you a Developing or Verified outcome and a useful next step. Payment covers the assessment, not a guaranteed verification.</p>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="font-semibold">Camera position</dt><dd className="mt-1 leading-6">{order.terms_snapshot.evidence_requirements.camera}</dd></div>
        <div><dt className="font-semibold">What to record</dt><dd className="mt-1 leading-6">{order.terms_snapshot.evidence_requirements.repetitions}</dd></div>
      </dl>
      <p className="mt-4 text-sm leading-6">Keep your whole body, racket and ball in view. Use good light and a steady phone. Get permission from anyone identifiable in your recording.</p>
      <p id="video-limits" className="mt-4 rounded-xl bg-secondary/25 p-3 text-sm font-semibold">Up to {maxSeconds} seconds · MP4, MOV or WebM · {Math.round(maxBytes / 1024 / 1024)} MB maximum in this preview</p>
      {attempt?.recording_guidance ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6"><h2 className="text-lg">Before you replace your video</h2><p>{attempt.recording_guidance}</p><p className="mt-2 font-semibold">Your replacement stays under the same order. There is no extra assessment charge.</p></div> : null}
    </section>

    {stage === "done" || ["ready_for_review", "in_review", "completed"].includes(order.state) ? <section className={panel} aria-live="polite">
      <CheckCircle2 aria-hidden className="text-green-700" /><h2 className="mt-3 text-2xl">{order.state === "completed" ? "Assessment delivered" : "Your video is ready"}</h2>
      <p className="mt-3 text-sm leading-6">{order.state === "completed" ? "Your completed assessment remains in your history. A later reassessment is a new paid service." : `The review target is ${order.terms_snapshot.review_target_hours} hours after a valid submission is received.`}</p>
      {provider === "cloudflare_stream" ? <StreamPlayback orderId={order.id} title={skillTitle} /> : <video className="mt-4 aspect-video w-full rounded-xl bg-primary" controls playsInline preload="metadata" aria-label={`Submitted ${skillTitle} video`} src={`/account/development/assessments/${order.id}/video`} />}
      <Link href="/account/development/assessments" className={`${primaryAction} mt-5`}>Back to My Assessments</Link>
    </section> : allowed ? <section className={panel} aria-busy={busy}>
      <h2 className="text-2xl">{file ? "Check your clip" : "Record or select your video"}</h2>
      <p className="mt-2 text-sm leading-6">Watch it before sending. You can change your selection until you upload.</p>
      <fieldset disabled={busy || !interactive} className="mt-4 grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Choose a recording source</legend>
        <label className={`${secondaryAction} relative cursor-pointer gap-2 focus-within:outline-2 focus-within:outline-offset-2`}><Camera size={18} aria-hidden />Record video<input aria-label="Record video" aria-describedby="video-limits" className="sr-only" type="file" accept="video/*" capture="environment" onChange={(e) => { void selectVideo(e.target.files?.[0]); e.target.value = ""; }} /></label>
        <label className={`${secondaryAction} relative cursor-pointer gap-2 focus-within:outline-2 focus-within:outline-offset-2`}><Upload size={18} aria-hidden />Choose video<input aria-label="Choose video" aria-describedby="video-limits" className="sr-only" type="file" accept={VIDEO_MIMES.join(",")} onChange={(e) => { void selectVideo(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </fieldset>
      {url ? <div className="mt-5"><video src={url} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-primary" aria-label="Preview your selected video" /><p className="mt-2 break-all text-sm text-primary/70">{file?.name} · {duration ? `${Math.ceil(duration)} seconds` : "Length checked after upload"}</p></div> : null}
      <div className="mt-4" role="status" aria-live="polite">{stage === "checking" ? <p>Checking your video…</p> : stage === "uploading" ? <ProgressBar label={`Uploading video: ${progress}%`} value={progress} /> : stage === "processing" ? <p>Upload received. Checking playback and processing your video… Keep this page open.</p> : stage === "preview" ? <p className="text-sm">Your clip is ready to upload.</p> : null}</div>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-800">{error}</p> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={() => void upload()} disabled={!file || busy} className={`${primaryAction} disabled:cursor-not-allowed disabled:opacity-50`}>{stage === "error" && file ? "Retry upload" : "Upload video"}</button>
        {stage === "uploading" ? <button className={secondaryAction} onClick={() => controller.current?.abort()}>{provider === "cloudflare_stream" ? "Pause upload" : "Stop upload"}</button> : null}
        {provider === "cloudflare_stream" && (order.state === "processing" || (stage === "error" && file)) && !busy ? <><button className={secondaryAction} onClick={() => void checkStatus()}>Check upload status</button><button className={secondaryAction} onClick={() => void checkStatus(true)}>Cancel this upload</button></> : null}
      </div>
      <p className="mt-4 text-sm leading-6 text-primary/70">Connection lost? Retry here under the same order, without another payment. Once accepted, your assessor may request a free replacement if the footage is unusable.</p>
    </section> : <section className={panel}><h2 className="text-xl">{assessmentStatus[order.state]}</h2><p className="mt-3 text-sm leading-6">{order.payment_state !== "paid" ? "An upload is available only after payment is confirmed by the server. Checkout is not enabled in this preview." : "This order cannot accept another video at the moment. Return to My Assessments to check its status."}</p></section>}
    <p className="text-sm leading-6 text-primary/65">{provider === "mock" ? "Development only. This mock stores clips privately on this computer. It is not Cloudflare Stream and must not be used for real customer footage." : "Test video service. Keep the browser open while uploading. If you pause, refresh or lose connection, select the same file to resume. Background uploading after closing a phone or browser is not guaranteed."}</p>
  </div>;
}
