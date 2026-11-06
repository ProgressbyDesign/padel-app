import type { ReviewAttempt } from "@/lib/passport/review/model";
import StreamPlayback from "./StreamPlayback";

export default function AssessmentVideo({ orderId, attempt, title }: { orderId: string; attempt: ReviewAttempt; title: string }) {
  if (attempt.upload_state !== "ready") return <p className="mt-3 text-sm text-primary/70">Video {attempt.upload_state.replaceAll("_", " ")}. Only playable evidence can be reviewed.</p>;
  if (attempt.provider === "cloudflare_stream") return <StreamPlayback orderId={orderId} attemptId={attempt.id} title={title} />;
  if (attempt.provider !== "mock") return <p className="mt-3 text-sm">Private video is unavailable.</p>;
  return <div className="mt-4"><video controls playsInline preload="metadata" aria-label={`Private ${title} video attempt ${attempt.attempt_number}`} className="aspect-video w-full rounded-2xl bg-primary" src={`/account/development/assessments/${orderId}/video?attempt=${encodeURIComponent(attempt.id)}`} /><p className="mt-2 text-xs text-primary/65">Development-only mock footage · access is checked on every request.</p></div>;
}
