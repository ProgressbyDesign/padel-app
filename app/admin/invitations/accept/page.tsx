import { getAuthenticatedAccount } from "@/lib/auth/session";
import {
  loadInvitationPreviewByRawToken,
} from "@/app/admin/invitations/actions";
import { isValidInvitationRawToken } from "@/lib/admin/invitationToken";
import AcceptAdminInvitationClient from "@/components/admin/AcceptAdminInvitationClient";

type PageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function AcceptAdminInvitationPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const rawToken = first(params.token)?.trim() ?? "";
  const account = await getAuthenticatedAccount();

  if (!rawToken || !isValidInvitationRawToken(rawToken)) {
    return (
      <AcceptAdminInvitationClient
        state="invalid"
        token=""
        signedIn={Boolean(account)}
        signedInEmail={account?.email ?? null}
      />
    );
  }

  const preview = await loadInvitationPreviewByRawToken(rawToken);

  if (!account) {
    return (
      <AcceptAdminInvitationClient
        state="signed-out"
        token={rawToken}
        signedIn={false}
        signedInEmail={null}
        role={preview.role}
        emailMasked={preview.emailMasked}
        expiresAt={preview.expiresAt}
      />
    );
  }

  if (preview.status === "invalid") {
    return (
      <AcceptAdminInvitationClient
        state="invalid"
        token={rawToken}
        signedIn
        signedInEmail={account.email}
      />
    );
  }

  if (preview.status === "expired") {
    return (
      <AcceptAdminInvitationClient
        state="expired"
        token={rawToken}
        signedIn
        signedInEmail={account.email}
        role={preview.role}
        emailMasked={preview.emailMasked}
        expiresAt={preview.expiresAt}
      />
    );
  }

  if (preview.status === "cancelled") {
    return (
      <AcceptAdminInvitationClient
        state="cancelled"
        token={rawToken}
        signedIn
        signedInEmail={account.email}
        role={preview.role}
        emailMasked={preview.emailMasked}
      />
    );
  }

  if (preview.status === "accepted") {
    return (
      <AcceptAdminInvitationClient
        state="already-accepted"
        token={rawToken}
        signedIn
        signedInEmail={account.email}
        role={preview.role}
        emailMasked={preview.emailMasked}
      />
    );
  }

  // pending
  if (preview.emailMatches === false) {
    return (
      <AcceptAdminInvitationClient
        state="wrong-email"
        token={rawToken}
        signedIn
        signedInEmail={account.email}
        role={preview.role}
        emailMasked={preview.emailMasked}
        expiresAt={preview.expiresAt}
      />
    );
  }

  return (
    <AcceptAdminInvitationClient
      state="matching-email"
      token={rawToken}
      signedIn
      signedInEmail={account.email}
      role={preview.role}
      emailMasked={preview.emailMasked}
      expiresAt={preview.expiresAt}
    />
  );
}
