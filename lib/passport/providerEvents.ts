import "server-only";
import { developmentPreviewEnabled } from "@/lib/development/flags";
import type { ProviderEvents } from "./media";

export interface TrustedEventTransport {
  rpc(name: "passport_provider_event", args: { p_source: string; p_event_id: string; p_payload: ProviderEvents[keyof ProviderEvents] }): PromiseLike<{ error: { message: string } | null }>;
}

/** For a future trusted worker, never a client action. This module creates no
 * service-role client and sends no charge/upload requests. Production stays off.
 */
export async function recordTrustedPassportEvent<K extends keyof ProviderEvents>(
  transport: TrustedEventTransport, source: K, eventId: string, event: ProviderEvents[K],
): Promise<void> {
  if (!developmentPreviewEnabled()) throw new Error("Passport backend is not enabled.");
  if (!eventId || eventId.length > 200) throw new Error("A stable provider event ID is required.");
  const { error } = await transport.rpc("passport_provider_event", { p_source: source, p_event_id: eventId, p_payload: event });
  if (error) throw new Error("The trusted Passport event could not be recorded.");
}
