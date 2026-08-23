import { requireDataQualityNavAccess } from "@/lib/auth/adminSession";
import { normalizeSearchKey } from "../searchFuzzy";
import { getSupabaseAdmin } from "../supabaseAdmin";
import type {
  AdminCoachDetail,
  AdminCoachRow,
  AdminDashboardStats,
  AdminVenueDetail,
  AdminVenueRow,
  CoachForLinking,
  CoachImageRow,
  CoachOutcomeRow,
  CoachSocialRow,
  CoachVenueLinkRow,
  ReviewQueueFilter,
  VenueSocialRow,
  VenueSuggestion,
} from "./types";

const PAGE_SIZE = 25;

async function dataQualityDb() {
  await requireDataQualityNavAccess();
  return getSupabaseAdmin();
}

function domainFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function domainFromEmail(email: string | null | undefined): string | null {
  if (!email?.includes("@")) return null;
  return email.split("@")[1]?.trim().toLowerCase() || null;
}

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const db = await dataQualityDb();

  const [venueRes, coachRes, linksRes, imagesRes, venueSocialsRes, coachesRes, venuesRes] =
    await Promise.all([
      db.from("venues").select("*", { count: "exact", head: true }),
      db.from("coaches").select("*", { count: "exact", head: true }),
      db.from("coach_venues").select("coach_id"),
      db.from("coach_images").select("coach_id"),
      db.from("venue_socials").select("venue_id"),
      db
        .from("coaches")
        .select("id, image_url, data_quality_status, is_approved"),
      db
        .from("venues")
        .select("id, data_quality_status, is_approved"),
    ]);

  const venueCount = venueRes.count ?? 0;
  const coachCount = coachRes.count ?? 0;
  const linkedCoachIds = new Set((linksRes.data ?? []).map((r) => String(r.coach_id)));
  const coachesWithImages = new Set((imagesRes.data ?? []).map((r) => String(r.coach_id)));
  const venuesWithSocials = new Set((venueSocialsRes.data ?? []).map((r) => String(r.venue_id)));

  const coaches = coachesRes.data ?? [];
  const venues = venuesRes.data ?? [];

  let coachesWithoutImage = 0;
  let coachesNeedingReview = 0;
  for (const c of coaches) {
    const id = String(c.id);
    const hasImage =
      Boolean(typeof c.image_url === "string" && c.image_url.trim()) || coachesWithImages.has(id);
    if (!hasImage) coachesWithoutImage += 1;
    const status = String(c.data_quality_status ?? "pending");
    const approved = c.is_approved === true;
    if (!approved || status === "needs_review" || status === "pending") coachesNeedingReview += 1;
  }

  let venuesNeedingReview = 0;
  for (const v of venues) {
    const status = String(v.data_quality_status ?? "pending");
    const approved = v.is_approved === true;
    if (!approved || status === "needs_review" || status === "pending") venuesNeedingReview += 1;
  }

  return {
    venueCount,
    coachCount,
    coachesWithoutVenue: coaches.filter((c) => !linkedCoachIds.has(String(c.id))).length,
    coachesWithoutImage,
    venuesWithoutSocials: venues.filter((v) => !venuesWithSocials.has(String(v.id))).length,
    coachesNeedingReview,
    venuesNeedingReview,
  };
}

export async function fetchAdminVenuesList(opts: {
  page: number;
  search?: string;
}): Promise<{ rows: AdminVenueRow[]; total: number; pageSize: number }> {
  const db = await dataQualityDb();
  const page = Math.max(1, opts.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = db
    .from("venues")
    .select(
      "id, name, city, country, website, courts, court_type, venue_type, ai_confidence, is_approved, data_quality_status, last_crawled_at",
      { count: "exact" }
    )
    .order("name", { ascending: true });

  const term = opts.search?.trim();
  if (term) {
    const key = normalizeSearchKey(term);
    if (key) q = q.ilike("search_key", `%${key}%`);
    else q = q.ilike("name", `%${term}%`);
  }

  const res = await q.range(from, to);
  if (res.error) throw new Error(res.error.message);

  return {
    rows: (res.data ?? []) as AdminVenueRow[],
    total: res.count ?? 0,
    pageSize: PAGE_SIZE,
  };
}

export async function fetchAdminVenueDetail(id: string): Promise<{
  venue: AdminVenueDetail | null;
  socials: VenueSocialRow[];
}> {
  const db = await dataQualityDb();
  const [venueRes, socialsRes] = await Promise.all([
    db.from("venues").select("*").eq("id", id).maybeSingle(),
    db.from("venue_socials").select("*").eq("venue_id", id).order("is_primary", { ascending: false }),
  ]);

  if (venueRes.error) throw new Error(venueRes.error.message);
  return {
    venue: (venueRes.data as AdminVenueDetail | null) ?? null,
    socials: (socialsRes.data ?? []) as VenueSocialRow[],
  };
}

export async function fetchAdminCoachesList(opts: {
  page: number;
  search?: string;
}): Promise<{ rows: AdminCoachRow[]; total: number; pageSize: number }> {
  const db = await dataQualityDb();
  const page = Math.max(1, opts.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = db
    .from("coaches")
    .select(
      `
      id, name, role, level, email, phone, price_from, image_url, is_approved, data_quality_status,
      coach_venues ( venue_id, is_primary, venues ( id, name, city, country ) )
    `,
      { count: "exact" }
    )
    .order("name", { ascending: true });

  const term = opts.search?.trim();
  if (term) {
    const key = normalizeSearchKey(term);
    if (key) q = q.ilike("search_key", `%${key}%`);
    else q = q.ilike("name", `%${term}%`);
  }

  const res = await q.range(from, to);
  if (res.error) throw new Error(res.error.message);

  return {
    rows: (res.data ?? []) as AdminCoachRow[],
    total: res.count ?? 0,
    pageSize: PAGE_SIZE,
  };
}

export async function fetchAdminCoachDetail(id: string): Promise<{
  coach: AdminCoachDetail | null;
  links: CoachVenueLinkRow[];
  outcomes: CoachOutcomeRow[];
  socials: CoachSocialRow[];
  images: CoachImageRow[];
}> {
  const db = await dataQualityDb();
  const [coachRes, linksRes, outcomesRes, socialsRes, imagesRes] = await Promise.all([
    db.from("coaches").select("*").eq("id", id).maybeSingle(),
    db
      .from("coach_venues")
      .select("coach_id, venue_id, is_primary, venues ( id, name, city, country, website )")
      .eq("coach_id", id),
    db.from("coach_outcomes").select("*").eq("coach_id", id),
    db.from("coach_socials").select("*").eq("coach_id", id).order("is_primary", { ascending: false }),
    db.from("coach_images").select("*").eq("coach_id", id).order("is_primary", { ascending: false }),
  ]);

  if (coachRes.error) throw new Error(coachRes.error.message);

  return {
    coach: (coachRes.data as AdminCoachDetail | null) ?? null,
    links: (linksRes.data ?? []) as unknown as CoachVenueLinkRow[],
    outcomes: (outcomesRes.data ?? []) as CoachOutcomeRow[],
    socials: (socialsRes.data ?? []) as CoachSocialRow[],
    images: (imagesRes.data ?? []) as CoachImageRow[],
  };
}

export async function searchVenuesForAdmin(term: string, limit = 20): Promise<
  { id: string; name: string; city: string | null; country: string | null; website: string | null }[]
> {
  const db = await dataQualityDb();
  let q = db.from("venues").select("id, name, city, country, website").limit(limit);
  const t = term.trim();
  if (t) {
    const key = normalizeSearchKey(t);
    q = key ? q.ilike("search_key", `%${key}%`) : q.ilike("name", `%${t}%`);
  }
  const res = await q.order("name", { ascending: true });
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((v) => ({
    id: String(v.id),
    name: v.name?.trim() || "Venue",
    city: v.city ?? null,
    country: v.country ?? null,
    website: v.website ?? null,
  }));
}

function buildVenueSuggestions(
  coach: { email?: string | null; description?: string | null },
  venues: { id: string; name: string; website: string | null }[]
): VenueSuggestion[] {
  const emailDomain = domainFromEmail(coach.email);
  const desc = (coach.description ?? "").toLowerCase();
  const out: VenueSuggestion[] = [];
  const seen = new Set<string>();

  for (const v of venues) {
    const venueDomain = domainFromUrl(v.website);
    if (emailDomain && venueDomain && emailDomain === venueDomain) {
      const key = `${v.id}-email`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          venueId: v.id,
          venueName: v.name,
          city: null,
          country: null,
          website: v.website,
          reason: "email_domain",
          reasonLabel: "Suggested by email domain",
        });
      }
    }
    const vName = v.name.trim();
    if (vName.length >= 4 && desc.includes(vName.toLowerCase())) {
      const key = `${v.id}-desc`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          venueId: v.id,
          venueName: v.name,
          city: null,
          country: null,
          website: v.website,
          reason: "description",
          reasonLabel: "Suggested by description",
        });
      }
    }
  }
  return out.slice(0, 8);
}

export async function fetchCoachesForVenueLinking(opts: {
  unlinkedOnly?: boolean;
  search?: string;
  limit?: number;
}): Promise<CoachForLinking[]> {
  const db = await dataQualityDb();
  const limit = opts.limit ?? 40;

  let coachQuery = db
    .from("coaches")
    .select("id, name, image_url, email, phone, description, coach_venues ( venue_id )")
    .order("name", { ascending: true })
    .limit(limit);

  if (opts.search?.trim()) {
    const key = normalizeSearchKey(opts.search);
    coachQuery = key
      ? coachQuery.ilike("search_key", `%${key}%`)
      : coachQuery.ilike("name", `%${opts.search}%`);
  }

  const [coachRes, venuesRes] = await Promise.all([
    coachQuery,
    db.from("venues").select("id, name, website, city, country").limit(500),
  ]);

  if (coachRes.error) throw new Error(coachRes.error.message);
  const venues = (venuesRes.data ?? []).map((v) => ({
    id: String(v.id),
    name: v.name?.trim() || "Venue",
    website: v.website ?? null,
    city: v.city ?? null,
    country: v.country ?? null,
  }));

  const rows: CoachForLinking[] = [];
  for (const c of coachRes.data ?? []) {
    const links = (c.coach_venues as { venue_id: string }[] | null) ?? [];
    const linkedVenueCount = links.length;
    if (opts.unlinkedOnly !== false && linkedVenueCount > 0) continue;

    const suggestions = buildVenueSuggestions(
      { email: c.email, description: c.description },
      venues
    ).map((s) => {
      const v = venues.find((x) => x.id === s.venueId);
      return { ...s, city: v?.city ?? null, country: v?.country ?? null };
    });

    rows.push({
      id: String(c.id),
      name: c.name,
      image_url: c.image_url,
      email: c.email,
      phone: c.phone,
      description: c.description,
      linkedVenueCount,
      suggestions,
    });
  }

  return rows;
}

export async function fetchReviewQueue(filter: ReviewQueueFilter, page: number): Promise<{
  coaches: AdminCoachRow[];
  venues: AdminVenueRow[];
  total: number;
}> {
  const db = await dataQualityDb();
  const p = Math.max(1, page);
  const from = (p - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (filter === "coaches_without_venue") {
    const { data: links } = await db.from("coach_venues").select("coach_id");
    const linked = new Set((links ?? []).map((l) => String(l.coach_id)));
    const res = await db
      .from("coaches")
      .select(
        "id, name, role, level, email, phone, price_from, image_url, is_approved, data_quality_status, coach_venues ( venue_id, venues ( id, name, city, country ) )"
      )
      .order("name", { ascending: true })
      .range(0, 499);
    const filtered = (res.data ?? []).filter((c) => !linked.has(String(c.id)));
    return {
      coaches: filtered.slice(from, to + 1) as AdminCoachRow[],
      venues: [],
      total: filtered.length,
    };
  }

  if (filter === "coaches_without_image") {
    const { data: imgLinks } = await db.from("coach_images").select("coach_id");
    const withImg = new Set((imgLinks ?? []).map((i) => String(i.coach_id)));
    const res = await db
      .from("coaches")
      .select(
        "id, name, role, level, email, phone, price_from, image_url, is_approved, data_quality_status, coach_venues ( venue_id, venues ( id, name, city, country ) )"
      )
      .order("name", { ascending: true })
      .range(0, 499);
    const filtered = (res.data ?? []).filter((c) => {
      const id = String(c.id);
      return !(c.image_url && String(c.image_url).trim()) && !withImg.has(id);
    });
    return { coaches: filtered.slice(from, to + 1) as AdminCoachRow[], venues: [], total: filtered.length };
  }

  if (filter === "coaches_low_confidence") {
    const res = await db
      .from("coaches")
      .select(
        "id, name, role, level, email, phone, price_from, image_url, is_approved, data_quality_status, coach_venues ( venue_id, venues ( id, name, city, country ) )"
      )
      .or("data_quality_status.eq.needs_review,data_quality_status.eq.pending")
      .order("name", { ascending: true })
      .range(from, to);
    return {
      coaches: (res.data ?? []) as AdminCoachRow[],
      venues: [],
      total: res.count ?? (res.data?.length ?? 0),
    };
  }

  if (filter === "venues_without_socials") {
    const { data: socials } = await db.from("venue_socials").select("venue_id");
    const withSocial = new Set((socials ?? []).map((s) => String(s.venue_id)));
    const res = await db
      .from("venues")
      .select(
        "id, name, city, country, website, courts, court_type, venue_type, ai_confidence, is_approved, data_quality_status, last_crawled_at"
      )
      .order("name", { ascending: true })
      .range(0, 499);
    const filtered = (res.data ?? []).filter((v) => !withSocial.has(String(v.id)));
    return {
      coaches: [],
      venues: filtered.slice(from, to + 1) as AdminVenueRow[],
      total: filtered.length,
    };
  }

  if (filter === "venues_needing_review") {
    const res = await db
      .from("venues")
      .select(
        "id, name, city, country, website, courts, court_type, venue_type, ai_confidence, is_approved, data_quality_status, last_crawled_at"
      )
      .or("is_approved.eq.false,data_quality_status.eq.needs_review,data_quality_status.eq.pending")
      .order("last_crawled_at", { ascending: false, nullsFirst: false })
      .range(from, to);
    return {
      coaches: [],
      venues: (res.data ?? []) as AdminVenueRow[],
      total: res.count ?? 0,
    };
  }

  // approved
  const [coachRes, venueRes] = await Promise.all([
    db
      .from("coaches")
      .select(
        "id, name, role, level, email, phone, price_from, image_url, is_approved, data_quality_status, coach_venues ( venue_id, venues ( id, name, city, country ) )"
      )
      .eq("is_approved", true)
      .order("name", { ascending: true })
      .range(from, to),
    db
      .from("venues")
      .select(
        "id, name, city, country, website, courts, court_type, venue_type, ai_confidence, is_approved, data_quality_status, last_crawled_at"
      )
      .eq("is_approved", true)
      .order("name", { ascending: true })
      .range(from, to),
  ]);

  return {
    coaches: (coachRes.data ?? []) as AdminCoachRow[],
    venues: (venueRes.data ?? []) as AdminVenueRow[],
    total: (coachRes.count ?? 0) + (venueRes.count ?? 0),
  };
}

export { PAGE_SIZE as ADMIN_PAGE_SIZE };
