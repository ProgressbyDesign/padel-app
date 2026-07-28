import type { AdminRole } from "@/lib/admin/permissions";

export type OwnerSafetyMembership = {
  userId: string;
  role: AdminRole;
  status: string;
};

export function countActiveOwners(
  members: OwnerSafetyMembership[],
  excludeUserId?: string
): number {
  return members.filter(
    (m) =>
      m.status === "active" &&
      m.role === "owner" &&
      (!excludeUserId || m.userId !== excludeUserId)
  ).length;
}

export function canChangeMemberRole(input: {
  members: OwnerSafetyMembership[];
  targetUserId: string;
  newRole: AdminRole;
}): { ok: true } | { ok: false; message: string } {
  const target = input.members.find((m) => m.userId === input.targetUserId);
  if (!target || target.status !== "active") {
    return { ok: false, message: "Team member was not found." };
  }
  if (target.role === "owner" && input.newRole !== "owner") {
    const remaining = countActiveOwners(input.members, target.userId);
    if (remaining < 1) {
      return { ok: false, message: "At least one active Owner is required." };
    }
  }
  return { ok: true };
}

export function canSuspendOrRevokeMember(input: {
  members: OwnerSafetyMembership[];
  targetUserId: string;
}): { ok: true } | { ok: false; message: string } {
  const target = input.members.find((m) => m.userId === input.targetUserId);
  if (!target) {
    return { ok: false, message: "Team member was not found." };
  }
  if (target.role === "owner" && target.status === "active") {
    const remaining = countActiveOwners(input.members, target.userId);
    if (remaining < 1) {
      return { ok: false, message: "At least one active Owner is required." };
    }
  }
  return { ok: true };
}

export function mapOwnerProtectionError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("at least one") ||
    lower.includes("final owner") ||
    lower.includes("last owner") ||
    lower.includes("active owner")
  ) {
    return "At least one active Owner is required.";
  }
  return "Unable to update this team member.";
}
