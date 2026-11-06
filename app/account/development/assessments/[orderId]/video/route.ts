import { localVideoEnabled } from "@/lib/passport/video/localConfig";
import { readMockVideo, receiveMockVideo, VideoRequestError } from "@/lib/passport/video/mockService";

export const runtime = "nodejs";
type Context = { params: Promise<{ orderId: string }> };
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };

function failure(error: unknown) {
  return Response.json({ error: error instanceof VideoRequestError ? error.message : "The video could not be processed. Retry with the same file; no extra payment is needed." }, { status: error instanceof VideoRequestError ? error.status : 422, headers });
}

export async function POST(request: Request, context: Context) {
  if (!localVideoEnabled()) return new Response(null, { status: 404, headers });
  try { await receiveMockVideo(request, (await context.params).orderId); return Response.json({ uploaded: true }, { headers }); }
  catch (error) { return failure(error); }
}

export async function GET(request: Request, context: Context) {
  if (!localVideoEnabled()) return new Response(null, { status: 404, headers });
  try {
    const { bytes, mime } = await readMockVideo((await context.params).orderId, new URL(request.url).searchParams.get("attempt") ?? undefined);
    const range = request.headers.get("range");
    const match = range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
    if (range && (!match || start > end || start >= bytes.length)) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${bytes.length}` } });
    return new Response(new Uint8Array(bytes.subarray(start, end + 1)), { status: range ? 206 : 200, headers: { ...headers, "Content-Type": mime, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1), ...(range ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` } : {}) } });
  } catch (error) { return failure(error); }
}
