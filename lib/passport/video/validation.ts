/** Pilot mock limit, not a purchased entitlement. Confirm before Stream rollout. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type VideoMime = typeof VIDEO_MIMES[number];
export type VideoMetadata = { bytes: number; mime: string; duration: number };

export function videoLimit(policySeconds = 90, evidenceSeconds = 90): number {
  return Math.min(90, policySeconds, evidenceSeconds);
}

export function validateVideo(file: VideoMetadata, maxSeconds = 90, maxBytes = MAX_VIDEO_BYTES): string | null {
  if (!VIDEO_MIMES.includes(file.mime as VideoMime)) return "Choose an MP4, MOV or WebM video.";
  if (!Number.isFinite(file.bytes) || file.bytes <= 0) return "This file is empty. Choose another video.";
  if (file.bytes > maxBytes) return `Choose a video smaller than ${Math.round(maxBytes / 1024 / 1024)} MB, or export a smaller copy.`;
  if (!Number.isFinite(file.duration) || file.duration <= 0) return "We could not read this video's length. Export it as MP4 and try again.";
  if (file.duration > maxSeconds) return `Keep your video to ${maxSeconds} seconds or less. Trim it and try again.`;
  return null;
}
