import { sessionEndpoint, streamResponse } from "@/lib/passport/video/stream/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ orderId: string }> };
export async function POST(request: Request, context: Context) { return streamResponse("session", async () => sessionEndpoint(request, (await context.params).orderId)); }
export async function DELETE(request: Request, context: Context) { return streamResponse("cancel", async () => sessionEndpoint(request, (await context.params).orderId)); }
