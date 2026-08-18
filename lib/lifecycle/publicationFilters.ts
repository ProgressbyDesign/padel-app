import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { PUBLISHED_STATUS } from "@/lib/lifecycle/constants";

/**
 * Explicit publication filter for public coach listing/PDP queries.
 * Call sites must still be public surfaces — do not use this to hide
 * whether a query is public vs private member/admin access.
 */
export function applyPublishedCoachFilter<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Q extends PostgrestFilterBuilder<any, any, any, any, any>,
>(query: Q): Q {
  return query.eq("publication_status", PUBLISHED_STATUS) as Q;
}

/**
 * Explicit publication filter for public venue listing/PDP queries.
 */
export function applyPublishedVenueFilter<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Q extends PostgrestFilterBuilder<any, any, any, any, any>,
>(query: Q): Q {
  return query.eq("publication_status", PUBLISHED_STATUS) as Q;
}
