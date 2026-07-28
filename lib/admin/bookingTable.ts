import type { CoachBookingRequest } from "@/lib/coachBookings/types";
import { formatMoney } from "@/lib/coachAvailability/pricing";
import { isBookingStatus, type BookingStatus } from "@/lib/coachBookings/constants";

export type AdminBookingQuickView =
  | "upcoming"
  | "awaiting"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "all";

export type AdminBookingSortKey =
  | "starts_at"
  | "created_at"
  | "status"
  | "coach"
  | "venue"
  | "price";

export type AdminBookingSearchParams = {
  q?: string;
  status?: string;
  coach?: string;
  venue?: string;
  from?: string;
  to?: string;
  view?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export type ParsedAdminBookingParams = {
  q: string;
  status: BookingStatus | null;
  coach: string;
  venue: string;
  from: string | null;
  to: string | null;
  view: AdminBookingQuickView;
  sort: AdminBookingSortKey;
  dir: "asc" | "desc";
  page: number;
};

const PAGE_SIZE = 25;

export function parseAdminBookingSearchParams(
  raw: AdminBookingSearchParams
): ParsedAdminBookingParams {
  const viewRaw = raw.view?.trim();
  const view: AdminBookingQuickView =
    viewRaw === "awaiting" ||
    viewRaw === "confirmed" ||
    viewRaw === "cancelled" ||
    viewRaw === "completed" ||
    viewRaw === "all"
      ? viewRaw
      : "upcoming";

  const sortRaw = raw.sort?.trim();
  const sort: AdminBookingSortKey =
    sortRaw === "created_at" ||
    sortRaw === "status" ||
    sortRaw === "coach" ||
    sortRaw === "venue" ||
    sortRaw === "price"
      ? sortRaw
      : "starts_at";

  const dir = raw.dir === "desc" ? "desc" : "asc";
  const statusRaw = raw.status?.trim();
  const status =
    statusRaw && isBookingStatus(statusRaw) ? statusRaw : null;

  const pageNum = Number.parseInt(raw.page ?? "1", 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return {
    q: raw.q?.trim() ?? "",
    status,
    coach: raw.coach?.trim() ?? "",
    venue: raw.venue?.trim() ?? "",
    from: isDateYmd(raw.from) ? raw.from! : null,
    to: isDateYmd(raw.to) ? raw.to! : null,
    view,
    sort,
    dir,
    page,
  };
}

function isDateYmd(value: string | undefined): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function filterAdminBookings(
  rows: CoachBookingRequest[],
  params: ParsedAdminBookingParams,
  nowMs = Date.now()
): CoachBookingRequest[] {
  let filtered = [...rows];

  if (params.view === "upcoming") {
    filtered = filtered.filter(
      (b) =>
        (b.status === "requested" || b.status === "accepted") &&
        new Date(b.starts_at).getTime() > nowMs
    );
  } else if (params.view === "awaiting") {
    filtered = filtered.filter((b) => b.status === "requested");
  } else if (params.view === "confirmed") {
    filtered = filtered.filter(
      (b) =>
        b.status === "accepted" && new Date(b.starts_at).getTime() > nowMs
    );
  } else if (params.view === "cancelled") {
    filtered = filtered.filter((b) => b.status === "cancelled");
  } else if (params.view === "completed") {
    filtered = filtered.filter((b) => b.status === "completed");
  }

  if (params.status) {
    filtered = filtered.filter((b) => b.status === params.status);
  }

  if (params.coach) {
    const q = params.coach.toLowerCase();
    filtered = filtered.filter((b) =>
      (b.coach?.name ?? "").toLowerCase().includes(q)
    );
  }

  if (params.venue) {
    const q = params.venue.toLowerCase();
    filtered = filtered.filter((b) =>
      (b.venue?.name ?? "").toLowerCase().includes(q)
    );
  }

  if (params.from) {
    filtered = filtered.filter(
      (b) => b.starts_at.slice(0, 10) >= params.from!
    );
  }
  if (params.to) {
    filtered = filtered.filter(
      (b) => b.starts_at.slice(0, 10) <= params.to!
    );
  }

  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.requester_name.toLowerCase().includes(q) ||
        b.requester_email.toLowerCase().includes(q) ||
        (b.coach?.name ?? "").toLowerCase().includes(q) ||
        (b.venue?.name ?? "").toLowerCase().includes(q)
    );
  }

  return filtered;
}

export function sortAdminBookings(
  rows: CoachBookingRequest[],
  params: ParsedAdminBookingParams,
  nowMs = Date.now()
): CoachBookingRequest[] {
  const sorted = [...rows];
  const dir = params.dir === "desc" ? -1 : 1;

  sorted.sort((a, b) => {
    switch (params.sort) {
      case "created_at":
        return (
          (new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()) *
          dir
        );
      case "status":
        return a.status.localeCompare(b.status) * dir;
      case "coach":
        return (
          (a.coach?.name ?? "").localeCompare(b.coach?.name ?? "") * dir
        );
      case "venue":
        return (
          (a.venue?.name ?? "").localeCompare(b.venue?.name ?? "") * dir
        );
      case "price": {
        const aPrice = a.price_amount_minor ?? -1;
        const bPrice = b.price_amount_minor ?? -1;
        return (aPrice - bPrice) * dir;
      }
      case "starts_at":
      default: {
        const aStart = new Date(a.starts_at).getTime();
        const bStart = new Date(b.starts_at).getTime();
        if (aStart !== bStart) return (aStart - bStart) * dir;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    }
  });

  // Default upcoming: nearest future first
  if (params.view === "upcoming" && params.sort === "starts_at" && params.dir === "asc") {
    sorted.sort((a, b) => {
      const aFuture = new Date(a.starts_at).getTime() >= nowMs;
      const bFuture = new Date(b.starts_at).getTime() >= nowMs;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });
  }

  return sorted;
}

export function paginateAdminBookings<T>(
  rows: T[],
  page: number,
  pageSize = PAGE_SIZE
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

export function formatAdminBookingPrice(
  amountMinor: number | null | undefined,
  currency: string | null | undefined
): string {
  const money = formatMoney(amountMinor, currency);
  if (money === "Price to be agreed with coach") return "To be agreed";
  return money;
}

export function adminBookingPageSize(): number {
  return PAGE_SIZE;
}

export function buildAdminBookingQueryString(
  params: ParsedAdminBookingParams & { page?: number }
): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.coach) search.set("coach", params.coach);
  if (params.venue) search.set("venue", params.venue);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.view !== "upcoming") search.set("view", params.view);
  if (params.sort !== "starts_at") search.set("sort", params.sort);
  if (params.dir !== "asc") search.set("dir", params.dir);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
