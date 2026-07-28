export const ADMIN_ROLES = [
  "owner",
  "operations",
  "reviewer",
  "support",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_MEMBERSHIP_STATUSES = [
  "active",
  "suspended",
  "revoked",
] as const;

export type AdminMembershipStatus = (typeof ADMIN_MEMBERSHIP_STATUSES)[number];

export const ADMIN_PERMISSIONS = [
  "admin.access",
  "team.manage",
  "audit.read",
  "applications.read",
  "applications.review",
  "relationships.read",
  "relationships.manage",
  "bookings.read",
  "bookings.manage",
  "profiles.read",
  "profiles.manage",
  "deletions.read",
  "deletions.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminMembership = {
  userId: string;
  role: AdminRole;
  status: AdminMembershipStatus;
};

/** Mirrors the database role → permission matrix. */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: [...ADMIN_PERMISSIONS],
  operations: [
    "admin.access",
    "applications.read",
    "applications.review",
    "relationships.read",
    "relationships.manage",
    "bookings.read",
    "bookings.manage",
    "profiles.read",
    "profiles.manage",
    "deletions.read",
    "deletions.manage",
  ],
  reviewer: [
    "admin.access",
    "applications.read",
    "applications.review",
    "relationships.read",
    "profiles.read",
  ],
  support: [
    "admin.access",
    "applications.read",
    "relationships.read",
    "bookings.read",
    "profiles.read",
    "deletions.read",
  ],
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  operations: "Operations",
  reviewer: "Application reviewer",
  support: "Support",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  owner:
    "Full administrative access, including team management and audit history.",
  operations:
    "Manages applications, profiles, relationships, bookings and account requests.",
  reviewer:
    "Reviews coach and venue applications and can inspect related profiles.",
  support:
    "Read-only access to customer, booking and relationship information.",
};

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

export function isAdminMembershipStatus(
  value: string
): value is AdminMembershipStatus {
  return (ADMIN_MEMBERSHIP_STATUSES as readonly string[]).includes(value);
}

export function hasAdminPermission(
  membership: Pick<AdminMembership, "role" | "status"> | null | undefined,
  permission: AdminPermission
): boolean {
  if (!membership || membership.status !== "active") return false;
  return ROLE_PERMISSIONS[membership.role].includes(permission);
}

export function listPermissionsForRole(role: AdminRole): readonly AdminPermission[] {
  return ROLE_PERMISSIONS[role];
}

/** Data-quality tools stay Owner-only in this sprint. */
export function canAccessDataQuality(
  membership: Pick<AdminMembership, "role" | "status"> | null | undefined
): boolean {
  return Boolean(
    membership && membership.status === "active" && membership.role === "owner"
  );
}

export type AdminNavItem = {
  href: string;
  label: string;
  permission: AdminPermission | "data-quality-owner";
  exact?: boolean;
};

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { href: "/admin", label: "Overview", permission: "admin.access", exact: true },
  {
    href: "/admin/applications/coaches",
    label: "Coach applications",
    permission: "applications.read",
  },
  {
    href: "/admin/applications/venues",
    label: "Venue applications",
    permission: "applications.read",
  },
  {
    href: "/admin/relationships",
    label: "Relationships",
    permission: "relationships.read",
  },
  {
    href: "/admin/bookings",
    label: "Bookings",
    permission: "bookings.read",
  },
  {
    href: "/admin/account-deletions",
    label: "Account deletions",
    permission: "deletions.read",
  },
  {
    href: "/admin/team",
    label: "Team",
    permission: "team.manage",
  },
  {
    href: "/admin/audit",
    label: "Audit log",
    permission: "audit.read",
  },
  {
    href: "/admin/data-quality",
    label: "Data quality",
    permission: "data-quality-owner",
  },
] as const;

export function navItemsForMembership(
  membership: Pick<AdminMembership, "role" | "status">
): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => {
    if (item.permission === "data-quality-owner") {
      return canAccessDataQuality(membership);
    }
    return hasAdminPermission(membership, item.permission);
  });
}

/** Route → minimum permission for page access. */
export function permissionForAdminPath(pathname: string): AdminPermission | "data-quality-owner" | null {
  if (pathname === "/admin" || pathname === "/admin/") return "admin.access";
  if (pathname.startsWith("/admin/team")) return "team.manage";
  if (pathname.startsWith("/admin/audit")) return "audit.read";
  if (pathname.startsWith("/admin/data-quality")) return "data-quality-owner";
  if (pathname.startsWith("/admin/applications")) return "applications.read";
  if (pathname.startsWith("/admin/relationships")) return "relationships.read";
  if (pathname.startsWith("/admin/bookings")) return "bookings.read";
  if (pathname.startsWith("/admin/account-deletions")) return "deletions.read";
  if (pathname.startsWith("/admin/coaches") || pathname.startsWith("/admin/venues")) {
    return "profiles.read";
  }
  if (pathname.startsWith("/admin/access-denied")) return null;
  if (pathname.startsWith("/admin/invitations")) return null;
  if (pathname.startsWith("/admin/section-denied")) return null;
  return "admin.access";
}
