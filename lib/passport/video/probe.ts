import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isAbsolute } from "node:path";
import type { VideoMime } from "./validation";

const run = promisify(execFile);
type ProbeOutput = { format?: { duration?: string; format_name?: string }; streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; nb_read_frames?: string; duration?: string }[] };

/** Local mock only: inspect actual bytes and decode/count frames, with network
 * protocols disabled. Client metadata is never used to mark evidence ready.
 * A separately installed probe is tooling, not a production runtime dependency. */
export async function probeLocalVideo(filename: string): Promise<{ duration: number; mime: VideoMime }> {
  const executable = process.env.PADEL_PASSPORT_MOCK_FFPROBE;
  if (!executable || !isAbsolute(executable)) throw new Error("The local video inspector is not configured.");
  const { stdout, stderr } = await run(executable, [
    "-v", "error", "-protocol_whitelist", "file", "-format_whitelist", "mov,matroska,webm",
    "-count_frames", "-show_entries", "format=duration,format_name:stream=codec_type,codec_name,width,height,nb_read_frames,duration",
    "-of", "json", filename,
  ], { timeout: 30_000, maxBuffer: 256 * 1024, windowsHide: true });
  const output = JSON.parse(stdout) as ProbeOutput;
  const video = output.streams?.find((stream) => stream.codec_type === "video" && (stream.width ?? 0) > 0 && (stream.height ?? 0) > 0);
  if (stderr.trim() || !video || Number(video.nb_read_frames ?? 0) < 1 || !["h264", "vp8", "vp9", "av1"].includes(video.codec_name ?? "")) {
    throw new Error("This video could not be decoded. Export an MP4 with H.264 video and try again.");
  }
  const format = output.format?.format_name ?? "";
  const mime: VideoMime = format.includes("webm") ? "video/webm" : "video/mp4";
  return { duration: Math.max(Number(output.format?.duration ?? 0), Number(video.duration ?? 0)), mime };
}
