/** Provider-independent metadata only. No SDK, upload URL or live media operation. */
export type ProviderMediaReference =
  | { provider: "mock"; provider_reference: `mock:${string}` }
  | { provider: "cloudflare_stream"; provider_reference: string };

export type MediaEvent = { order_id: string; attempt_id: string } & (
  | { stage: "failed"; reason: string }
  | ({ stage: "uploaded" | "processing" } & ProviderMediaReference)
  | ({ stage: "ready"; duration_seconds: number; bytes: number; mime_type: "video/mp4" | "video/webm" | "video/quicktime" } & ProviderMediaReference)
);
export type PaymentConfirmation = { order_id: string; amount_minor: number; currency: string; payment_reference: string };
export type RefundConfirmation = { order_id: string; amount_minor: number; currency: string };
export type ProviderEvents = { payment: PaymentConfirmation; refund: RefundConfirmation; media: MediaEvent };

/** Future adapters must verify signatures and normalize event metadata before this boundary. */
export interface PassportEventSink {
  record<K extends keyof ProviderEvents>(source: K, eventId: string, event: ProviderEvents[K]): Promise<void>;
}
