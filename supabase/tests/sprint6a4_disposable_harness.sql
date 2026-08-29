-- Disposable harness for Sprint 6A.4 SQL tests.
-- Intended to run inside: BEGIN; /* 6A harness if needed */; /* this file */; ROLLBACK;
--
-- Applies Migration A then Migration B on a database that already has Sprint 6A.
-- Does not rewrite Sprint 6A history. Safe only inside a rolled-back transaction.

drop view if exists public.coach_relationship_identities;
drop view if exists public.venue_relationship_identities;
drop view if exists public.coach_public_profiles;
drop view if exists public.venue_public_profiles;

-- ---------------------------------------------------------------------------
-- Migration A — public-safe projections + relationship identities
-- ---------------------------------------------------------------------------
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

revoke all on table public.coach_public_profiles from public, anon, authenticated;
revoke all on table public.venue_public_profiles from public, anon, authenticated;
grant select on table public.coach_public_profiles to anon, authenticated;
grant select on table public.venue_public_profiles to anon, authenticated;

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

revoke all on table public.coach_relationship_identities from public, anon, authenticated;
revoke all on table public.venue_relationship_identities from public, anon, authenticated;
grant select on table public.coach_relationship_identities to authenticated;
grant select on table public.venue_relationship_identities to authenticated;

-- ---------------------------------------------------------------------------
-- Migration B — lock public base-table access
-- ---------------------------------------------------------------------------
revoke select on table public.coaches from anon;
revoke select on table public.venues from anon;

drop policy if exists "Anonymous can read published coaches" on public.coaches;
drop policy if exists "Anonymous can read published venues" on public.venues;

drop policy if exists "Authenticated can read permitted coaches" on public.coaches;
create policy "Authenticated can read permitted coaches"
  on public.coaches
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coach_memberships membership
      where membership.coach_id = coaches.id
        and membership.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

drop policy if exists "Authenticated can read permitted venues" on public.venues;
create policy "Authenticated can read permitted venues"
  on public.venues
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.venue_memberships membership
      where membership.venue_id = venues.id
        and membership.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

revoke select on table public.coach_socials from anon;
revoke select on table public.venue_socials from anon;

drop policy if exists "Anonymous can read published coach socials" on public.coach_socials;
drop policy if exists "Anonymous can read published venue socials" on public.venue_socials;

drop policy if exists "Authenticated can read permitted coach socials" on public.coach_socials;
create policy "Authenticated can read permitted coach socials"
  on public.coach_socials
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coach_memberships membership
      where membership.coach_id = coach_socials.coach_id
        and membership.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

drop policy if exists "Authenticated can read permitted venue socials" on public.venue_socials;
create policy "Authenticated can read permitted venue socials"
  on public.venue_socials
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.venue_memberships membership
      where membership.venue_id = venue_socials.venue_id
        and membership.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );
