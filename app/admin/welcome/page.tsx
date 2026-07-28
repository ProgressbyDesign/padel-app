import { redirect } from "next/navigation";
import { requireAdminAccess } from "@/lib/auth/adminSession";
import { hasMeaningfulFullName } from "@/lib/admin/invitationToken";
import { accountAvatarDisplayUrl } from "@/lib/accountAvatar";
import { createClient } from "@/lib/supabase/server";
import AdminWelcomeClient from "@/components/admin/AdminWelcomeClient";

export default async function AdminWelcomePage() {
  const account = await requireAdminAccess("access-denied");
  const supabase = await createClient();

  let profile: {
    full_name: string | null;
    avatar_path: string | null;
    avatar_updated_at: string | null;
  } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_path, avatar_updated_at")
      .eq("id", account.id)
      .maybeSingle();
    if (data) {
      profile = data;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }

  if (hasMeaningfulFullName(profile?.full_name, account.email)) {
    redirect("/admin");
  }

  const avatarPath =
    typeof profile?.avatar_path === "string" && profile.avatar_path.trim()
      ? profile.avatar_path.trim()
      : null;
  const avatarUpdatedAt =
    typeof profile?.avatar_updated_at === "string"
      ? profile.avatar_updated_at
      : null;

  return (
    <AdminWelcomeClient
      userId={account.id}
      email={account.email}
      fullName={profile?.full_name?.trim() || null}
      avatarUrl={accountAvatarDisplayUrl(avatarPath, avatarUpdatedAt)}
    />
  );
}
