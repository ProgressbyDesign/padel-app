import { statusEndpoint, streamResponse } from "@/lib/passport/video/stream/http";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) { return streamResponse("reconcile", async () => statusEndpoint(request, (await context.params).orderId)); }
