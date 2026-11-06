import type { VideoUploadProvider } from "./contracts";

/** Genuine local HTTP transfer; no fabricated progress, payment or readiness. */
export const mockVideoProvider: VideoUploadProvider = {
  upload({ orderId, requestId, file, signal, onProgress, onProcessing }) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      const cleanup = () => signal.removeEventListener("abort", abort);
      xhr.open("POST", `/account/development/assessments/${orderId}/video`);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.setRequestHeader("X-Request-ID", requestId);
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
      xhr.upload.onload = onProcessing;
      xhr.onload = () => {
        cleanup();
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          let message = "The upload could not finish. Retry with the same video. No extra payment is needed.";
          try { message = JSON.parse(xhr.responseText).error ?? message; } catch { /* Generic network response. */ }
          reject(new Error(message));
        }
      };
      xhr.onerror = () => { cleanup(); reject(new Error("Connection interrupted. Reconnect and retry; no extra payment is needed.")); };
      xhr.onabort = () => { cleanup(); reject(new Error("Upload stopped. Your order is safe. Retry when you are ready.")); };
      xhr.ontimeout = xhr.onerror;
      xhr.timeout = 180_000;
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) { cleanup(); reject(new Error("Upload stopped.")); return; }
      xhr.send(file);
    });
  },
};

export function inspectBrowserVideo(file: File, signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (duration?: number) => {
      if (settled) return;
      settled = true; video.onloadeddata = null; video.onerror = null;
      clearTimeout(timer); signal.removeEventListener("abort", abort);
      video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url);
      if (duration !== undefined && Number.isFinite(duration)) resolve(duration);
      else reject(new Error("This video could not be played. Export an MP4 copy and try again."));
    };
    const abort = () => finish();
    const timer = setTimeout(() => finish(), 15_000);
    signal.addEventListener("abort", abort, { once: true });
    video.preload = "auto";
    video.onloadeddata = () => finish(video.duration);
    video.onerror = () => finish();
    video.src = url;
    if (signal.aborted) finish();
  });
}
