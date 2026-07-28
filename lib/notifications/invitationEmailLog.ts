import { maskEmail } from "@/lib/admin/invitationToken";
import { senderDomainFromAddress } from "@/lib/notifications/emailServiceDiagnostic";

/** Safe server log — never includes secrets, tokens, or acceptance URLs. */
export function logInvitationEmailAttempt(input: {
  invitationId: string;
  recipient: string;
  senderAddress: string | null;
  outcome: "sent" | "failed";
  providerMessageId?: string | null;
  errorCode?: string | null;
}): void {
  const payload = {
    invitationId: input.invitationId,
    recipient: maskEmail(input.recipient),
    senderDomain: senderDomainFromAddress(input.senderAddress),
    ...(input.outcome === "sent"
      ? { providerMessageId: input.providerMessageId ?? null }
      : { errorCode: input.errorCode ?? "delivery_failed" }),
  };

  if (process.env.NODE_ENV === "development") {
    console.info("[admin-invitation] email attempt", payload);
  } else {
    console.info("[admin-invitation] email attempt", JSON.stringify(payload));
  }
}
