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

revoke all on table public.coach_public_profiles from public, anon, authenticated;
revoke all on table public.venue_public_profiles from public, anon, authenticated;

grant select on table public.coach_public_profiles to anon, authenticated;
grant select on table public.venue_public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Authenticated relationship-safe identities (Draft-capable, not public)
-- ---------------------------------------------------------------------------
-- Linked partners may need a name/photo for relationship boards even when
-- the other profile is not published. Do not weaken the public views.
-- These views expose only non-sensitive identity fields. They do not grant
-- base-table access and omit contact, socials, and admin/lifecycle metadata.
--
-- Owner-privileged: they bypass coaches/venues RLS. Authorization is the
-- view WHERE clause, which requires a current coach_venues row plus the
-- caller's membership (auth.uid()).
-- Current workspace statuses (same set as CURRENT_COACH_VENUE_STATUSES):
--   unverified — imported, shown so a manager can review/verify
--   pending    — request/invite awaiting accept or decline
--   active     — confirmed working relationship
-- Terminal declined/cancelled/ended rows do not grant identity.
-- Logged-in players with no matching membership see zero rows.
-- Admin profiles.read is not granted here; admins keep base-table access
-- from Migration B.

create view public.coach_relationship_identities
with (security_barrier = true)
as
select
  coaches.id,
  coaches.name,
  coaches.role,
  coaches.image_url
from public.coaches as coaches
where exists (
  select 1
  from public.coach_venues link
  join public.venue_memberships membership
    on membership.venue_id = link.venue_id
  where link.coach_id = coaches.id
    and link.status in ('unverified', 'pending', 'active')
    and membership.user_id = (select auth.uid())
);

comment on view public.coach_relationship_identities is
  'Authenticated identity for coaches currently linked to the caller''s venues (unverified/pending/active). Name/role/image only. Not a public API and not a base-row grant.';

create view public.venue_relationship_identities
with (security_barrier = true)
as
select
  venues.id,
  venues.name,
  venues.city,
  venues.country,
  venues.image_url
from public.venues as venues
where exists (
  select 1
  from public.coach_venues link
  join public.coach_memberships membership
    on membership.coach_id = link.coach_id
  where link.venue_id = venues.id
    and link.status in ('unverified', 'pending', 'active')
    and membership.user_id = (select auth.uid())
);

comment on view public.venue_relationship_identities is
  'Authenticated identity for venues currently linked to the caller''s coaches (unverified/pending/active). Name/city/country/image only. Not a public API and not a base-row grant.';

revoke all on table public.coach_relationship_identities from public, anon, authenticated;
revoke all on table public.venue_relationship_identities from public, anon, authenticated;

grant select on table public.coach_relationship_identities to authenticated;
grant select on table public.venue_relationship_identities to authenticated;
