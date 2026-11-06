import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { StreamError } from "./config";

export function sealCapability(url: string, key: string, sessionId: string): string {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
  cipher.setAAD(Buffer.from(sessionId));
  const bytes = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
}
export function openCapability(encrypted: string, key: string, sessionId: string): string {
  try {
    const bytes = Buffer.from(encrypted, "base64"), decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "base64"), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(sessionId)); decipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
  } catch { throw new StreamError("CAPABILITY_UNAVAILABLE", "This upload session cannot be resumed. Contact support.", 409); }
}
export function verifyStreamSignature(body: Buffer, header: string | null, secret: string, now = Date.now()): void {
  if (!header || body.length > 65536) throw new StreamError("INVALID_SIGNATURE", "Invalid webhook.", 401);
  const fields = header.split(",").map((part) => part.trim().split("="));
  const times = fields.filter(([key]) => key === "time"), signatures = fields.filter(([key]) => key === "sig1");
  const timestamp = times[0]?.[1];
  if (times.length !== 1 || !/^\d{10,11}$/.test(timestamp ?? "") || Math.abs(now / 1000 - Number(timestamp)) > 300) throw new StreamError("INVALID_SIGNATURE", "Invalid webhook.", 401);
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest();
  const valid = signatures.some(([, signature]) => /^[a-f0-9]{64}$/i.test(signature ?? "") && timingSafeEqual(expected, Buffer.from(signature, "hex")));
  if (!valid) throw new StreamError("INVALID_SIGNATURE", "Invalid webhook.", 401);
}
