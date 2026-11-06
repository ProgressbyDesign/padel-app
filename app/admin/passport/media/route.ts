import { getAdminAccount } from "@/lib/auth/adminSession";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { boundedRequest, privateHeaders, streamResponse } from "@/lib/passport/video/stream/http";
import { requireSameOrigin } from "@/lib/passport/video/stream/service";
import { maintainStreamVideos } from "@/lib/passport/video/stream/maintenance";
import { requireStreamConfig, StreamError } from "@/lib/passport/video/stream/config";
export const runtime = "nodejs";
export async function POST(request: Request) { return streamResponse("maintenance", async () => {
  // Existing authenticated, ACTIVE admin membership. Neither a player nor a
  // user-editable role/flag can authorise provider deletion.
  requireStreamConfig();
  const admin = await getAdminAccount();
  if (!hasAdminPermission(admin, "deletions.manage")) throw new StreamError("ADMIN_REQUIRED", "An authorised administrator is required.", 403);
  requireSameOrigin(request);
  let after: string | undefined;
  try { after = JSON.parse((await boundedRequest(request, 4096)).toString("utf8")).after; }
  catch { throw new StreamError("INVALID_REQUEST", "Invalid maintenance request.", 400); }
  // The service repeats admin authorisation and processes only this configured
  // account's durable session records. No caller-supplied video ID is accepted.
  return Response.json(await maintainStreamVideos(after), { headers: privateHeaders });
}); }
