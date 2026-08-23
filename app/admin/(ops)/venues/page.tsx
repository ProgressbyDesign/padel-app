import { AdminProfileDirectory } from "@/components/admin/AdminProfileDirectory";
import {
  filterProfileDirectoryRows,
  paginateProfileDirectoryRows,
  parseProfileDirectorySearchParams,
} from "@/lib/admin/profileDirectory";
import { listAdminVenueDirectory } from "@/lib/admin/profileDirectoryQueries";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string | string[];
    filter?: string | string[];
    page?: string | string[];
  }>;
};

export default async function AdminVenueDirectoryPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseProfileDirectorySearchParams(raw);
  const allRows = await listAdminVenueDirectory();
  const filtered = filterProfileDirectoryRows(allRows, params);
  const paged = paginateProfileDirectoryRows(filtered, params.page);

  return (
    <AdminProfileDirectory
      title="Venues"
      eyebrow="Profiles"
      nameColumn="Venue"
      countNoun="venues"
      allCount={allRows.length}
      rows={filtered}
      pageRows={paged.rows}
      page={paged.page}
      pageCount={paged.pageCount}
      params={{ ...params, page: paged.page }}
      basePath="/admin/venues"
    />
  );
}
