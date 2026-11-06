import type { UploadOptions } from "tus-js-client";
import type { VideoUploadProvider } from "../contracts";

type UploadConstructor = new(file: File, options: UploadOptions) => { start(): void; abort(terminate?: boolean): Promise<void> };
type ResumeKey = { fingerprint: string; requestId: string };
const memory = new Map<string, ResumeKey>();
function remember(orderId: string, entry?: ResumeKey) {
  if (entry) memory.set(orderId, entry); else memory.delete(orderId);
  try { if (entry) localStorage.setItem(`pp-stream:${orderId}`, JSON.stringify(entry)); else localStorage.removeItem(`pp-stream:${orderId}`); } catch { /* Private browsing still supports same-page retry. */ }
}
async function fingerprint(file: File) {
  // Bounded reads on phones; fingerprint is for resume matching, not security or
  // verification of the footage. No filename, capability or provider UID stored.
  const bytes = await new Blob([file.slice(0, 65536), file.slice(Math.max(0, file.size - 65536)), `${file.size}:${file.lastModified}`]).arrayBuffer();
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (value) => value.toString(16).padStart(2, "0")).join("");
}
export async function reconcileBrowserUpload(orderId: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`/account/development/assessments/${orderId}/upload-session/status`, { method: "POST", signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Your upload status is unavailable. Try again shortly.");
  if (["failed", "deleted", "delete_pending"].includes(body.phase)) remember(orderId);
  return body.phase;
}
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error("Upload paused. Select the same file to resume.")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort();
  });
}
export function createStreamBrowserProvider(load: () => Promise<{ Upload: UploadConstructor }> = () => import("tus-js-client")): VideoUploadProvider {
  return { async upload(input) {
    const { orderId, file, signal } = input;
    const fp = await fingerprint(file);
    if (signal.aborted) throw new Error("Upload paused.");
    let entry = memory.get(orderId);
    try { entry ??= JSON.parse(localStorage.getItem(`pp-stream:${orderId}`) ?? "null") as ResumeKey | undefined; } catch { /* Ignore damaged storage. */ }
    if (!entry || entry.fingerprint !== fp || typeof entry.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(entry.requestId)) entry = { fingerprint: fp, requestId: crypto.randomUUID() };
    remember(orderId, entry);
    const response = await fetch(`/account/development/assessments/${orderId}/upload-session`, { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...entry, bytes: file.size, mime: file.type }) });
    const session = await response.json();
    if (!response.ok) {
      if (["UPLOAD_EXPIRED", "SESSION_CONFLICT"].includes(session.code)) remember(orderId);
      throw new Error(session.error ?? "The upload session is unavailable. Check its status before retrying.");
    }
    if (session.uploadUrl) {
      const { Upload } = await load();
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => signal.removeEventListener("abort", abort);
        const upload = new Upload(file, { uploadUrl: session.uploadUrl, chunkSize: 5 * 1024 * 1024,
          retryDelays: [0, 1000, 3000, 5000, 10000], storeFingerprintForResuming: false,
          // No endpoint fallback, API token, cookies or credentials sent to Stream.
          onProgress: (sent, total) => input.onProgress(Math.round(sent / total * 100)),
          onShouldRetry: (error) => ![401, 403, 404, 410].includes(error.originalResponse?.getStatus() ?? 0),
          onError: () => { cleanup(); reject(new Error("Upload interrupted or permission expired. Check status, then retry with the same file; no extra payment is needed.")); },
          onSuccess: () => { cleanup(); resolve(); },
        });
        const abort = () => { void upload.abort(false).finally(() => { cleanup(); reject(new Error("Upload paused. Keep this file and select it again to resume.")); }); };
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort(); else upload.start();
      });
    }
    input.onProcessing();
    for (let i = 0; i < 40; i++) {
      const phase = await reconcileBrowserUpload(orderId, signal);
      if (phase === "ready") { remember(orderId); return; }
      if (["failed", "deleted", "delete_pending"].includes(phase)) { remember(orderId); throw new Error("The video could not be accepted. Refresh and submit compatible footage under the same order, without another payment."); }
      await wait(3000, signal);
    }
    throw new Error("Your video is still processing. Check its status shortly; do not pay again or create another upload.");
  } };
}
export const streamBrowserProvider = createStreamBrowserProvider();
export async function cancelBrowserUpload(orderId: string): Promise<void> {
  const response = await fetch(`/account/development/assessments/${orderId}/upload-session`, { method: "DELETE" });
  if (!response.ok) throw new Error("This upload could not be cancelled. Check its status.");
  remember(orderId);
}
