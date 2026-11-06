import { it, expect } from "vitest";
import { createServer } from "node:http";
import { Upload } from "tus-js-client";

it("real tus client resumes the accepted offset after a lost response on a loopback fixture server", async () => {
  const file = Buffer.alloc(6 * 1024 * 1024 + 37, 42);
  let received = Buffer.alloc(0), lost = false, heads = 0;
  const server = createServer((request, response) => {
    response.setHeader("Tus-Resumable", "1.0.0");
    if (request.method === "HEAD") {
      heads++; response.setHeader("Upload-Offset", received.length); response.setHeader("Upload-Length", file.length); response.end(); return;
    }
    if (request.method !== "PATCH") { response.writeHead(405).end(); return; }
    if (Number(request.headers["upload-offset"]) !== received.length) { response.writeHead(409).end(); return; }
    const chunks: Buffer[] = []; request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      received = Buffer.concat([received, ...chunks]);
      if (!lost) { lost = true; response.destroy(); return; }
      response.setHeader("Upload-Offset", received.length); response.writeHead(204).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw Error("No loopback fixture");
  const uploadUrl = `http://127.0.0.1:${address.port}/fixture`;
  const send = () => new Promise<void>((resolve, reject) => {
    new Upload(file, { uploadUrl, chunkSize: 5242880, storeFingerprintForResuming: false, retryDelays: null, onSuccess: () => resolve(), onError: reject }).start();
  });
  try {
    await expect(send()).rejects.toThrow(); expect(received.length).toBe(5242880);
    await send(); expect(heads).toBe(2); expect(received.equals(file)).toBe(true);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}, 15000);
