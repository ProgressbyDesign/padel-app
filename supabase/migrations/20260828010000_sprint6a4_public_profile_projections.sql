-- Sprint 6A.4 Migration A — public-safe coach/venue projections.
--
-- Backwards compatible with the currently deployed app: this migration only
-- ADDS views and SELECT grants. It does not revoke base-table public reads.
-- Apply this before deploying application code that reads the views.
-- Do not apply Migration B until that app is live and smoke-tested.
--
-- Security model:
--   These views are a deliberate public API. They are NOT security_invoker.
--   They run as the view owner, which can read public.coaches / public.venues
--   even after Migration B removes anon/player SELECT on those base tables.
--   The fixed WHERE publication_status = 'published' is the row filter.
--   security_barrier prevents leaky operators from probing excluded rows.
--   Column lists are explicit allow-lists. SELECT * is never used.
--
-- google_place_id is omitted: public maps use lat/lng (OpenStreetMap embed +
-- Google Maps coordinate search), not a Places ID.

create view public.coach_public_profiles
with (security_barrier = true)
as
select
  coaches.id,
  coaches.name,
  coaches.slug,
  coaches.role,
  coaches.description,
  coaches.image_url,
  coaches.level,
  coaches.experience_years,
  coaches.rating,
  coaches.review_count,
  coaches.travel_available,
  coaches.price_from,
  coaches.is_approved,
  coaches.search_key,
  coaches.publication_status
from public.coaches as coaches
where coaches.publication_status = 'published';

comment on view public.coach_public_profiles is
  'Public API for published coaches. Owner-privileged read of public.coaches; exposes only enquiry-safe columns. No email/phone/audit/lifecycle metadata.';

create view public.venue_public_profiles
with (security_barrier = true)
as
select
  venues.id,
  venues.name,
  venues.city,
  venues.country,
  venues.lat,
  venues.lng,
  venues.rating,
  venues.review_count,
  venues.image_url,
  venues.courts,
  venues.court_type,
  venues.coaching_available,
  venues.price,
  venues.coaching_description,
  venues.venue_type,
  venues.opening_hours,
  venues.opening_hours_structured,
  venues.address,
  venues.images,
  venues.is_approved,
  venues.search_key,
  venues.publication_status
from public.venues as venues
where venues.publication_status = 'published';

comment on view public.venue_public_profiles is
  'Public API for published venues. Owner-privileged read of public.venues; exposes location and profile fields, not phone/website/crawler/audit metadata.';

revoke all on table public.coach_public_profiles from public;
revoke all on table public.venue_public_profiles from public;

grant select on table public.coach_public_profiles to anon, authenticated;
grant select on table public.venue_public_profiles to anon, authenticated;
