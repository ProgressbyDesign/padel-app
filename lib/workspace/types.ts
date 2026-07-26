export type WorkspaceType = "personal" | "coach" | "venue" | "admin";

export type WorkspacePreference = {
  type: WorkspaceType | null;
  entityId: string | null;
};

export type WorkspaceCoach = {
  id: string;
  name: string;
};

export type WorkspaceVenue = {
  id: string;
  name: string;
};

export function workspaceHref(
  type: WorkspaceType,
  entityId?: string | null
): string {
  if (type === "personal") return "/account/personal";
  if (type === "admin") return "/admin";
  if (type === "coach" && entityId) {
    return `/account/coaches/${encodeURIComponent(entityId)}`;
  }
  if (type === "venue" && entityId) {
    return `/account/venues/${encodeURIComponent(entityId)}`;
  }
  return "/account/personal";
}

export function isWorkspaceType(
  value: string | null | undefined
): value is WorkspaceType {
  return (
    value === "personal" ||
    value === "coach" ||
    value === "venue" ||
    value === "admin"
  );
}
