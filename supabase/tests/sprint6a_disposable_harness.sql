-- Disposable harness for Sprint 6A SQL tests.
-- Intended to run inside: BEGIN; /* this file */ ROLLBACK;
-- Installs only the objects required by sprint6a_publication_security.sql
-- against a DB that does not yet have Sprint 6A applied.

alter table public.coaches
  add column if not exists publication_status text not null default 'private';
alter table public.coaches
  add column if not exists launch_selection_status text not null default 'unselected';
alter table public.coaches
  add column if not exists onboarding_status text not null default 'not_started';
alter table public.coaches
  add column if not exists selected_at timestamptz null;
alter table public.coaches
  add column if not exists selected_by_user_id uuid null;
alter table public.coaches
  add column if not exists onboarding_started_at timestamptz null;
alter table public.coaches
  add column if not exists onboarding_completed_at timestamptz null;
alter table public.coaches
  add column if not exists published_at timestamptz null;
alter table public.coaches
  add column if not exists published_by_user_id uuid null;

alter table public.venues
  add column if not exists publication_status text not null default 'private';
alter table public.venues
  add column if not exists launch_selection_status text not null default 'unselected';
alter table public.venues
  add column if not exists onboarding_status text not null default 'not_started';
alter table public.venues
  add column if not exists selected_at timestamptz null;
alter table public.venues
  add column if not exists selected_by_user_id uuid null;
alter table public.venues
  add column if not exists onboarding_started_at timestamptz null;
alter table public.venues
  add column if not exists onboarding_completed_at timestamptz null;
alter table public.venues
  add column if not exists published_at timestamptz null;
alter table public.venues
  add column if not exists published_by_user_id uuid null;

-- Lifecycle guard: members cannot self-select or self-publish; the trigger owns
-- the audit fields. Mirrors private.protect_profile_lifecycle_fields() in the
-- Sprint 6A migration.
create or replace function private.protect_profile_lifecycle_fields()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor_id uuid := (select auth.uid());
begin
  if
    new.launch_selection_status is not distinct from old.launch_selection_status
    and new.onboarding_status is not distinct from old.onboarding_status
    and new.publication_status is not distinct from old.publication_status
    and new.selected_at is not distinct from old.selected_at
    and new.selected_by_user_id is not distinct from old.selected_by_user_id
    and new.onboarding_started_at is not distinct from old.onboarding_started_at
    and new.onboarding_completed_at is not distinct from old.onboarding_completed_at
    and new.published_at is not distinct from old.published_at
    and new.published_by_user_id is not distinct from old.published_by_user_id
  then
    return new;
  end if;

  if not private.has_admin_permission('profiles.manage') then
    raise exception
      'Only administrators with profiles.manage may change launch, onboarding or publication fields.'
      using errcode = '42501';
  end if;

  if new.launch_selection_status is distinct from old.launch_selection_status
     and new.launch_selection_status = 'selected' then
    new.selected_at := now();
    new.selected_by_user_id := actor_id;
  end if;

  if new.selected_by_user_id is distinct from old.selected_by_user_id
     and new.selected_by_user_id is distinct from actor_id then
    new.selected_by_user_id := actor_id;
  end if;

  if new.publication_status is distinct from old.publication_status
     and new.publication_status = 'published' then
    new.published_at := now();
    new.published_by_user_id := actor_id;
  end if;

  if new.published_by_user_id is distinct from old.published_by_user_id
     and new.published_by_user_id is distinct from actor_id then
    new.published_by_user_id := actor_id;
  end if;

  if new.onboarding_status is distinct from old.onboarding_status then
    if new.onboarding_status in ('invited', 'in_progress') then
      new.onboarding_started_at := coalesce(old.onboarding_started_at, now());
    end if;
    if new.onboarding_status = 'complete' then
      new.onboarding_started_at := coalesce(
        new.onboarding_started_at,
        old.onboarding_started_at,
        now()
      );
      new.onboarding_completed_at := now();
    end if;
  elsif new.onboarding_started_at is null
        and old.onboarding_started_at is null
        and new.onboarding_status in ('invited', 'in_progress', 'complete') then
    new.onboarding_started_at := now();
  end if;

  return new;
end;
$function$;

drop trigger if exists protect_coach_lifecycle_fields on public.coaches;
create trigger protect_coach_lifecycle_fields
  before update on public.coaches
  for each row
  execute function private.protect_profile_lifecycle_fields();

drop trigger if exists protect_venue_lifecycle_fields on public.venues;
create trigger protect_venue_lifecycle_fields
  before update on public.venues
  for each row
  execute function private.protect_profile_lifecycle_fields();

-- Same authenticated DML grants as the Sprint 6A migration section 13c.
-- Required on pre-migration DBs so RLS and the lifecycle trigger are actually
-- reachable. RLS remains the row-level boundary.
grant update on public.profiles to authenticated;
grant insert, update on public.coaches to authenticated;
grant insert, update on public.venues to authenticated;
grant insert, update on public.coach_profile_applications to authenticated;
grant insert, update on public.venue_profile_applications to authenticated;
grant insert, update on public.coach_application_locations to authenticated;
grant insert, update on public.coach_venues to authenticated;
grant insert, update on public.coach_attributes to authenticated;
grant insert, update on public.coach_outcomes to authenticated;
grant insert, update on public.coach_achievements to authenticated;
grant insert, update on public.coach_images to authenticated;
grant insert, update on public.coach_socials to authenticated;
grant insert, update on public.venue_images to authenticated;
grant insert, update on public.venue_socials to authenticated;
grant insert, update on public.coach_memberships to authenticated;
grant insert, update on public.venue_memberships to authenticated;
grant insert on public.enquiries to authenticated;
grant insert on public.enquiries to anon;

-- Publication-gated read access for coaches.
drop policy if exists "Public read coaches" on public.coaches;
drop policy if exists "Anonymous can read published coaches" on public.coaches;
drop policy if exists "Authenticated can read permitted coaches" on public.coaches;

create policy "Anonymous can read published coaches"
  on public.coaches
  for select
  to anon
  using (publication_status = 'published');

create policy "Authenticated can read permitted coaches"
  on public.coaches
  for select
  to authenticated
  using (
    publication_status = 'published'
    or exists (
      select 1
      from public.coach_memberships membership
      where membership.coach_id = coaches.id
        and membership.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

create or replace function public.get_public_accepted_booking_ranges(
  p_range_start timestamp with time zone,
  p_range_end timestamp with time zone,
  p_coach_id uuid default null,
  p_coach_venue_id uuid default null
)
returns table (
  starts_at timestamp with time zone,
  ends_at timestamp with time zone
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    booking.starts_at,
    booking.ends_at
  from public.coach_booking_requests booking
  join public.coach_venues relationship
    on relationship.id = booking.coach_venue_id
  join public.coaches coach
    on coach.id = relationship.coach_id
  join public.venues venue
    on venue.id = relationship.venue_id
  where booking.status = 'accepted'
    and relationship.status = 'active'
    and coach.publication_status = 'published'
    and venue.publication_status = 'published'
    and (
      (p_coach_id is not null and booking.coach_id = p_coach_id)
      or (p_coach_venue_id is not null and booking.coach_venue_id = p_coach_venue_id)
    )
    and (p_coach_id is not null or p_coach_venue_id is not null)
    and p_range_start is not null
    and p_range_end is not null
    and p_range_end > p_range_start
    and booking.starts_at < p_range_end
    and booking.ends_at > p_range_start
  order by booking.starts_at;
$function$;

revoke all on function public.get_public_accepted_booking_ranges(
  timestamp with time zone,
  timestamp with time zone,
  uuid,
  uuid
) from public;
grant execute on function public.get_public_accepted_booking_ranges(
  timestamp with time zone,
  timestamp with time zone,
  uuid,
  uuid
) to anon, authenticated;

create or replace function private.prepare_application_notification_email()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_email text := lower(nullif(btrim((select auth.jwt() ->> 'email')), ''));
begin
  if tg_op = 'UPDATE'
     and old.application_mode = 'claim_existing'
     and new.status = 'withdrawn'
     and old.status is distinct from 'withdrawn' then
    new.applicant_email := old.applicant_email;
    return new;
  end if;

  if caller_id is not null and caller_id = new.user_id then
    if caller_email is null then
      raise exception 'A verified account email is required.' using errcode = '23514';
    end if;
    new.applicant_email := caller_email;
  elsif tg_op = 'UPDATE' and new.applicant_email is distinct from old.applicant_email then
    raise exception 'Applicant email cannot be changed by reviewers.' using errcode = '42501';
  end if;

  return new;
end;
$function$;

create or replace function private.guard_profile_application_mutations()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  is_reviewer boolean := false;
  old_locked jsonb;
  new_locked jsonb;
begin
  is_reviewer :=
    private.has_admin_permission('applications.review')
    or private.is_current_user_admin();

  if tg_table_name = 'coach_profile_applications' then
    if tg_op = 'INSERT' then
      if not is_reviewer then
        if new.application_mode is distinct from 'create_new'
           or new.target_coach_id is not null then
          raise exception 'Public claiming of existing coach profiles is disabled.'
            using errcode = '42501';
        end if;
      end if;
      return new;
    end if;

    if is_reviewer then
      return new;
    end if;

    if old.application_mode = 'claim_existing' then
      old_locked := to_jsonb(old) - 'status' - 'updated_at';
      new_locked := to_jsonb(new) - 'status' - 'updated_at';

      if new.status = 'withdrawn'
         and old.status in ('draft', 'submitted', 'under_review', 'changes_requested')
         and new_locked is not distinct from old_locked then
        return new;
      end if;

      raise exception
        'Historical claim applications are locked. You may withdraw them, but cannot edit or submit them.'
        using errcode = '42501';
    end if;

    if old.application_mode is distinct from 'claim_existing'
       and (
         new.application_mode is distinct from old.application_mode
         or (
           old.target_coach_id is null
           and new.target_coach_id is not null
         )
         or new.application_mode = 'claim_existing'
       ) then
      raise exception 'Public claiming of existing coach profiles is disabled.'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if tg_table_name = 'venue_profile_applications' then
    if tg_op = 'INSERT' then
      if not is_reviewer then
        if new.application_mode is distinct from 'create_new'
           or new.target_venue_id is not null then
          raise exception 'Public claiming of existing venue profiles is disabled.'
            using errcode = '42501';
        end if;
      end if;
      return new;
    end if;

    if is_reviewer then
      return new;
    end if;

    if old.application_mode = 'claim_existing' then
      old_locked := to_jsonb(old) - 'status' - 'updated_at';
      new_locked := to_jsonb(new) - 'status' - 'updated_at';

      if new.status = 'withdrawn'
         and old.status in ('draft', 'submitted', 'under_review', 'changes_requested')
         and new_locked is not distinct from old_locked then
        return new;
      end if;

      raise exception
        'Historical claim applications are locked. You may withdraw them, but cannot edit or submit them.'
        using errcode = '42501';
    end if;

    if old.application_mode is distinct from 'claim_existing'
       and (
         new.application_mode is distinct from old.application_mode
         or (
           old.target_venue_id is null
           and new.target_venue_id is not null
         )
         or new.application_mode = 'claim_existing'
       ) then
      raise exception 'Public claiming of existing venue profiles is disabled.'
        using errcode = '42501';
    end if;

    return new;
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_coach_profile_application_mutations
  on public.coach_profile_applications;
create trigger guard_coach_profile_application_mutations
  before insert or update on public.coach_profile_applications
  for each row
  execute function private.guard_profile_application_mutations();

drop trigger if exists guard_venue_profile_application_mutations
  on public.venue_profile_applications;
create trigger guard_venue_profile_application_mutations
  before insert or update on public.venue_profile_applications
  for each row
  execute function private.guard_profile_application_mutations();

-- Match the final Sprint 6A INSERT policies so application-journey tests
-- exercise create_new-only claiming lock rather than the pre-migration drafts.
drop policy if exists "Users can create their coach application draft"
  on public.coach_profile_applications;
create policy "Users can create their coach application draft"
  on public.coach_profile_applications
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'draft'
    and coach_id is null
    and application_mode = 'create_new'
    and target_coach_id is null
  );

drop policy if exists "Users can create their venue application draft"
  on public.venue_profile_applications;
create policy "Users can create their venue application draft"
  on public.venue_profile_applications
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'draft'
    and approved_venue_id is null
    and reviewed_by_user_id is null
    and application_mode = 'create_new'
    and target_venue_id is null
  );

drop policy if exists "Users can add coach application locations"
  on public.coach_application_locations;
create policy "Users can add coach application locations"
  on public.coach_application_locations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.coach_profile_applications application
      where application.id = coach_application_locations.application_id
        and application.user_id = (select auth.uid())
        and application.application_mode = 'create_new'
        and application.status in ('draft', 'changes_requested')
    )
  );

drop policy if exists "Users can update coach application locations"
  on public.coach_application_locations;
create policy "Users can update coach application locations"
  on public.coach_application_locations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.coach_profile_applications application
      where application.id = coach_application_locations.application_id
        and application.user_id = (select auth.uid())
        and application.application_mode = 'create_new'
        and application.status in ('draft', 'changes_requested')
    )
  )
  with check (
    exists (
      select 1
      from public.coach_profile_applications application
      where application.id = coach_application_locations.application_id
        and application.user_id = (select auth.uid())
        and application.application_mode = 'create_new'
        and application.status in ('draft', 'changes_requested')
    )
  );

drop policy if exists "Users can delete coach application locations"
  on public.coach_application_locations;
create policy "Users can delete coach application locations"
  on public.coach_application_locations
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.coach_profile_applications application
      where application.id = coach_application_locations.application_id
        and application.user_id = (select auth.uid())
        and application.application_mode = 'create_new'
        and application.status in ('draft', 'changes_requested')
    )
  );
