import { getAuthenticatedAccount } from "@/lib/auth/session";
import { readAdminInvitationTokenFromCookie } from "@/lib/admin/invitationCookie";
import { parseInvitationTokenSearchParam } from "@/lib/admin/invitationAcceptHelpers";
import { loadInvitationPreviewFromCookie } from "@/app/admin/invitations/actions";
import AcceptAdminInvitationClient from "@/components/admin/AcceptAdminInvitationClient";

type PageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function AcceptAdminInvitationPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const legacyToken = parseInvitationTokenSearchParam(params.token);
  const account = await getAuthenticatedAccount();

  // Legacy emails: /accept?token= — Continue stores cookie and strips the URL.
  if (legacyToken) {
    return (
      <AcceptAdminInvitationClient
        state="legacy-token"
        signedInEmail={account?.email ?? null}
        legacyToken={legacyToken}
      />
    );
  }

  const cookieToken = await readAdminInvitationTokenFromCookie();

  if (!account) {
    if (!cookieToken) {
      return (
        <AcceptAdminInvitationClient
          state="missing-cookie"
          signedInEmail={null}
        />
      );
    }
    return (
      <AcceptAdminInvitationClient state="signed-out" signedInEmail={null} />
    );
  }

  const preview = await loadInvitationPreviewFromCookie();

  if (
    preview.status === "missing-cookie" ||
    preview.status === "invalid-token"
  ) {
    return (
      <AcceptAdminInvitationClient
        state={preview.status}
        signedInEmail={account.email}
        preview={preview}
      />
    );
  }

  if (preview.status === "unavailable") {
    return (
      <AcceptAdminInvitationClient
        state="unavailable"
        signedInEmail={account.email}
        preview={preview}
      />
    );
  }

  if (preview.status === "expired") {
    return (
      <AcceptAdminInvitationClient
        state="expired"
        signedInEmail={account.email}
        preview={preview}
      />
    );
  }

  if (preview.status === "cancelled") {
    return (
      <AcceptAdminInvitationClient
        state="cancelled"
        signedInEmail={account.email}
        preview={preview}
      />
    );
  }

  if (preview.status === "accepted") {
    return (
      <AcceptAdminInvitationClient
        state="accepted"
        signedInEmail={account.email}
        preview={preview}
      />
    );
  }

  return (
    <AcceptAdminInvitationClient
      state="pending"
      signedInEmail={account.email}
      preview={preview}
    />
  );
}
