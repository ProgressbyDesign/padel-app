-- Disposable harness for Sprint 6A SQL tests.
-- Intended to run inside: BEGIN; /* this file */ ROLLBACK;
-- Installs only the objects required by sprint6a_publication_security.sql
-- against a DB that does not yet have Sprint 6A applied.

alter table public.coaches
  add column if not exists publication_status text not null default 'private';
alter table public.venues
  add column if not exists publication_status text not null default 'private';

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
