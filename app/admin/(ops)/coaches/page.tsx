import { AdminProfileDirectory } from "@/components/admin/AdminProfileDirectory";
import {
  filterProfileDirectoryRows,
  paginateProfileDirectoryRows,
  parseProfileDirectorySearchParams,
} from "@/lib/admin/profileDirectory";
import { listAdminCoachDirectory } from "@/lib/admin/profileDirectoryQueries";
import {
  accountHasPermission,
  requireAdminPermission,
} from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string | string[];
    filter?: string | string[];
    page?: string | string[];
  }>;
};

export default async function AdminCoachDirectoryPage({ searchParams }: PageProps) {
  const admin = await requireAdminPermission("profiles.read");
  const raw = await searchParams;
  const params = parseProfileDirectorySearchParams(raw);
  const allRows = await listAdminCoachDirectory();
  const filtered = filterProfileDirectoryRows(allRows, params);
  const paged = paginateProfileDirectoryRows(filtered, params.page);

  return (
    <AdminProfileDirectory
      title="Coaches"
      eyebrow="Profiles"
      nameColumn="Coach"
      countNoun="coaches"
      kind="coach"
      canManage={accountHasPermission(admin, "profiles.manage")}
      allCount={allRows.length}
      rows={filtered}
      pageRows={paged.rows}
      page={paged.page}
      pageCount={paged.pageCount}
      params={{ ...params, page: paged.page }}
      basePath="/admin/coaches"
    />
  );
}
