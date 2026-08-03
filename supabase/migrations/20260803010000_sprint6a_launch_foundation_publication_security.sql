-- Sprint 6A: Launch foundation and publication security
-- Idempotent where practical. Does NOT publish any existing record.
-- Do not apply to production automatically from the agent.

-- ---------------------------------------------------------------------------
-- 1. Account journey on profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists account_journey text not null default 'player';

alter table public.profiles
  add column if not exists account_journey_selected_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_account_journey_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_journey_check
      check (account_journey in ('player', 'coach_business', 'travel_partner'));
  end if;
end $$;

update public.profiles p
set account_journey = 'coach_business'
where p.account_journey = 'player'
  and (
    exists (select 1 from public.coach_memberships cm where cm.user_id = p.id)
    or exists (select 1 from public.venue_memberships vm where vm.user_id = p.id)
    or exists (
      select 1
      from public.coach_profile_applications cpa
      where cpa.user_id = p.id
        and cpa.status in (
          'draft', 'submitted', 'under_review', 'changes_requested', 'approved'
        )
    )
    or exists (
      select 1
      from public.venue_profile_applications vpa
      where vpa.user_id = p.id
        and vpa.status in (
          'draft', 'submitted', 'under_review', 'changes_requested', 'approved'
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Lifecycle fields on coaches and venues
-- ---------------------------------------------------------------------------
alter table public.coaches
  add column if not exists launch_selection_status text not null default 'unselected',
  add column if not exists onboarding_status text not null default 'not_started',
  add column if not exists publication_status text not null default 'private',
  add column if not exists selected_at timestamptz null,
  add column if not exists selected_by_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists onboarding_started_at timestamptz null,
  add column if not exists onboarding_completed_at timestamptz null,
  add column if not exists published_at timestamptz null,
  add column if not exists published_by_user_id uuid null references auth.users(id) on delete set null;

alter table public.venues
  add column if not exists launch_selection_status text not null default 'unselected',
  add column if not exists onboarding_status text not null default 'not_started',
  add column if not exists publication_status text not null default 'private',
  add column if not exists selected_at timestamptz null,
  add column if not exists selected_by_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists onboarding_started_at timestamptz null,
  add column if not exists onboarding_completed_at timestamptz null,
  add column if not exists published_at timestamptz null,
  add column if not exists published_by_user_id uuid null references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'coaches_launch_selection_status_check'
      and conrelid = 'public.coaches'::regclass
  ) then
    alter table public.coaches
      add constraint coaches_launch_selection_status_check
      check (launch_selection_status in ('unselected', 'selected', 'excluded'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'coaches_onboarding_status_check'
      and conrelid = 'public.coaches'::regclass
  ) then
    alter table public.coaches
      add constraint coaches_onboarding_status_check
      check (onboarding_status in ('not_started', 'invited', 'in_progress', 'complete'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'coaches_publication_status_check'
      and conrelid = 'public.coaches'::regclass
  ) then
    alter table public.coaches
      add constraint coaches_publication_status_check
      check (publication_status in ('private', 'published', 'suspended'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'venues_launch_selection_status_check'
      and conrelid = 'public.venues'::regclass
  ) then
    alter table public.venues
      add constraint venues_launch_selection_status_check
      check (launch_selection_status in ('unselected', 'selected', 'excluded'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'venues_onboarding_status_check'
      and conrelid = 'public.venues'::regclass
  ) then
    alter table public.venues
      add constraint venues_onboarding_status_check
      check (onboarding_status in ('not_started', 'invited', 'in_progress', 'complete'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'venues_publication_status_check'
      and conrelid = 'public.venues'::regclass
  ) then
    alter table public.venues
      add constraint venues_publication_status_check
      check (publication_status in ('private', 'published', 'suspended'));
  end if;
end $$;

-- Column defaults backfill existing rows on first apply. Do not force-reset later publishes.

update public.coaches c
set onboarding_status = 'in_progress',
    onboarding_started_at = coalesce(c.onboarding_started_at, now())
where c.onboarding_status = 'not_started'
  and exists (select 1 from public.coach_memberships cm where cm.coach_id = c.id);

update public.venues v
set onboarding_status = 'in_progress',
    onboarding_started_at = coalesce(v.onboarding_started_at, now())
where v.onboarding_status = 'not_started'
  and exists (select 1 from public.venue_memberships vm where vm.venue_id = v.id);

create index if not exists coaches_publication_status_idx
  on public.coaches (publication_status);
create index if not exists coaches_launch_selection_status_idx
  on public.coaches (launch_selection_status);
create index if not exists coaches_onboarding_status_idx
  on public.coaches (onboarding_status);
create index if not exists coaches_published_rating_name_idx
  on public.coaches (publication_status, rating desc nulls last, name asc);

create index if not exists venues_publication_status_idx
  on public.venues (publication_status);
create index if not exists venues_launch_selection_status_idx
  on public.venues (launch_selection_status);
create index if not exists venues_onboarding_status_idx
  on public.venues (onboarding_status);
create index if not exists venues_published_rating_name_idx
  on public.venues (publication_status, rating desc nulls last, name asc);
create index if not exists venues_published_courts_rating_idx
  on public.venues (publication_status, courts desc nulls last, rating desc nulls last);

-- ---------------------------------------------------------------------------
-- 2b. Protect lifecycle fields — members cannot self-publish / self-select
-- ---------------------------------------------------------------------------
create or replace function private.protect_profile_lifecycle_fields()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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

-- ---------------------------------------------------------------------------
-- 3. Sprint 6B schema foundation on applications
-- ---------------------------------------------------------------------------
alter table public.coach_profile_applications
  add column if not exists owns_or_manages_venue boolean not null default false;

alter table public.venue_profile_applications
  add column if not exists coach_application_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'venue_profile_applications_coach_application_id_fkey'
      and conrelid = 'public.venue_profile_applications'::regclass
  ) then
    alter table public.venue_profile_applications
      add constraint venue_profile_applications_coach_application_id_fkey
      foreign key (coach_application_id)
      references public.coach_profile_applications(id)
      on delete cascade;
  end if;
end $$;

create unique index if not exists venue_profile_applications_coach_application_id_uidx
  on public.venue_profile_applications (coach_application_id)
  where coach_application_id is not null;

-- ---------------------------------------------------------------------------
-- 3b. Approved-venue consistency backfill (no publish / no launch-select)
-- ---------------------------------------------------------------------------
update public.venues v
set
  is_approved = true,
  data_quality_status = 'reviewed',
  reviewed_at = coalesce(v.reviewed_at, a.reviewed_at),
  reviewed_by = coalesce(v.reviewed_by, a.reviewed_by_user_id::text)
from public.venue_profile_applications a
where a.status = 'approved'
  and a.approved_venue_id is not null
  and a.approved_venue_id = v.id;

-- ---------------------------------------------------------------------------
-- 4. Availability privacy default + launch-safety reset
-- ---------------------------------------------------------------------------
alter table public.coach_venue_availability_settings
  alter column is_public set default false;

update public.coach_venue_availability_settings
set is_public = false
where is_public is distinct from false;

-- ---------------------------------------------------------------------------
-- 5. Publication helpers (SECURITY DEFINER, fixed path)
-- ---------------------------------------------------------------------------
create or replace function private.coach_is_published(target_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.coaches c
    where c.id = target_coach_id
      and c.publication_status = 'published'
  );
$$;

create or replace function private.venue_is_published(target_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.venues v
    where v.id = target_venue_id
      and v.publication_status = 'published'
  );
$$;

create or replace function private.coach_venue_is_publicly_visible(target_coach_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.coach_venues cv
    join public.coaches c on c.id = cv.coach_id
    join public.venues v on v.id = cv.venue_id
    where cv.id = target_coach_venue_id
      and cv.status = 'active'
      and c.publication_status = 'published'
      and v.publication_status = 'published'
  );
$$;

create or replace function private.availability_is_publicly_readable(target_coach_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.coach_venue_availability_settings s
    join public.coach_venues cv on cv.id = s.coach_venue_id
    join public.coaches c on c.id = cv.coach_id
    join public.venues v on v.id = cv.venue_id
    where s.coach_venue_id = target_coach_venue_id
      and s.is_public is true
      and cv.status = 'active'
      and c.publication_status = 'published'
      and v.publication_status = 'published'
  );
$$;

revoke all on function private.coach_is_published(uuid) from public;
revoke all on function private.venue_is_published(uuid) from public;
revoke all on function private.coach_venue_is_publicly_visible(uuid) from public;
revoke all on function private.availability_is_publicly_readable(uuid) from public;
grant execute on function private.coach_is_published(uuid) to authenticated, anon;
grant execute on function private.venue_is_published(uuid) to authenticated, anon;
grant execute on function private.coach_venue_is_publicly_visible(uuid) to authenticated, anon;
grant execute on function private.availability_is_publicly_readable(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 6. Booking validation — separate creation vs acceptance
-- Slot validity (active + public settings + schedule/conflicts) without publication.
-- New inserts additionally require published coach + venue.
-- ---------------------------------------------------------------------------
create or replace function private.is_valid_availability_slot(
  target_coach_venue_id uuid,
  target_starts_at timestamp with time zone,
  target_ends_at timestamp with time zone
)
returns boolean
language sql
stable
set search_path to ''
as $function$
  with settings as (
    select availability.timezone
    from public.coach_venue_availability_settings availability
    join public.coach_venues relationship
      on relationship.id = availability.coach_venue_id
    where availability.coach_venue_id = target_coach_venue_id
      and availability.is_public is true
      and relationship.status = 'active'
  ),
  local_slot as (
    select
      settings.timezone,
      target_starts_at at time zone settings.timezone as local_start,
      target_ends_at at time zone settings.timezone as local_end
    from settings
  ),
  recurring_match as (
    select 1
    from local_slot slot
    join public.coach_availability_rules rule
      on rule.coach_venue_id = target_coach_venue_id
    where rule.is_active is true
      and rule.day_of_week = extract(isodow from slot.local_start)::smallint
      and slot.local_start::date >= rule.valid_from
      and (rule.valid_until is null or slot.local_start::date <= rule.valid_until)
      and slot.local_start::date = slot.local_end::date
      and slot.local_start::time >= rule.start_time
      and slot.local_end::time <= rule.end_time
      and target_ends_at - target_starts_at = make_interval(mins => rule.slot_duration_minutes)
      and mod(
        extract(epoch from (slot.local_start::time - rule.start_time))::bigint,
        (rule.slot_duration_minutes * 60)::bigint
      ) = 0
    limit 1
  ),
  extra_match as (
    select 1
    from public.coach_availability_exceptions exception
    where exception.coach_venue_id = target_coach_venue_id
      and exception.exception_type = 'available'
      and target_starts_at >= exception.starts_at
      and target_ends_at <= exception.ends_at
      and target_ends_at - target_starts_at = make_interval(mins => exception.slot_duration_minutes)
      and mod(
        extract(epoch from (target_starts_at - exception.starts_at))::bigint,
        (exception.slot_duration_minutes * 60)::bigint
      ) = 0
    limit 1
  ),
  blocked as (
    select 1
    from public.coach_availability_exceptions exception
    where exception.coach_venue_id = target_coach_venue_id
      and exception.exception_type = 'unavailable'
      and tstzrange(exception.starts_at, exception.ends_at, '[)')
          && tstzrange(target_starts_at, target_ends_at, '[)')
    limit 1
  )
  select
    target_starts_at > now()
    and target_ends_at > target_starts_at
    and (
      exists (select 1 from recurring_match)
      or exists (select 1 from extra_match)
    )
    and not exists (select 1 from blocked);
$function$;

-- Kept for callers: public-creation path includes publication requirement.
create or replace function private.is_valid_public_availability_slot(
  target_coach_venue_id uuid,
  target_starts_at timestamp with time zone,
  target_ends_at timestamp with time zone
)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select
    private.availability_is_publicly_readable(target_coach_venue_id)
    and private.is_valid_availability_slot(
      target_coach_venue_id,
      target_starts_at,
      target_ends_at
    );
$function$;

create or replace function private.prepare_coach_booking_request()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  relationship_record public.coach_venues%rowtype;
  settings_record public.coach_venue_availability_settings%rowtype;
  coach_publication text;
  venue_publication text;
  resolved_price record;
  caller_is_coach_member boolean := false;
  caller_is_admin boolean := false;
  status_changed boolean := false;
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  caller_is_admin := private.is_current_user_admin();

  if tg_op = 'INSERT' then
    select * into relationship_record
    from public.coach_venues
    where id = new.coach_venue_id;

    if relationship_record.id is null or relationship_record.status <> 'active' then
      raise exception 'Booking requests require an active coach venue relationship.'
        using errcode = '23514';
    end if;

    select c.publication_status, v.publication_status
      into coach_publication, venue_publication
    from public.coaches c, public.venues v
    where c.id = relationship_record.coach_id
      and v.id = relationship_record.venue_id;

    if coach_publication is distinct from 'published'
       or venue_publication is distinct from 'published' then
      raise exception 'Booking requests require a published coach and venue.'
        using errcode = '23514';
    end if;

    select * into settings_record
    from public.coach_venue_availability_settings
    where coach_venue_id = new.coach_venue_id;

    if settings_record.coach_venue_id is null or settings_record.is_public is not true then
      raise exception 'This coach is not accepting public booking requests at this venue.'
        using errcode = '23514';
    end if;

    if new.requester_user_id <> caller_id then
      raise exception 'The requester cannot be changed.' using errcode = '42501';
    end if;

    if not private.is_valid_availability_slot(
      new.coach_venue_id, new.starts_at, new.ends_at
    ) then
      raise exception 'The selected time is no longer available.' using errcode = '23514';
    end if;

    select * into resolved_price
    from private.resolve_public_slot_price(
      new.coach_venue_id, new.starts_at, new.ends_at
    );

    new.coach_id := relationship_record.coach_id;
    new.venue_id := relationship_record.venue_id;
    new.timezone := settings_record.timezone;
    new.status := 'requested';
    new.price_amount_minor := resolved_price.price_amount_minor;
    new.currency := resolved_price.currency;
    new.pricing_source := resolved_price.pricing_source;
    new.responded_at := null;
    new.responded_by_user_id := null;
    new.cancelled_at := null;
    new.cancelled_by_user_id := null;
    new.completed_at := null;
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.coach_venue_id is distinct from old.coach_venue_id
     or new.coach_id is distinct from old.coach_id
     or new.venue_id is distinct from old.venue_id
     or new.requester_user_id is distinct from old.requester_user_id
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.timezone is distinct from old.timezone
     or new.requester_name is distinct from old.requester_name
     or new.requester_email is distinct from old.requester_email
     or new.requester_phone is distinct from old.requester_phone
     or new.player_level is distinct from old.player_level
     or new.message is distinct from old.message
     or new.price_amount_minor is distinct from old.price_amount_minor
     or new.currency is distinct from old.currency
     or new.pricing_source is distinct from old.pricing_source
     or new.created_at is distinct from old.created_at then
    raise exception 'Booking request details cannot be changed after submission.'
      using errcode = '42501';
  end if;

  select exists (
    select 1 from public.coach_memberships
    where coach_id = old.coach_id and user_id = caller_id
  ) into caller_is_coach_member;

  status_changed := new.status is distinct from old.status;
  if not status_changed then
    new.updated_at := now();
    return new;
  end if;

  case old.status
    when 'requested' then
      if new.status in ('accepted', 'declined') then
        if not caller_is_coach_member and not caller_is_admin then
          raise exception 'Only the coach may respond to this booking request.'
            using errcode = '42501';
        end if;
        -- Acceptance: slot/conflict checks only — publication may have changed.
        if new.status = 'accepted'
           and not private.is_valid_availability_slot(
             old.coach_venue_id, old.starts_at, old.ends_at
           ) then
          raise exception 'The selected time is no longer available.'
            using errcode = '23514';
        end if;
        new.responded_at := now();
        new.responded_by_user_id := caller_id;
        new.cancelled_at := null;
        new.cancelled_by_user_id := null;
        new.completed_at := null;
      elsif new.status = 'cancelled' then
        if caller_id <> old.requester_user_id
           and not caller_is_coach_member
           and not caller_is_admin then
          raise exception 'Only the requester or coach may cancel this request.'
            using errcode = '42501';
        end if;
        new.cancelled_at := now();
        new.cancelled_by_user_id := caller_id;
        new.responded_at := null;
        new.responded_by_user_id := null;
        new.completed_at := null;
      else
        raise exception 'Invalid transition from requested.' using errcode = '23514';
      end if;
    when 'accepted' then
      if new.status = 'cancelled' then
        if caller_id <> old.requester_user_id
           and not caller_is_coach_member
           and not caller_is_admin then
          raise exception 'Only the requester or coach may cancel this session.'
            using errcode = '42501';
        end if;
        new.cancelled_at := now();
        new.cancelled_by_user_id := caller_id;
        new.completed_at := null;
      elsif new.status = 'completed' then
        if not caller_is_coach_member and not caller_is_admin then
          raise exception 'Only the coach may mark the session complete.'
            using errcode = '42501';
        end if;
        if old.ends_at > now() then
          raise exception 'A future session cannot be marked complete.'
            using errcode = '23514';
        end if;
        new.completed_at := now();
        new.cancelled_at := null;
        new.cancelled_by_user_id := null;
      else
        raise exception 'Invalid transition from accepted.' using errcode = '23514';
      end if;
    when 'declined', 'cancelled', 'completed' then
      raise exception 'Historical booking requests cannot be changed.'
        using errcode = '23514';
    else
      raise exception 'Unknown booking status.' using errcode = '23514';
  end case;

  new.updated_at := now();
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Claim lock + new-claim prevention + coach_application_id protection
-- ---------------------------------------------------------------------------
create or replace function private.guard_profile_application_mutations()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  is_reviewer boolean := false;
  linked_user_id uuid;
  withdrawable boolean := false;
begin
  is_reviewer :=
    private.has_admin_permission('applications.review')
    or private.is_current_user_admin();

  -- --- coach applications ---
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

    -- UPDATE
    if is_reviewer then
      return new;
    end if;

    if old.application_mode = 'claim_existing' then
      withdrawable :=
        old.status in ('draft', 'submitted', 'under_review', 'changes_requested')
        and new.status = 'withdrawn';

      if withdrawable
         and new.user_id is not distinct from old.user_id
         and new.application_mode is not distinct from old.application_mode
         and new.target_coach_id is not distinct from old.target_coach_id
         and new.current_step is not distinct from old.current_step
         and new.full_name is not distinct from old.full_name
         and new.phone is not distinct from old.phone
         and new.coaching_role is not distinct from old.coaching_role
         and new.coaching_role_other is not distinct from old.coaching_role_other
         and new.experience_years is not distinct from old.experience_years
         and new.description is not distinct from old.description
         and new.player_levels is not distinct from old.player_levels
         and new.audiences is not distinct from old.audiences
         and new.outcomes is not distinct from old.outcomes
         and new.terms_accepted_at is not distinct from old.terms_accepted_at
         and new.privacy_accepted_at is not distinct from old.privacy_accepted_at
         and new.submitted_at is not distinct from old.submitted_at
         and new.coach_id is not distinct from old.coach_id
         and new.applicant_email is not distinct from old.applicant_email
         and new.reviewed_at is not distinct from old.reviewed_at
         and new.reviewed_by_user_id is not distinct from old.reviewed_by_user_id
         and new.review_note is not distinct from old.review_note
         and new.owns_or_manages_venue is not distinct from old.owns_or_manages_venue
      then
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

  -- --- venue applications ---
  if tg_table_name = 'venue_profile_applications' then
    if tg_op = 'INSERT' then
      if not is_reviewer then
        if new.application_mode is distinct from 'create_new'
           or new.target_venue_id is not null then
          raise exception 'Public claiming of existing venue profiles is disabled.'
            using errcode = '42501';
        end if;
        if new.coach_application_id is not null then
          raise exception 'Applicants cannot link a coach application id.'
            using errcode = '42501';
        end if;
      else
        if new.coach_application_id is not null then
          select cpa.user_id into linked_user_id
          from public.coach_profile_applications cpa
          where cpa.id = new.coach_application_id;
          if linked_user_id is null or linked_user_id is distinct from new.user_id then
            raise exception
              'Linked coach application must belong to the same applicant.'
              using errcode = '23514';
          end if;
        end if;
      end if;
      return new;
    end if;

    -- UPDATE
    if not is_reviewer then
      if new.coach_application_id is distinct from old.coach_application_id then
        raise exception 'Applicants cannot set or change coach_application_id.'
          using errcode = '42501';
      end if;
    else
      if new.coach_application_id is distinct from old.coach_application_id
         and new.coach_application_id is not null then
        select cpa.user_id into linked_user_id
        from public.coach_profile_applications cpa
        where cpa.id = new.coach_application_id;
        if linked_user_id is null or linked_user_id is distinct from new.user_id then
          raise exception
            'Linked coach application must belong to the same applicant.'
            using errcode = '23514';
        end if;
      end if;
    end if;

    if is_reviewer then
      return new;
    end if;

    if old.application_mode = 'claim_existing' then
      withdrawable :=
        old.status in ('draft', 'submitted', 'under_review', 'changes_requested')
        and new.status = 'withdrawn';

      if withdrawable
         and new.user_id is not distinct from old.user_id
         and new.application_mode is not distinct from old.application_mode
         and new.target_venue_id is not distinct from old.target_venue_id
         and new.current_step is not distinct from old.current_step
         and new.relationship_to_venue is not distinct from old.relationship_to_venue
         and new.proposed_venue_name is not distinct from old.proposed_venue_name
         and new.proposed_country is not distinct from old.proposed_country
         and new.proposed_city is not distinct from old.proposed_city
         and new.proposed_address is not distinct from old.proposed_address
         and new.proposed_website is not distinct from old.proposed_website
         and new.phone is not distinct from old.phone
         and new.supporting_note is not distinct from old.supporting_note
         and new.terms_accepted_at is not distinct from old.terms_accepted_at
         and new.privacy_accepted_at is not distinct from old.privacy_accepted_at
         and new.submitted_at is not distinct from old.submitted_at
         and new.approved_venue_id is not distinct from old.approved_venue_id
         and new.approved_membership_role is not distinct from old.approved_membership_role
         and new.applicant_email is not distinct from old.applicant_email
         and new.reviewed_at is not distinct from old.reviewed_at
         and new.reviewed_by_user_id is not distinct from old.reviewed_by_user_id
         and new.review_note is not distinct from old.review_note
         and new.coach_application_id is not distinct from old.coach_application_id
      then
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

drop trigger if exists prevent_new_public_coach_claims
  on public.coach_profile_applications;
drop trigger if exists guard_coach_profile_application_mutations
  on public.coach_profile_applications;
create trigger guard_coach_profile_application_mutations
  before insert or update on public.coach_profile_applications
  for each row
  execute function private.guard_profile_application_mutations();

drop trigger if exists prevent_new_public_venue_claims
  on public.venue_profile_applications;
drop trigger if exists guard_venue_profile_application_mutations
  on public.venue_profile_applications;
create trigger guard_venue_profile_application_mutations
  before insert or update on public.venue_profile_applications
  for each row
  execute function private.guard_profile_application_mutations();

-- Exact create_new required (no coalesce / NULL mode)
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
    and coach_application_id is null
  );

-- ---------------------------------------------------------------------------
-- 7b. coach_application_locations — create_new + editable status only
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 8. Public RLS — coaches / venues
-- ---------------------------------------------------------------------------
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

drop policy if exists "Public read venues" on public.venues;
drop policy if exists "Anonymous can read published venues" on public.venues;
drop policy if exists "Authenticated can read permitted venues" on public.venues;

create policy "Anonymous can read published venues"
  on public.venues
  for select
  to anon
  using (publication_status = 'published');

create policy "Authenticated can read permitted venues"
  on public.venues
  for select
  to authenticated
  using (
    publication_status = 'published'
    or exists (
      select 1
      from public.venue_memberships membership
      where membership.venue_id = venues.id
        and membership.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

-- ---------------------------------------------------------------------------
-- 9. Coach child SELECT — separate anon vs authenticated
-- ---------------------------------------------------------------------------
drop policy if exists "Public read coach_attributes" on public.coach_attributes;
drop policy if exists "Published coach attributes are readable" on public.coach_attributes;
drop policy if exists "Anonymous can read published coach attributes" on public.coach_attributes;
drop policy if exists "Authenticated can read permitted coach attributes" on public.coach_attributes;

create policy "Anonymous can read published coach attributes"
  on public.coach_attributes
  for select
  to anon
  using (private.coach_is_published(coach_id));

create policy "Authenticated can read permitted coach attributes"
  on public.coach_attributes
  for select
  to authenticated
  using (
    private.coach_is_published(coach_id)
    or exists (
      select 1 from public.coach_memberships m
      where m.coach_id = coach_attributes.coach_id
        and m.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

drop policy if exists "Public read coach_outcomes" on public.coach_outcomes;
drop policy if exists "Published coach outcomes are readable" on public.coach_outcomes;
drop policy if exists "Anonymous can read published coach outcomes" on public.coach_outcomes;
drop policy if exists "Authenticated can read permitted coach outcomes" on public.coach_outcomes;

create policy "Anonymous can read published coach outcomes"
  on public.coach_outcomes
  for select
  to anon
  using (private.coach_is_published(coach_id));

create policy "Authenticated can read permitted coach outcomes"
  on public.coach_outcomes
  for select
  to authenticated
  using (
    private.coach_is_published(coach_id)
    or exists (
      select 1 from public.coach_memberships m
      where m.coach_id = coach_outcomes.coach_id
        and m.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

drop policy if exists "Public read coach_achievements" on public.coach_achievements;
drop policy if exists "Published coach achievements are readable" on public.coach_achievements;
drop policy if exists "Anonymous can read published coach achievements" on public.coach_achievements;
drop policy if exists "Authenticated can read permitted coach achievements" on public.coach_achievements;

create policy "Anonymous can read published coach achievements"
  on public.coach_achievements
  for select
  to anon
  using (private.coach_is_published(coach_id));

create policy "Authenticated can read permitted coach achievements"
  on public.coach_achievements
  for select
  to authenticated
  using (
    private.coach_is_published(coach_id)
    or exists (
      select 1 from public.coach_memberships m
      where m.coach_id = coach_achievements.coach_id
        and m.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

drop policy if exists "Public read coach_images" on public.coach_images;
drop policy if exists "Published coach images are readable" on public.coach_images;
drop policy if exists "Anonymous can read published coach images" on public.coach_images;
drop policy if exists "Authenticated can read permitted coach images" on public.coach_images;

create policy "Anonymous can read published coach images"
  on public.coach_images
  for select
  to anon
  using (private.coach_is_published(coach_id));

create policy "Authenticated can read permitted coach images"
  on public.coach_images
  for select
  to authenticated
  using (
    private.coach_is_published(coach_id)
    or exists (
      select 1 from public.coach_memberships m
      where m.coach_id = coach_images.coach_id
        and m.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

drop policy if exists "Public read coach locations" on public.coach_locations;
drop policy if exists "Published coach locations are readable" on public.coach_locations;
drop policy if exists "Anonymous can read published coach locations" on public.coach_locations;
drop policy if exists "Authenticated can read permitted coach locations" on public.coach_locations;

create policy "Anonymous can read published coach locations"
  on public.coach_locations
  for select
  to anon
  using (private.coach_is_published(coach_id));

create policy "Authenticated can read permitted coach locations"
  on public.coach_locations
  for select
  to authenticated
  using (
    private.coach_is_published(coach_id)
    or exists (
      select 1 from public.coach_memberships m
      where m.coach_id = coach_locations.coach_id
        and m.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

drop policy if exists "Public can read coach socials" on public.coach_socials;
drop policy if exists "Published coach socials are readable" on public.coach_socials;
drop policy if exists "Anonymous can read published coach socials" on public.coach_socials;
drop policy if exists "Authenticated can read permitted coach socials" on public.coach_socials;

create policy "Anonymous can read published coach socials"
  on public.coach_socials
  for select
  to anon
  using (private.coach_is_published(coach_id));

create policy "Authenticated can read permitted coach socials"
  on public.coach_socials
  for select
  to authenticated
  using (
    private.coach_is_published(coach_id)
    or exists (
      select 1 from public.coach_memberships m
      where m.coach_id = coach_socials.coach_id
        and m.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

-- ---------------------------------------------------------------------------
-- 10. Venue child SELECT — separate anon vs authenticated
-- ---------------------------------------------------------------------------
drop policy if exists "Public can view venue images" on public.venue_images;
drop policy if exists "Published venue images are readable" on public.venue_images;
drop policy if exists "Anonymous can read published venue images" on public.venue_images;
drop policy if exists "Authenticated can read permitted venue images" on public.venue_images;

create policy "Anonymous can read published venue images"
  on public.venue_images
  for select
  to anon
  using (private.venue_is_published(venue_id));

create policy "Authenticated can read permitted venue images"
  on public.venue_images
  for select
  to authenticated
  using (
    private.venue_is_published(venue_id)
    or exists (
      select 1 from public.venue_memberships m
      where m.venue_id = venue_images.venue_id
        and m.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

drop policy if exists "Public can view venue socials" on public.venue_socials;
drop policy if exists "Published venue socials are readable" on public.venue_socials;
drop policy if exists "Anonymous can read published venue socials" on public.venue_socials;
drop policy if exists "Authenticated can read permitted venue socials" on public.venue_socials;

create policy "Anonymous can read published venue socials"
  on public.venue_socials
  for select
  to anon
  using (private.venue_is_published(venue_id));

create policy "Authenticated can read permitted venue socials"
  on public.venue_socials
  for select
  to authenticated
  using (
    private.venue_is_published(venue_id)
    or exists (
      select 1 from public.venue_memberships m
      where m.venue_id = venue_socials.venue_id
        and m.user_id = (select auth.uid())
    )
    or private.has_admin_permission('profiles.read')
  );

-- ---------------------------------------------------------------------------
-- 11. coach_venues
-- ---------------------------------------------------------------------------
drop policy if exists "Anonymous users can view current coach venue links"
  on public.coach_venues;
drop policy if exists "Anonymous can view published active coach venue links"
  on public.coach_venues;
create policy "Anonymous can view published active coach venue links"
  on public.coach_venues
  for select
  to anon
  using (private.coach_venue_is_publicly_visible(id));

drop policy if exists "Authenticated users can view permitted coach venue links"
  on public.coach_venues;
create policy "Authenticated users can view permitted coach venue links"
  on public.coach_venues
  for select
  to authenticated
  using (
    private.coach_venue_is_publicly_visible(id)
    or exists (
      select 1 from public.coach_memberships membership
      where membership.coach_id = coach_venues.coach_id
        and membership.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.venue_memberships membership
      where membership.venue_id = coach_venues.venue_id
        and membership.user_id = (select auth.uid())
    )
    or private.has_admin_permission('relationships.read')
  );

-- ---------------------------------------------------------------------------
-- 12. Availability tables (anon already separate)
-- ---------------------------------------------------------------------------
drop policy if exists "Public can view published coach venue availability settings"
  on public.coach_venue_availability_settings;
create policy "Public can view published coach venue availability settings"
  on public.coach_venue_availability_settings
  for select
  to anon
  using (private.availability_is_publicly_readable(coach_venue_id));

drop policy if exists "Authenticated users can view permitted availability settings"
  on public.coach_venue_availability_settings;
create policy "Authenticated users can view permitted availability settings"
  on public.coach_venue_availability_settings
  for select
  to authenticated
  using (
    private.availability_is_publicly_readable(coach_venue_id)
    or exists (
      select 1
      from public.coach_venues relationship
      join public.coach_memberships membership
        on membership.coach_id = relationship.coach_id
      where relationship.id = coach_venue_availability_settings.coach_venue_id
        and membership.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.coach_venues relationship
      join public.venue_memberships membership
        on membership.venue_id = relationship.venue_id
      where relationship.id = coach_venue_availability_settings.coach_venue_id
        and membership.user_id = (select auth.uid())
    )
    or private.is_current_user_admin()
  );

drop policy if exists "Public can view published availability rules"
  on public.coach_availability_rules;
create policy "Public can view published availability rules"
  on public.coach_availability_rules
  for select
  to anon
  using (
    is_active is true
    and private.availability_is_publicly_readable(coach_venue_id)
  );

drop policy if exists "Authenticated users can view permitted availability rules"
  on public.coach_availability_rules;
create policy "Authenticated users can view permitted availability rules"
  on public.coach_availability_rules
  for select
  to authenticated
  using (
    (
      is_active is true
      and private.availability_is_publicly_readable(coach_venue_id)
    )
    or exists (
      select 1
      from public.coach_venues relationship
      join public.coach_memberships membership
        on membership.coach_id = relationship.coach_id
      where relationship.id = coach_availability_rules.coach_venue_id
        and membership.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.coach_venues relationship
      join public.venue_memberships membership
        on membership.venue_id = relationship.venue_id
      where relationship.id = coach_availability_rules.coach_venue_id
        and membership.user_id = (select auth.uid())
    )
    or private.is_current_user_admin()
  );

drop policy if exists "Public can view published availability exceptions"
  on public.coach_availability_exceptions;
create policy "Public can view published availability exceptions"
  on public.coach_availability_exceptions
  for select
  to anon
  using (private.availability_is_publicly_readable(coach_venue_id));

drop policy if exists "Authenticated users can view permitted availability exceptions"
  on public.coach_availability_exceptions;
create policy "Authenticated users can view permitted availability exceptions"
  on public.coach_availability_exceptions
  for select
  to authenticated
  using (
    private.availability_is_publicly_readable(coach_venue_id)
    or exists (
      select 1
      from public.coach_venues relationship
      join public.coach_memberships membership
        on membership.coach_id = relationship.coach_id
      where relationship.id = coach_availability_exceptions.coach_venue_id
        and membership.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.coach_venues relationship
      join public.venue_memberships membership
        on membership.venue_id = relationship.venue_id
      where relationship.id = coach_availability_exceptions.coach_venue_id
        and membership.user_id = (select auth.uid())
    )
    or private.is_current_user_admin()
  );

-- ---------------------------------------------------------------------------
-- 13. Booking insert with_check
-- ---------------------------------------------------------------------------
drop policy if exists "Requesters can create booking requests"
  on public.coach_booking_requests;
create policy "Requesters can create booking requests"
  on public.coach_booking_requests
  for insert
  to authenticated
  with check (
    requester_user_id = (select auth.uid())
    and status = 'requested'
    and private.availability_is_publicly_readable(coach_venue_id)
  );

-- ---------------------------------------------------------------------------
-- 14. SQL verification tests
-- Nested BEGIN/EXCEPTION blocks roll back fixture mutations.
-- ---------------------------------------------------------------------------
do $$
declare
  published_coaches bigint;
  published_venues bigint;
  anon_policy record;
  bad_anon_count int := 0;
  sample_coach_id uuid;
  sample_venue_id uuid;
  private_attr_coach_id uuid;
  published_attr_coach_id uuid;
  private_img_venue_id uuid;
  published_img_venue_id uuid;
  claim_app_id uuid;
  claim_user_id uuid;
  claim_status text;
  claim_loc_id uuid;
  claim_loc_city text;
  other_coach_app_id uuid;
  venue_app_id uuid;
  venue_app_user_id uuid;
  booking_fn text;
  anon_visible_count bigint;
  anon_hidden_count bigint;
  booking_policy_ok boolean;
  loc_update_count int;
begin
  -- (10) Migration publishes zero records
  select count(*) into published_coaches
  from public.coaches where publication_status = 'published';
  select count(*) into published_venues
  from public.venues where publication_status = 'published';

  if published_coaches <> 0 or published_venues <> 0 then
    raise exception
      'Sprint 6A verification failed: expected 0 published coaches/venues, found % / %',
      published_coaches, published_venues;
  end if;

  -- Anon child SELECT policies: published-parent only, no admin helpers
  for anon_policy in
    select tablename, policyname, coalesce(qual, '') as qual
    from pg_policies
    where schemaname = 'public'
      and 'anon' = any (roles)
      and cmd = 'SELECT'
      and tablename in (
        'coach_attributes',
        'coach_outcomes',
        'coach_achievements',
        'coach_images',
        'coach_locations',
        'coach_socials',
        'venue_images',
        'venue_socials',
        'coach_venues',
        'coach_venue_availability_settings',
        'coach_availability_rules',
        'coach_availability_exceptions'
      )
  loop
    if anon_policy.qual ilike '%has_admin_permission%'
       or anon_policy.qual ilike '%is_current_user_admin%' then
      bad_anon_count := bad_anon_count + 1;
    end if;
  end loop;

  if bad_anon_count > 0 then
    raise exception
      'Sprint 6A verification failed: % anon policies reference admin helpers',
      bad_anon_count;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'venue_profile_applications'
      and policyname = 'Users can create their venue application draft'
      and (
        coalesce(with_check, '') ilike '%coalesce%application_mode%'
        or coalesce(with_check, '') not ilike '%application_mode = ''create_new''%'
      )
  ) then
    raise exception
      'Sprint 6A verification failed: venue insert policy must require application_mode = create_new exactly';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'coach_application_locations'
      and policyname in (
        'Users can add coach application locations',
        'Users can update coach application locations',
        'Users can delete coach application locations'
      )
      and (coalesce(qual, '') || coalesce(with_check, ''))
          not ilike '%application_mode = ''create_new''%'
  ) then
    raise exception
      'Sprint 6A verification failed: location write policies must require create_new';
  end if;

  select id into sample_coach_id from public.coaches limit 1;
  select id into sample_venue_id from public.venues limit 1;

  if sample_coach_id is null or sample_venue_id is null then
    raise exception 'Sprint 6A verification failed: missing sample coach/venue rows';
  end if;

  -- (1) Members cannot self-publish (lifecycle trigger; no admin JWT)
  begin
    update public.coaches
    set publication_status = 'published'
    where id = sample_coach_id;
    raise exception 'Sprint 6A verification failed: coach self-publish was allowed';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null;
      else raise;
      end if;
  end;

  begin
    update public.venues
    set publication_status = 'published'
    where id = sample_venue_id;
    raise exception 'Sprint 6A verification failed: venue self-publish was allowed';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null;
      else raise;
      end if;
  end;

  if exists (
    select 1 from public.coaches
    where id = sample_coach_id and publication_status = 'published'
  ) or exists (
    select 1 from public.venues
    where id = sample_venue_id and publication_status = 'published'
  ) then
    raise exception 'Sprint 6A verification failed: self-publish left a published row';
  end if;

  -- (2)+(3) Anon can read published children; cannot read private children
  select coach_id into private_attr_coach_id
  from public.coach_attributes
  limit 1;
  select venue_id into private_img_venue_id
  from public.venue_images
  limit 1;

  if private_attr_coach_id is not null then
    alter table public.coaches disable trigger protect_coach_lifecycle_fields;
    update public.coaches
    set publication_status = 'published'
    where id = private_attr_coach_id;
    published_attr_coach_id := private_attr_coach_id;

    begin
      execute 'set local role anon';
      execute 'select count(*) from public.coach_attributes where coach_id = $1'
        into anon_visible_count
        using published_attr_coach_id;
      execute 'reset role';

      if anon_visible_count < 1 then
        raise exception
          'Sprint 6A verification failed: anon could not read published coach child rows';
      end if;
    exception
      when others then
        begin execute 'reset role'; exception when others then null; end;
        update public.coaches
        set publication_status = 'private'
        where id = published_attr_coach_id;
        alter table public.coaches enable trigger protect_coach_lifecycle_fields;
        raise;
    end;

    update public.coaches
    set publication_status = 'private'
    where id = published_attr_coach_id;
    alter table public.coaches enable trigger protect_coach_lifecycle_fields;

    begin
      execute 'set local role anon';
      execute 'select count(*) from public.coach_attributes where coach_id = $1'
        into anon_hidden_count
        using private_attr_coach_id;
      execute 'reset role';

      if anon_hidden_count <> 0 then
        raise exception
          'Sprint 6A verification failed: anon read private coach child rows';
      end if;
    exception
      when others then
        begin execute 'reset role'; exception when others then null; end;
        raise;
    end;
  end if;

  if private_img_venue_id is not null then
    alter table public.venues disable trigger protect_venue_lifecycle_fields;
    update public.venues
    set publication_status = 'published'
    where id = private_img_venue_id;
    published_img_venue_id := private_img_venue_id;

    begin
      execute 'set local role anon';
      execute 'select count(*) from public.venue_images where venue_id = $1'
        into anon_visible_count
        using published_img_venue_id;
      execute 'reset role';

      if anon_visible_count < 1 then
        raise exception
          'Sprint 6A verification failed: anon could not read published venue child rows';
      end if;
    exception
      when others then
        begin execute 'reset role'; exception when others then null; end;
        update public.venues
        set publication_status = 'private'
        where id = published_img_venue_id;
        alter table public.venues enable trigger protect_venue_lifecycle_fields;
        raise;
    end;

    update public.venues
    set publication_status = 'private'
    where id = published_img_venue_id;
    alter table public.venues enable trigger protect_venue_lifecycle_fields;

    begin
      execute 'set local role anon';
      execute 'select count(*) from public.venue_images where venue_id = $1'
        into anon_hidden_count
        using private_img_venue_id;
      execute 'reset role';

      if anon_hidden_count <> 0 then
        raise exception
          'Sprint 6A verification failed: anon read private venue child rows';
      end if;
    exception
      when others then
        begin execute 'reset role'; exception when others then null; end;
        raise;
    end;
  end if;

  -- Historical claim fixtures
  select cpa.id, cpa.user_id, cpa.status
    into claim_app_id, claim_user_id, claim_status
  from public.coach_profile_applications cpa
  where cpa.application_mode = 'claim_existing'
    and cpa.status in ('draft', 'submitted', 'under_review', 'changes_requested')
  limit 1;

  select cal.id, cal.city
    into claim_loc_id, claim_loc_city
  from public.coach_application_locations cal
  where cal.application_id = claim_app_id
  limit 1;

  if claim_app_id is not null then
    -- (4) Historical claim editing fails
    begin
      update public.coach_profile_applications
      set full_name = coalesce(full_name, '') || ' (locked-edit)'
      where id = claim_app_id;
      raise exception 'Sprint 6A verification failed: claim field edit was allowed';
    exception
      when insufficient_privilege then null;
      when others then
        if sqlstate = '42501' then null;
        else raise;
        end if;
    end;

    -- (4) Historical claim submission fails
    begin
      update public.coach_profile_applications
      set status = 'submitted'
      where id = claim_app_id
        and status = 'draft';
      if found then
        raise exception 'Sprint 6A verification failed: claim submission was allowed';
      end if;
    exception
      when insufficient_privilege then null;
      when others then
        if sqlstate in ('42501', '23514') then null;
        else raise;
        end if;
    end;

    -- (5) Historical claim withdrawal succeeds (then rolled back)
    begin
      update public.coach_profile_applications
      set status = 'withdrawn'
      where id = claim_app_id;

      if not exists (
        select 1 from public.coach_profile_applications
        where id = claim_app_id and status = 'withdrawn'
      ) then
        raise exception 'Sprint 6A verification failed: claim withdrawal did not apply';
      end if;

      raise exception 'SPRINT6A_WITHDRAW_ROLLBACK';
    exception
      when raise_exception then
        if sqlerrm = 'SPRINT6A_WITHDRAW_ROLLBACK' then null;
        else raise;
        end if;
      when others then
        raise;
    end;

    if not exists (
      select 1 from public.coach_profile_applications
      where id = claim_app_id and status = claim_status
    ) then
      raise exception
        'Sprint 6A verification failed: claim withdrawal fixture was not rolled back';
    end if;
  end if;

  -- (6) Historical claim location editing fails (RLS as applicant)
  if claim_loc_id is not null and claim_user_id is not null then
    begin
      loc_update_count := 0;
      perform set_config(
        'request.jwt.claims',
        json_build_object('sub', claim_user_id::text, 'role', 'authenticated')::text,
        true
      );
      perform set_config('request.jwt.claim.sub', claim_user_id::text, true);
      execute 'set local role authenticated';

      execute
        'update public.coach_application_locations set city = $1 where id = $2'
        using claim_loc_city || '-locked', claim_loc_id;
      get diagnostics loc_update_count = row_count;

      execute 'reset role';
      perform set_config('request.jwt.claims', '', true);
      perform set_config('request.jwt.claim.sub', '', true);

      if loc_update_count <> 0 then
        raise exception
          'Sprint 6A verification failed: claim location edit was allowed';
      end if;
    exception
      when others then
        begin execute 'reset role'; exception when others then null; end;
        perform set_config('request.jwt.claims', '', true);
        perform set_config('request.jwt.claim.sub', '', true);
        if sqlstate = '42501' then null;
        else raise;
        end if;
    end;
  end if;

  -- (7) Cross-user coach_application_id linking fails
  select cpa.user_id into venue_app_user_id
  from public.coach_profile_applications cpa
  limit 1;

  select cpa.id into other_coach_app_id
  from public.coach_profile_applications cpa
  where venue_app_user_id is not null
    and cpa.user_id is distinct from venue_app_user_id
  limit 1;

  -- Prefer two distinct users; otherwise use claim user + any other coach app
  if other_coach_app_id is null then
    select cpa.id, claim_user_id
      into other_coach_app_id, venue_app_user_id
    from public.coach_profile_applications cpa
    where claim_user_id is not null
      and cpa.user_id is distinct from claim_user_id
    limit 1;
  end if;

  if venue_app_user_id is not null and other_coach_app_id is not null then
    begin
      insert into public.venue_profile_applications (
        user_id,
        status,
        current_step,
        applicant_email,
        application_mode,
        target_venue_id
      )
      values (
        venue_app_user_id,
        'draft',
        1,
        'sprint6a-verify+cross-link@example.com',
        'create_new',
        null
      )
      returning id into venue_app_id;

      begin
        update public.venue_profile_applications
        set coach_application_id = other_coach_app_id
        where id = venue_app_id;
        raise exception
          'Sprint 6A verification failed: cross-user coach_application_id link was allowed';
      exception
        when insufficient_privilege then null;
        when others then
          if sqlstate in ('42501', '23514') then null;
          else raise;
          end if;
      end;

      delete from public.venue_profile_applications where id = venue_app_id;
    exception
      when others then
        if venue_app_id is not null then
          delete from public.venue_profile_applications where id = venue_app_id;
        end if;
        raise;
    end;
  end if;

  -- (8)+(9) Booking create vs accept separation + policies remain
  booking_fn := pg_get_functiondef(
    'private.prepare_coach_booking_request()'::regprocedure
  );

  if booking_fn not ilike '%Booking requests require a published coach and venue%' then
    raise exception
      'Sprint 6A verification failed: booking insert missing publication requirement';
  end if;

  if booking_fn not ilike '%is_valid_availability_slot%' then
    raise exception
      'Sprint 6A verification failed: booking workflow missing slot validator';
  end if;

  if booking_fn ilike '%is_valid_public_availability_slot%' then
    raise exception
      'Sprint 6A verification failed: prepare_coach_booking_request still uses is_valid_public_availability_slot';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'coach_booking_requests'
      and policyname = 'Requesters and coach members can view booking requests'
  ) and exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'coach_booking_requests'
      and policyname = 'Requesters and coach members can update booking workflow'
  ) and exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'coach_booking_requests'
      and policyname = 'Requesters can create booking requests'
      and with_check ilike '%availability_is_publicly_readable%'
  )
  into booking_policy_ok;

  if not booking_policy_ok then
    raise exception
      'Sprint 6A verification failed: booking access/create policies missing expected checks';
  end if;

  if to_regprocedure(
    'private.is_valid_availability_slot(uuid, timestamptz, timestamptz)'
  ) is null then
    raise exception
      'Sprint 6A verification failed: is_valid_availability_slot missing';
  end if;

  -- Final zero-publish assertion
  select count(*) into published_coaches
  from public.coaches where publication_status = 'published';
  select count(*) into published_venues
  from public.venues where publication_status = 'published';

  if published_coaches <> 0 or published_venues <> 0 then
    raise exception
      'Sprint 6A verification failed after tests: published coaches/venues = % / %',
      published_coaches, published_venues;
  end if;

  raise notice
    'Sprint 6A verification passed (published=% / %, claim_app=%, venue_app=%)',
    published_coaches, published_venues, claim_app_id, venue_app_id;
end $$;
