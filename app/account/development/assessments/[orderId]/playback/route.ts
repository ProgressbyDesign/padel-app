import { playbackEndpoint, streamResponse } from "@/lib/passport/video/stream/http";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) { return streamResponse("playback", async () => playbackEndpoint((await context.params).orderId, new URL(request.url).searchParams.get("attempt") ?? undefined)); }
