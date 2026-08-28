-- Sprint 6A.4 Migration B — lock public base-table profile access.
--
-- Apply ONLY after the deployed app reads coach_public_profiles /
-- venue_public_profiles (Migration A) for public discovery and PDPs.
-- Applying this before that deploy will break public coach/venue pages.
--
-- This migration:
--   1. Revokes anonymous SELECT on public.coaches and public.venues.
--   2. Drops anonymous published-row SELECT policies on those tables.
--   3. Restricts authenticated base-table SELECT to managers and
--      profiles.read admins. Publication status alone is no longer enough.
--   4. Removes public SELECT of coach_socials / venue_socials.
--
-- Manager/admin UPDATE RLS and server-owned-field triggers are unchanged.
-- Contact columns are not dropped or nulled.
--
-- Partner workspace exception (not public, not "published ⇒ readable"):
-- A venue member may SELECT a coach row linked via coach_venues, and a coach
-- member may SELECT a linked venue row. Ordinary players still cannot read
-- base tables merely because a profile is published. This preserves
-- relationship boards, availability pairing, and venue ops without
-- reopening the public data boundary.

-- ---------------------------------------------------------------------------
-- 1. Anonymous base-table lockdown
-- ---------------------------------------------------------------------------
revoke select on table public.coaches from anon;
revoke select on table public.venues from anon;

drop policy if exists "Anonymous can read published coaches" on public.coaches;
drop policy if exists "Anonymous can read published venues" on public.venues;

-- ---------------------------------------------------------------------------
-- 2. Authenticated base-table SELECT — managers and admins only
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
    or exists (
      select 1
      from public.coach_venues link
      join public.venue_memberships membership
        on membership.venue_id = link.venue_id
      where link.coach_id = coaches.id
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
    or exists (
      select 1
      from public.coach_venues link
      join public.coach_memberships membership
        on membership.coach_id = link.coach_id
      where link.venue_id = venues.id
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
