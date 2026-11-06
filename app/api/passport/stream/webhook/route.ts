import { requireStreamConfig } from "@/lib/passport/video/stream/config";
import { boundedRequest, privateHeaders, streamResponse } from "@/lib/passport/video/stream/http";
import { streamLifecycle } from "@/lib/passport/video/stream/service";
export const runtime = "nodejs";
export async function POST(request: Request) { return streamResponse("webhook", async () => {
  const config = requireStreamConfig();
  await streamLifecycle(config).webhook(await boundedRequest(request), request.headers.get("webhook-signature"));
  return Response.json({ received: true }, { headers: privateHeaders });
}); }
