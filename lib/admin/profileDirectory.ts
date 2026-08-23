import {
  launchSelectionStatusOf,
  publicationStatusOf,
} from "@/lib/lifecycle/adminStatus";
import type {
  LaunchSelectionStatus,
  PublicationStatus,
} from "@/lib/lifecycle/constants";

export const PROFILE_DIRECTORY_FILTERS = [
  "all",
  "draft",
  "published",
  "suspended",
  "managed",
  "unclaimed",
  "imported",
  "application",
] as const;

export type ProfileDirectoryFilter = (typeof PROFILE_DIRECTORY_FILTERS)[number];

export const PROFILE_DIRECTORY_FILTER_LABELS: Record<
  ProfileDirectoryFilter,
  string
> = {
  all: "All",
  draft: "Draft",
  published: "Published",
  suspended: "Suspended",
  managed: "Managed",
  unclaimed: "Unclaimed",
  imported: "Imported",
  application: "Application",
};

export const PROFILE_DIRECTORY_PAGE_SIZE = 25;

export type ProfileDirectoryKind = "coach" | "venue";

export type ProfileDirectoryRow = {
  id: string;
  name: string;
  location: string | null;
  source: string | null;
  sourceLabel: string;
  isApproved: boolean;
  hasAccount: boolean;
  launchSelectionStatus: LaunchSelectionStatus;
  publicationStatus: PublicationStatus;
  completionPercent: number | null;
  href: string;
};

export type ParsedProfileDirectoryParams = {
  q: string;
  filter: ProfileDirectoryFilter;
  page: number;
};

export type ProfileDirectoryStats = {
  total: number;
  draft: number;
  published: number;
};

export function isProfileDirectoryFilter(
  value: unknown
): value is ProfileDirectoryFilter {
  return (
    typeof value === "string" &&
    (PROFILE_DIRECTORY_FILTERS as readonly string[]).includes(value)
  );
}

export function parseProfileDirectorySearchParams(raw: {
  q?: string | string[];
  filter?: string | string[];
  page?: string | string[];
}): ParsedProfileDirectoryParams {
  const q = firstParam(raw.q)?.trim() ?? "";
  const filterRaw = firstParam(raw.filter)?.trim();
  const filter = normalizeDirectoryFilter(filterRaw);
  const pageNum = Number.parseInt(firstParam(raw.page) ?? "1", 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;
  return { q, filter, page };
}

function normalizeDirectoryFilter(value: string | undefined): ProfileDirectoryFilter {
  if (value === "private") return "draft";
  if (isProfileDirectoryFilter(value)) return value;
  return "all";
}

export function profileDirectoryHref(
  kind: ProfileDirectoryKind,
  id: string
): string {
  return kind === "coach"
    ? `/admin/coaches/${id}`
    : `/admin/venues/${id}`;
}

export function directorySourceLabel(
  source: string | null | undefined
): string {
  const value = (source ?? "").trim().toLowerCase();
  if (value === "import" || value === "imported") return "Imported";
  if (value === "crawler" || value === "crawl") return "Crawler";
  if (value === "application") return "Application";
  if (!value) return "Unknown";
  return source!.trim();
}

export function isImportedSource(source: string | null | undefined): boolean {
  const value = (source ?? "").trim().toLowerCase();
  return (
    value === "import" ||
    value === "imported" ||
    value === "crawler" ||
    value === "crawl"
  );
}

export function isApplicationSource(
  source: string | null | undefined
): boolean {
  return (source ?? "").trim().toLowerCase() === "application";
}

export function directoryVerificationLabel(
  isApproved: boolean | null | undefined
): string {
  return isApproved ? "Approved" : "Needs review";
}

export function directoryLaunchLabel(status: LaunchSelectionStatus): string {
  if (status === "selected") return "Selected";
  if (status === "excluded") return "Excluded";
  return "Unselected";
}

export function directoryStatusLabel(status: PublicationStatus): string {
  if (status === "published") return "Published";
  if (status === "suspended") return "Suspended";
  return "Draft";
}

/** @deprecated Use directoryStatusLabel — kept for existing tests during rename. */
export function directoryVisibilityLabel(status: PublicationStatus): string {
  return directoryStatusLabel(status);
}

export function directoryAccountLabel(hasAccount: boolean): string {
  return hasAccount ? "Managed" : "Unclaimed";
}

export function cheapCompletionPercent(parts: boolean[]): number {
  if (parts.length === 0) return 0;
  return Math.round((parts.filter(Boolean).length / parts.length) * 100);
}

export function matchesProfileDirectoryFilter(
  row: Pick<
    ProfileDirectoryRow,
    "launchSelectionStatus" | "publicationStatus" | "hasAccount" | "source"
  >,
  filter: ProfileDirectoryFilter
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "draft":
      return row.publicationStatus === "private";
    case "published":
      return row.publicationStatus === "published";
    case "suspended":
      return row.publicationStatus === "suspended";
    case "managed":
      return row.hasAccount;
    case "unclaimed":
      return !row.hasAccount;
    case "imported":
      return isImportedSource(row.source);
    case "application":
      return isApplicationSource(row.source);
    default:
      return true;
  }
}

export function filterProfileDirectoryRows(
  rows: ProfileDirectoryRow[],
  params: Pick<ParsedProfileDirectoryParams, "q" | "filter">
): ProfileDirectoryRow[] {
  const query = params.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (!matchesProfileDirectoryFilter(row, params.filter)) return false;
    if (query && !row.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

export function paginateProfileDirectoryRows<T>(
  rows: T[],
  page: number,
  pageSize = PROFILE_DIRECTORY_PAGE_SIZE
): { rows: T[]; total: number; page: number; pageCount: number } {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageCount,
  };
}

export function buildProfileDirectoryQueryString(
  params: ParsedProfileDirectoryParams
): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.filter !== "all") search.set("filter", params.filter);
  if (params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function locationLabel(
  city: string | null | undefined,
  country: string | null | undefined
): string | null {
  const label = [city, country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  return label || null;
}

type NestedLocation = {
  city?: string | null;
  country?: string | null;
  is_primary?: boolean | null;
};

type NestedMembership = {
  user_id?: string | null;
};

export type CoachDirectoryRaw = {
  id: string;
  name?: string | null;
  source?: string | null;
  is_approved?: boolean | null;
  launch_selection_status?: string | null;
  publication_status?: string | null;
  image_url?: string | null;
  coach_locations?: NestedLocation[] | null;
  coach_memberships?: NestedMembership[] | null;
};

export type VenueDirectoryRaw = {
  id: string;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  source?: string | null;
  is_approved?: boolean | null;
  launch_selection_status?: string | null;
  publication_status?: string | null;
  image_url?: string | null;
  venue_memberships?: NestedMembership[] | null;
};

function oneOrMany<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function mapCoachDirectoryRow(raw: CoachDirectoryRaw): ProfileDirectoryRow {
  const locations = oneOrMany(raw.coach_locations);
  const primary =
    locations.find((row) => row.is_primary) ?? locations[0] ?? null;
  const location = primary
    ? locationLabel(primary.city, primary.country)
    : null;
  const name = raw.name?.trim() || "Unnamed coach";
  const hasName = Boolean(raw.name?.trim());

  return {
    id: String(raw.id),
    name,
    location,
    source: raw.source?.trim() || null,
    sourceLabel: directorySourceLabel(raw.source),
    isApproved: Boolean(raw.is_approved),
    hasAccount: oneOrMany(raw.coach_memberships).length > 0,
    launchSelectionStatus: launchSelectionStatusOf(raw.launch_selection_status),
    publicationStatus: publicationStatusOf(raw.publication_status),
    completionPercent: cheapCompletionPercent([
      hasName,
      Boolean(location),
      Boolean(raw.image_url?.trim()),
    ]),
    href: profileDirectoryHref("coach", String(raw.id)),
  };
}

export function mapVenueDirectoryRow(raw: VenueDirectoryRaw): ProfileDirectoryRow {
  const name = raw.name?.trim() || "Unnamed venue";
  const location = locationLabel(raw.city, raw.country);
  const hasName = Boolean(raw.name?.trim());

  return {
    id: String(raw.id),
    name,
    location,
    source: raw.source?.trim() || null,
    sourceLabel: directorySourceLabel(raw.source),
    isApproved: Boolean(raw.is_approved),
    hasAccount: oneOrMany(raw.venue_memberships).length > 0,
    launchSelectionStatus: launchSelectionStatusOf(raw.launch_selection_status),
    publicationStatus: publicationStatusOf(raw.publication_status),
    completionPercent: cheapCompletionPercent([
      hasName,
      Boolean(raw.city?.trim()),
      Boolean(raw.country?.trim()),
    ]),
    href: profileDirectoryHref("venue", String(raw.id)),
  };
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
