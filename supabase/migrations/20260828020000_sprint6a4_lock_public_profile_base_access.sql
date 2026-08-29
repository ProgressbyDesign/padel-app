-- Sprint 6A.4 Migration B — lock public base-table profile access.
--
-- Apply ONLY after the deployed app reads coach_public_profiles /
-- venue_public_profiles (Migration A) for public discovery and PDPs,
-- and relationship workspaces read public views or
-- coach_relationship_identities / venue_relationship_identities for the
-- other party. Applying this before that deploy will break public pages
-- and linked-partner boards.
--
-- This migration:
--   1. Revokes anonymous SELECT on public.coaches and public.venues.
--   2. Drops anonymous published-row SELECT policies on those tables.
--   3. Restricts authenticated base-table SELECT to own memberships and
--      profiles.read admins. Publication status is not enough.
--      Linked partners via coach_venues do NOT get the full base row.
--   4. Removes public SELECT of coach_socials / venue_socials.
--
-- Manager/admin UPDATE RLS and server-owned-field triggers are unchanged.
-- Contact columns are not dropped or nulled.
--
-- There is no linked-partner full-base-row access:
--   coach member  = complete own coach row only (not linked venues)
--   venue member  = complete own venue row only (not linked coaches)
--   profiles.read = complete rows for both
-- Linked partners use public projections when the other profile is
-- published, or the narrow relationship-identity views otherwise.

-- ---------------------------------------------------------------------------
-- 1. Anonymous base-table lockdown
-- ---------------------------------------------------------------------------
revoke select on table public.coaches from anon;
revoke select on table public.venues from anon;

drop policy if exists "Anonymous can read published coaches" on public.coaches;
drop policy if exists "Anonymous can read published venues" on public.venues;

-- ---------------------------------------------------------------------------
-- 2. Authenticated base-table SELECT — own membership or profiles.read
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. Social links — no public/player read of partner channels
-- ---------------------------------------------------------------------------
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
