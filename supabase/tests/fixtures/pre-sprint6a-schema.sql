


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."current_admin_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select membership.role
  from public.admin_memberships membership
  where membership.user_id = (select auth.uid())
    and membership.status = 'active';
$$;


ALTER FUNCTION "private"."current_admin_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."finalize_approved_coach_application"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  role_label text;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    role_label := case new.coaching_role
      when 'padel_coach' then 'Padel coach'
      when 'head_coach' then 'Head coach'
      when 'performance_coach' then 'Performance coach'
      when 'junior_development_coach' then 'Junior development coach'
      when 'former_professional_player_and_coach' then 'Former professional player and coach'
      when 'other' then btrim(new.coaching_role_other)
      else null
    end;

    insert into public.coach_memberships (coach_id, user_id, membership_role)
    values (new.coach_id, new.user_id, 'owner')
    on conflict (coach_id, user_id)
    do update set membership_role = excluded.membership_role;

    update public.coaches
    set name = btrim(new.full_name),
        role = role_label,
        description = nullif(btrim(new.description), ''),
        experience_years = new.experience_years,
        phone = btrim(new.phone),
        is_approved = true,
        data_quality_status = 'reviewed',
        reviewed_at = coalesce(new.reviewed_at, now()),
        reviewed_by = coalesce(new.reviewed_by_user_id::text, reviewed_by)
    where id = new.coach_id;

    insert into public.coach_attributes (
      coach_id,
      audience_adults,
      audience_juniors,
      player_levels
    )
    values (
      new.coach_id,
      'adults' = any(new.audiences),
      'juniors' = any(new.audiences),
      new.player_levels
    )
    on conflict (coach_id)
    do update set
      audience_adults = excluded.audience_adults,
      audience_juniors = excluded.audience_juniors,
      player_levels = excluded.player_levels;

    delete from public.coach_outcomes
    where coach_id = new.coach_id
      and outcome_key is not null;

    insert into public.coach_outcomes (coach_id, outcome_key, outcome)
    select new.coach_id,
           outcome_key,
           case outcome_key
             when 'learn_fundamentals' then 'Learn padel fundamentals'
             when 'improve_technique' then 'Improve technique'
             when 'improve_match_tactics' then 'Improve match tactics'
             when 'prepare_for_competition' then 'Prepare for competition'
             when 'build_confidence' then 'Build confidence'
             when 'improve_fitness_movement' then 'Improve fitness and movement'
             when 'junior_development' then 'Junior player development'
             when 'high_performance_development' then 'High-performance development'
           end
    from unnest(new.outcomes) as outcome_key;

    delete from public.coach_locations
    where coach_id = new.coach_id;

    insert into public.coach_locations (coach_id, country, city, is_primary)
    select new.coach_id,
           location.country,
           btrim(location.city),
           location.is_primary
    from public.coach_application_locations location
    where location.application_id = new.id;

    update public.profiles
    set last_workspace_type = 'coach',
        last_workspace_entity_id = new.coach_id,
        updated_at = now()
    where id = new.user_id
      and last_workspace_type is null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."finalize_approved_coach_application"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."finalize_approved_venue_application"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.venue_memberships (venue_id, user_id, membership_role)
    values (new.approved_venue_id, new.user_id, new.approved_membership_role)
    on conflict (venue_id, user_id)
    do update set membership_role = excluded.membership_role;

    update public.venues
    set name = coalesce(nullif(btrim(name), ''), btrim(new.proposed_venue_name)),
        city = coalesce(nullif(btrim(city), ''), btrim(new.proposed_city)),
        country = coalesce(nullif(btrim(country), ''), new.proposed_country),
        address = coalesce(nullif(btrim(address), ''), btrim(new.proposed_address)),
        website = coalesce(nullif(btrim(website), ''), btrim(new.proposed_website)),
        source = case
          when new.application_mode = 'create_new' then 'partner'
          else source
        end,
        is_approved = true,
        data_quality_status = 'reviewed',
        reviewed_at = coalesce(new.reviewed_at, now()),
        reviewed_by = coalesce(new.reviewed_by_user_id::text, reviewed_by)
    where id = new.approved_venue_id;

    update public.profiles
    set last_workspace_type = 'venue',
        last_workspace_entity_id = new.approved_venue_id,
        updated_at = now()
    where id = new.user_id
      and last_workspace_type is null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."finalize_approved_venue_application"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (
    id,
    full_name,
    role
  )
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    'user'
  );

  return new;
end;
$$;


ALTER FUNCTION "private"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."has_admin_permission"("permission_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case private.current_admin_role()
    when 'owner' then true
    when 'operations' then permission_name = any(array[
      'admin.access',
      'applications.read',
      'applications.review',
      'relationships.read',
      'relationships.manage',
      'bookings.read',
      'bookings.manage',
      'profiles.read',
      'profiles.manage',
      'deletions.read',
      'deletions.manage'
    ])
    when 'reviewer' then permission_name = any(array[
      'admin.access',
      'applications.read',
      'applications.review',
      'relationships.read',
      'profiles.read'
    ])
    when 'support' then permission_name = any(array[
      'admin.access',
      'applications.read',
      'relationships.read',
      'bookings.read',
      'profiles.read',
      'deletions.read'
    ])
    else false
  end;
$$;


ALTER FUNCTION "private"."has_admin_permission"("permission_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(private.current_admin_role() in ('owner', 'operations'), false);
$$;


ALTER FUNCTION "private"."is_current_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_valid_public_availability_slot"("target_coach_venue_id" "uuid", "target_starts_at" timestamp with time zone, "target_ends_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with settings as (
    select
      availability.timezone,
      relationship.status as relationship_status
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
$$;


ALTER FUNCTION "private"."is_valid_public_availability_slot"("target_coach_venue_id" "uuid", "target_starts_at" timestamp with time zone, "target_ends_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_account_deletion_request"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  caller_is_admin boolean := private.is_current_user_admin();
  caller_email text := lower(nullif(btrim((select auth.jwt() ->> 'email')), ''));
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.user_id <> caller_id then
      raise exception 'The deletion request owner cannot be changed.' using errcode = '42501';
    end if;

    if caller_email is null then
      raise exception 'A valid account email is required.' using errcode = '23514';
    end if;

    new.requester_email := caller_email;
    new.status := 'requested';
    new.requested_at := now();
    new.cancelled_at := null;
    new.processed_at := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.requester_email is distinct from old.requester_email
     or new.reason is distinct from old.reason
     or new.requested_at is distinct from old.requested_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Deletion request details cannot be changed.' using errcode = '42501';
  end if;

  if caller_is_admin then
    case old.status
      when 'requested' then
        if new.status not in ('requested', 'processing', 'declined', 'cancelled', 'completed') then
          raise exception 'Invalid deletion request transition.' using errcode = '23514';
        end if;
      when 'processing' then
        if new.status not in ('processing', 'completed', 'declined', 'cancelled') then
          raise exception 'Invalid deletion request transition.' using errcode = '23514';
        end if;
      when 'completed', 'declined', 'cancelled' then
        if new.status <> old.status then
          raise exception 'Historical deletion requests cannot be changed.' using errcode = '23514';
        end if;
      else
        raise exception 'Unknown deletion request status.' using errcode = '23514';
    end case;
  else
    if caller_id <> old.user_id then
      raise exception 'This deletion request does not belong to you.' using errcode = '42501';
    end if;

    if old.status <> 'requested' or new.status <> 'cancelled' then
      raise exception 'Only a pending deletion request may be cancelled.' using errcode = '23514';
    end if;
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at := now();
    new.processed_at := null;
  elsif new.status in ('completed', 'declined') and old.status is distinct from new.status then
    new.processed_at := now();
    new.cancelled_at := null;
  elsif new.status = 'processing' then
    new.cancelled_at := null;
    new.processed_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "private"."prepare_account_deletion_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_admin_audit_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  caller_role text := private.current_admin_role();
begin
  if caller_id is null or caller_role is null then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  new.actor_user_id := caller_id;
  new.actor_role := caller_role;
  new.action := btrim(new.action);
  new.target_type := btrim(new.target_type);
  new.created_at := now();
  return new;
end;
$$;


ALTER FUNCTION "private"."prepare_admin_audit_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_application_notification_email"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  caller_email text := lower(nullif(btrim((select auth.jwt() ->> 'email')), ''));
begin
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
$$;


ALTER FUNCTION "private"."prepare_application_notification_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_coach_availability_exception"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare relationship_status text;
begin
  if tg_op='UPDATE' and new.coach_venue_id is distinct from old.coach_venue_id then
    raise exception 'The coach venue relationship cannot be changed.' using errcode='42501';
  end if;
  select status into relationship_status from public.coach_venues where id=new.coach_venue_id;
  if relationship_status is null then raise exception 'Coach venue relationship not found.' using errcode='23503'; end if;
  if relationship_status<>'active' then raise exception 'Availability can only be configured for an active coach venue relationship.' using errcode='23514'; end if;
  if new.exception_type='unavailable' then new.price_override_minor:=null; end if;
  new.updated_at:=now();
  return new;
end; $$;


ALTER FUNCTION "private"."prepare_coach_availability_exception"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_coach_availability_rule"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  relationship_coach_id uuid;
  relationship_status text;
begin
  if tg_op = 'UPDATE'
     and new.coach_venue_id is distinct from old.coach_venue_id then
    raise exception 'The coach venue relationship cannot be changed.'
      using errcode = '42501';
  end if;

  select relationship.coach_id, relationship.status
  into relationship_coach_id, relationship_status
  from public.coach_venues relationship
  where relationship.id = new.coach_venue_id;

  if relationship_coach_id is null then
    raise exception 'Coach venue relationship not found.'
      using errcode = '23503';
  end if;

  if relationship_status <> 'active' then
    raise exception 'Availability can only be configured for an active coach venue relationship.'
      using errcode = '23514';
  end if;

  if new.is_active and exists (
    select 1
    from public.coach_availability_rules existing_rule
    join public.coach_venues existing_relationship
      on existing_relationship.id = existing_rule.coach_venue_id
    where existing_rule.id <> new.id
      and existing_rule.is_active is true
      and existing_relationship.coach_id = relationship_coach_id
      and existing_rule.day_of_week = new.day_of_week
      and daterange(
            existing_rule.valid_from,
            coalesce(existing_rule.valid_until, 'infinity'::date),
            '[]'
          )
          && daterange(
            new.valid_from,
            coalesce(new.valid_until, 'infinity'::date),
            '[]'
          )
      and existing_rule.start_time < new.end_time
      and existing_rule.end_time > new.start_time
  ) then
    raise exception 'This availability overlaps another active schedule for the coach.'
      using errcode = '23P01';
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "private"."prepare_coach_availability_rule"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_coach_booking_request"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid:=(select auth.uid());
  relationship_record public.coach_venues%rowtype;
  settings_record public.coach_venue_availability_settings%rowtype;
  resolved_price record;
  caller_is_coach_member boolean:=false;
  caller_is_admin boolean:=false;
  status_changed boolean:=false;
begin
  if caller_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  caller_is_admin:=private.is_current_user_admin();
  if tg_op='INSERT' then
    select * into relationship_record from public.coach_venues where id=new.coach_venue_id;
    if relationship_record.id is null or relationship_record.status<>'active' then
      raise exception 'Booking requests require an active coach venue relationship.' using errcode='23514';
    end if;
    select * into settings_record from public.coach_venue_availability_settings where coach_venue_id=new.coach_venue_id;
    if settings_record.coach_venue_id is null or settings_record.is_public is not true then
      raise exception 'This coach is not accepting public booking requests at this venue.' using errcode='23514';
    end if;
    if new.requester_user_id<>caller_id then raise exception 'The requester cannot be changed.' using errcode='42501'; end if;
    if not private.is_valid_public_availability_slot(new.coach_venue_id,new.starts_at,new.ends_at) then
      raise exception 'The selected time is no longer available.' using errcode='23514';
    end if;
    select * into resolved_price from private.resolve_public_slot_price(new.coach_venue_id,new.starts_at,new.ends_at);
    new.coach_id:=relationship_record.coach_id;
    new.venue_id:=relationship_record.venue_id;
    new.timezone:=settings_record.timezone;
    new.status:='requested';
    new.price_amount_minor:=resolved_price.price_amount_minor;
    new.currency:=resolved_price.currency;
    new.pricing_source:=resolved_price.pricing_source;
    new.responded_at:=null; new.responded_by_user_id:=null;
    new.cancelled_at:=null; new.cancelled_by_user_id:=null; new.completed_at:=null;
    new.updated_at:=now();
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
    raise exception 'Booking request details cannot be changed after submission.' using errcode='42501';
  end if;
  select exists(select 1 from public.coach_memberships where coach_id=old.coach_id and user_id=caller_id) into caller_is_coach_member;
  status_changed:=new.status is distinct from old.status;
  if not status_changed then new.updated_at:=now(); return new; end if;
  case old.status
    when 'requested' then
      if new.status in ('accepted','declined') then
        if not caller_is_coach_member and not caller_is_admin then raise exception 'Only the coach may respond to this booking request.' using errcode='42501'; end if;
        if new.status='accepted' and not private.is_valid_public_availability_slot(old.coach_venue_id,old.starts_at,old.ends_at) then
          raise exception 'The selected time is no longer available.' using errcode='23514';
        end if;
        new.responded_at:=now(); new.responded_by_user_id:=caller_id;
        new.cancelled_at:=null; new.cancelled_by_user_id:=null; new.completed_at:=null;
      elsif new.status='cancelled' then
        if caller_id<>old.requester_user_id and not caller_is_coach_member and not caller_is_admin then raise exception 'Only the requester or coach may cancel this request.' using errcode='42501'; end if;
        new.cancelled_at:=now(); new.cancelled_by_user_id:=caller_id;
        new.responded_at:=null; new.responded_by_user_id:=null; new.completed_at:=null;
      else raise exception 'Invalid transition from requested.' using errcode='23514';
      end if;
    when 'accepted' then
      if new.status='cancelled' then
        if caller_id<>old.requester_user_id and not caller_is_coach_member and not caller_is_admin then raise exception 'Only the requester or coach may cancel this session.' using errcode='42501'; end if;
        new.cancelled_at:=now(); new.cancelled_by_user_id:=caller_id; new.completed_at:=null;
      elsif new.status='completed' then
        if not caller_is_coach_member and not caller_is_admin then raise exception 'Only the coach may mark the session complete.' using errcode='42501'; end if;
        if old.ends_at>now() then raise exception 'A future session cannot be marked complete.' using errcode='23514'; end if;
        new.completed_at:=now(); new.cancelled_at:=null; new.cancelled_by_user_id:=null;
      else raise exception 'Invalid transition from accepted.' using errcode='23514';
      end if;
    when 'declined','cancelled','completed' then raise exception 'Historical booking requests cannot be changed.' using errcode='23514';
    else raise exception 'Unknown booking status.' using errcode='23514';
  end case;
  new.updated_at:=now();
  return new;
end; $$;


ALTER FUNCTION "private"."prepare_coach_booking_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_coach_profile_application_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  caller_is_admin boolean := private.is_current_user_admin();
  has_location boolean;
  target_is_claimed boolean;
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Application ownership cannot be changed.' using errcode = '42501';
  end if;

  if caller_id is not null and caller_id = old.user_id and not caller_is_admin then
    if old.status = 'draft' and new.status not in ('draft', 'submitted', 'withdrawn') then
      raise exception 'Invalid application status transition.' using errcode = '23514';
    elsif old.status = 'submitted' and new.status not in ('submitted', 'withdrawn') then
      raise exception 'Invalid application status transition.' using errcode = '23514';
    elsif old.status = 'under_review' and new.status not in ('under_review', 'withdrawn') then
      raise exception 'Invalid application status transition.' using errcode = '23514';
    elsif old.status = 'changes_requested' and new.status not in ('changes_requested', 'submitted', 'withdrawn') then
      raise exception 'Invalid application status transition.' using errcode = '23514';
    elsif old.status in ('approved', 'declined', 'withdrawn') and new.status <> old.status then
      raise exception 'This application can no longer be changed.' using errcode = '23514';
    end if;

    if new.application_mode is distinct from old.application_mode
       or new.target_coach_id is distinct from old.target_coach_id then
      raise exception 'The selected application type and coach profile cannot be changed.' using errcode = '42501';
    end if;

    if new.coach_id is distinct from old.coach_id
       or new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by_user_id is distinct from old.reviewed_by_user_id
       or new.review_note is distinct from old.review_note then
      raise exception 'Review fields cannot be changed by the applicant.' using errcode = '42501';
    end if;
  end if;

  if new.status = 'submitted' and old.status <> 'submitted' then
    if new.full_name is null
      or new.phone is null
      or new.coaching_role is null
      or new.experience_years is null
      or cardinality(new.player_levels) = 0
      or cardinality(new.audiences) = 0
      or cardinality(new.outcomes) = 0
      or new.terms_accepted_at is null
      or new.privacy_accepted_at is null then
      raise exception 'Complete all required application fields before submitting.' using errcode = '23514';
    end if;

    select exists (
      select 1
      from public.coach_application_locations location
      where location.application_id = new.id
    ) into has_location;

    if not has_location then
      raise exception 'Add at least one coaching location before submitting.' using errcode = '23514';
    end if;

    if new.application_mode = 'claim_existing' then
      select coach.is_claimed
      into target_is_claimed
      from public.coaches coach
      where coach.id = new.target_coach_id;

      if target_is_claimed is null then
        raise exception 'The selected coach profile is no longer available.' using errcode = '23514';
      end if;

      if target_is_claimed then
        raise exception 'The selected coach profile has already been claimed.' using errcode = '23514';
      end if;
    end if;

    new.submitted_at := now();
    new.current_step := 4;
  end if;

  if caller_is_admin and new.status is distinct from old.status
     and new.status in ('under_review','changes_requested','approved','declined') then
    new.reviewed_at := now();
    new.reviewed_by_user_id := caller_id;
  end if;

  if new.status = 'approved' then
    if not caller_is_admin then
      raise exception 'Only an administrator can approve an application.' using errcode = '42501';
    end if;

    if new.application_mode = 'claim_existing' then
      if new.target_coach_id is null then
        raise exception 'Select the coach profile being claimed.' using errcode = '23514';
      end if;

      if exists (
        select 1
        from public.coach_memberships membership
        where membership.coach_id = new.target_coach_id
      ) then
        raise exception 'This coach profile is already managed.' using errcode = '23514';
      end if;

      new.coach_id := new.target_coach_id;
    elsif new.coach_id is null then
      raise exception 'Assign a coach profile before approval.' using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "private"."prepare_coach_profile_application_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_coach_venue_availability_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare relationship_status text;
begin
  if tg_op='UPDATE' and new.coach_venue_id is distinct from old.coach_venue_id then
    raise exception 'The coach venue relationship cannot be changed.' using errcode='42501';
  end if;
  select status into relationship_status from public.coach_venues where id=new.coach_venue_id;
  if relationship_status is null then raise exception 'Coach venue relationship not found.' using errcode='23503'; end if;
  if relationship_status<>'active' then raise exception 'Availability can only be configured for an active coach venue relationship.' using errcode='23514'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then
    raise exception 'Invalid IANA timezone.' using errcode='23514';
  end if;
  if (new.currency is null) is distinct from (new.default_hourly_rate_minor is null) then
    raise exception 'Currency and default hourly rate must be provided together.' using errcode='23514';
  end if;
  if new.currency is not null then new.currency:=upper(btrim(new.currency)); end if;
  new.updated_at:=now();
  return new;
end; $$;


ALTER FUNCTION "private"."prepare_coach_venue_availability_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_venue_profile_application_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  caller_is_admin boolean := private.is_current_user_admin();
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Application ownership cannot be changed.' using errcode = '42501';
  end if;

  if caller_id is not null and caller_id = old.user_id and not caller_is_admin then
    if old.status = 'draft' and new.status not in ('draft','submitted','withdrawn') then
      raise exception 'Invalid application status transition.' using errcode = '23514';
    elsif old.status = 'submitted' and new.status not in ('submitted','withdrawn') then
      raise exception 'Invalid application status transition.' using errcode = '23514';
    elsif old.status = 'under_review' and new.status not in ('under_review','withdrawn') then
      raise exception 'Invalid application status transition.' using errcode = '23514';
    elsif old.status = 'changes_requested' and new.status not in ('changes_requested','submitted','withdrawn') then
      raise exception 'Invalid application status transition.' using errcode = '23514';
    elsif old.status in ('approved','declined','withdrawn') and new.status <> old.status then
      raise exception 'This application can no longer be changed.' using errcode = '23514';
    end if;

    if new.approved_venue_id is distinct from old.approved_venue_id
       or new.approved_membership_role is distinct from old.approved_membership_role
       or new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by_user_id is distinct from old.reviewed_by_user_id
       or new.review_note is distinct from old.review_note then
      raise exception 'Review fields cannot be changed by the applicant.' using errcode = '42501';
    end if;
  end if;

  if new.status = 'submitted' and old.status <> 'submitted' then
    if new.application_mode is null
      or new.relationship_to_venue is null
      or new.phone is null
      or new.terms_accepted_at is null
      or new.privacy_accepted_at is null then
      raise exception 'Complete all required application fields before submitting.' using errcode = '23514';
    end if;

    if new.application_mode = 'claim_existing' and new.target_venue_id is null then
      raise exception 'Select a venue to claim before submitting.' using errcode = '23514';
    end if;

    if new.application_mode = 'create_new'
      and (new.proposed_venue_name is null or new.proposed_country is null or new.proposed_city is null) then
      raise exception 'Complete the proposed venue details before submitting.' using errcode = '23514';
    end if;

    new.submitted_at := now();
    new.current_step := 4;
  end if;

  if caller_is_admin and new.status is distinct from old.status
     and new.status in ('under_review','changes_requested','approved','declined') then
    new.reviewed_at := now();
    new.reviewed_by_user_id := caller_id;
  end if;

  if new.status = 'approved' then
    if not caller_is_admin then
      raise exception 'Only an administrator can approve an application.' using errcode = '42501';
    end if;
    if new.approved_venue_id is null or new.approved_membership_role is null then
      raise exception 'Approved venue and membership role are required.' using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "private"."prepare_venue_profile_application_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."resolve_public_slot_price"("target_coach_venue_id" "uuid", "target_starts_at" timestamp with time zone, "target_ends_at" timestamp with time zone) RETURNS TABLE("price_amount_minor" integer, "currency" "text", "pricing_source" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
with settings as (
  select a.timezone,a.currency,a.default_hourly_rate_minor
  from public.coach_venue_availability_settings a
  join public.coach_venues r on r.id=a.coach_venue_id
  where a.coach_venue_id=target_coach_venue_id and a.is_public and r.status='active'
), local_slot as (
  select s.*,target_starts_at at time zone s.timezone as local_start,target_ends_at at time zone s.timezone as local_end
  from settings s
), extra_match as (
  select e.price_override_minor
  from public.coach_availability_exceptions e
  where e.coach_venue_id=target_coach_venue_id and e.exception_type='available'
    and target_starts_at>=e.starts_at and target_ends_at<=e.ends_at
    and target_ends_at-target_starts_at=make_interval(mins=>e.slot_duration_minutes)
    and mod(extract(epoch from (target_starts_at-e.starts_at))::bigint,(e.slot_duration_minutes*60)::bigint)=0
  order by e.starts_at desc,e.created_at desc limit 1
), recurring_match as (
  select r.price_override_minor
  from local_slot s
  join public.coach_availability_rules r on r.coach_venue_id=target_coach_venue_id
  where r.is_active
    and r.day_of_week=extract(isodow from s.local_start)::smallint
    and s.local_start::date>=r.valid_from
    and (r.valid_until is null or s.local_start::date<=r.valid_until)
    and s.local_start::date=s.local_end::date
    and s.local_start::time>=r.start_time and s.local_end::time<=r.end_time
    and target_ends_at-target_starts_at=make_interval(mins=>r.slot_duration_minutes)
    and mod(extract(epoch from (s.local_start::time-r.start_time))::bigint,(r.slot_duration_minutes*60)::bigint)=0
  order by r.valid_from desc,r.created_at desc limit 1
)
select
  case
    when e.price_override_minor is not null then e.price_override_minor
    when r.price_override_minor is not null then r.price_override_minor
    when s.default_hourly_rate_minor is not null then round(s.default_hourly_rate_minor*(extract(epoch from (target_ends_at-target_starts_at))/3600.0))::integer
    else null
  end,
  case when s.default_hourly_rate_minor is not null then s.currency else null end,
  case
    when e.price_override_minor is not null then 'exception_override'
    when r.price_override_minor is not null then 'rule_override'
    when s.default_hourly_rate_minor is not null then 'default_hourly_rate'
    else null
  end
from local_slot s
left join extra_match e on true
left join recurring_match r on true
where private.is_valid_public_availability_slot(target_coach_venue_id,target_starts_at,target_ends_at);
$$;


ALTER FUNCTION "private"."resolve_public_slot_price"("target_coach_venue_id" "uuid", "target_starts_at" timestamp with time zone, "target_ends_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."set_profile_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "private"."set_profile_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."sync_coach_claimed_state"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'DELETE' or old.coach_id is distinct from new.coach_id then
    update public.coaches coach
    set is_claimed = exists (
      select 1
      from public.coach_memberships membership
      where membership.coach_id = old.coach_id
    )
    where coach.id = old.coach_id;
  end if;

  if tg_op <> 'DELETE' then
    update public.coaches coach
    set is_claimed = true
    where coach.id = new.coach_id;
  end if;

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "private"."sync_coach_claimed_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."sync_venue_booking_block"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'DELETE' then
    delete from public.venue_booking_blocks
    where booking_request_id = old.id;
    return old;
  end if;

  insert into public.venue_booking_blocks (
    booking_request_id,
    coach_venue_id,
    coach_id,
    venue_id,
    status,
    starts_at,
    ends_at,
    timezone,
    price_amount_minor,
    currency,
    requested_at,
    responded_at,
    cancelled_at,
    completed_at,
    updated_at
  )
  values (
    new.id,
    new.coach_venue_id,
    new.coach_id,
    new.venue_id,
    new.status,
    new.starts_at,
    new.ends_at,
    new.timezone,
    new.price_amount_minor,
    new.currency,
    new.created_at,
    new.responded_at,
    new.cancelled_at,
    new.completed_at,
    new.updated_at
  )
  on conflict (booking_request_id)
  do update set
    coach_venue_id = excluded.coach_venue_id,
    coach_id = excluded.coach_id,
    venue_id = excluded.venue_id,
    status = excluded.status,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    timezone = excluded.timezone,
    price_amount_minor = excluded.price_amount_minor,
    currency = excluded.currency,
    requested_at = excluded.requested_at,
    responded_at = excluded.responded_at,
    cancelled_at = excluded.cancelled_at,
    completed_at = excluded.completed_at,
    updated_at = excluded.updated_at;

  return new;
end;
$$;


ALTER FUNCTION "private"."sync_venue_booking_block"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."validate_admin_invitation_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  caller_email text := lower(nullif(btrim((select auth.jwt() ->> 'email')), ''));
  caller_is_owner boolean := private.has_admin_permission('team.manage');
  token_rotated boolean := false;
  expiry_changed boolean := false;
  delivery_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    if caller_id is null or not caller_is_owner then
      raise exception 'Only an owner can create admin invitations.' using errcode = '42501';
    end if;

    new.email := lower(btrim(new.email));
    new.invited_by_user_id := caller_id;
    new.status := 'pending';
    new.accepted_by_user_id := null;
    new.accepted_at := null;
    new.cancelled_at := null;
    new.last_email_status := 'pending';
    new.last_send_attempt_at := null;
    new.last_sent_at := null;
    new.send_count := 0;
    new.last_email_provider_id := null;
    new.last_email_error_code := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.invited_by_user_id is distinct from old.invited_by_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Admin invitation identity fields cannot be changed.' using errcode = '42501';
  end if;

  token_rotated := new.token_digest is distinct from old.token_digest;
  expiry_changed := new.expires_at is distinct from old.expires_at;
  delivery_changed :=
    new.last_email_status is distinct from old.last_email_status
    or new.last_send_attempt_at is distinct from old.last_send_attempt_at
    or new.last_sent_at is distinct from old.last_sent_at
    or new.send_count is distinct from old.send_count
    or new.last_email_provider_id is distinct from old.last_email_provider_id
    or new.last_email_error_code is distinct from old.last_email_error_code;

  if old.status <> 'pending' then
    if new.status is distinct from old.status
       or token_rotated
       or expiry_changed
       or new.accepted_by_user_id is distinct from old.accepted_by_user_id
       or new.accepted_at is distinct from old.accepted_at
       or new.cancelled_at is distinct from old.cancelled_at
       or delivery_changed then
      raise exception 'Historical admin invitations cannot be changed.' using errcode = '23514';
    end if;

    new.updated_at := now();
    return new;
  end if;

  if caller_is_owner then
    if new.status not in ('pending', 'cancelled', 'expired') then
      raise exception 'Owners may only resend, cancel or expire a pending invitation.' using errcode = '23514';
    end if;

    if new.status = 'pending' then
      if token_rotated is distinct from expiry_changed then
        raise exception 'Resending must rotate the token and expiry together.' using errcode = '23514';
      end if;

      if token_rotated then
        if new.expires_at <= now() then
          raise exception 'The refreshed invitation expiry must be in the future.' using errcode = '23514';
        end if;

        if new.accepted_by_user_id is distinct from old.accepted_by_user_id
           or new.accepted_at is distinct from old.accepted_at
           or new.cancelled_at is distinct from old.cancelled_at then
          raise exception 'Pending invitation workflow fields cannot be changed during resend.' using errcode = '42501';
        end if;

        new.last_email_status := 'pending';
        new.last_send_attempt_at := null;
        new.last_email_provider_id := null;
        new.last_email_error_code := null;
        new.send_count := old.send_count;
        new.last_sent_at := old.last_sent_at;
      elsif delivery_changed then
        if old.last_email_status <> 'pending'
           or new.last_email_status not in ('sent', 'failed') then
          raise exception 'Email delivery status may only complete a pending send attempt.' using errcode = '23514';
        end if;

        new.last_send_attempt_at := coalesce(new.last_send_attempt_at, now());
        new.send_count := old.send_count + 1;

        if new.last_email_status = 'sent' then
          new.last_sent_at := new.last_send_attempt_at;
          new.last_email_error_code := null;
        else
          new.last_sent_at := old.last_sent_at;
          new.last_email_provider_id := null;
        end if;
      end if;
    elsif new.status = 'cancelled' then
      if token_rotated or expiry_changed or delivery_changed then
        raise exception 'Cancelling an invitation cannot rotate or alter its email delivery record.' using errcode = '23514';
      end if;

      new.cancelled_at := now();
      new.accepted_by_user_id := null;
      new.accepted_at := null;
    elsif new.status = 'expired' then
      if token_rotated or expiry_changed or delivery_changed then
        raise exception 'Expiring an invitation cannot rotate or alter its email delivery record.' using errcode = '23514';
      end if;

      new.cancelled_at := null;
      new.accepted_by_user_id := null;
      new.accepted_at := null;
    end if;
  else
    if caller_id is null
       or caller_email <> old.email
       or old.expires_at <= now()
       or new.status <> 'accepted'
       or new.accepted_by_user_id <> caller_id then
      raise exception 'This invitation cannot be accepted by the current account.' using errcode = '42501';
    end if;

    if token_rotated
       or expiry_changed
       or delivery_changed
       or new.cancelled_at is distinct from old.cancelled_at then
      raise exception 'Invitation delivery details cannot be changed during acceptance.' using errcode = '42501';
    end if;

    new.accepted_at := now();
    new.cancelled_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "private"."validate_admin_invitation_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."validate_admin_membership_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  caller_is_owner boolean := private.has_admin_permission('team.manage');
  active_owner_count integer;
  matching_invitation boolean := false;
begin
  if caller_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if caller_is_owner then
      new.updated_at := now();
      return new;
    end if;

    select exists (
      select 1
      from public.admin_invitations invitation
      where invitation.email = lower(nullif(btrim((select auth.jwt() ->> 'email')), ''))
        and invitation.role = new.role
        and invitation.status = 'pending'
        and invitation.expires_at > now()
        and new.user_id = caller_id
        and new.status = 'active'
    ) into matching_invitation;

    if not matching_invitation then
      raise exception 'A valid admin invitation is required.' using errcode = '42501';
    end if;

    new.invited_by_user_id := (
      select invitation.invited_by_user_id
      from public.admin_invitations invitation
      where invitation.email = lower(nullif(btrim((select auth.jwt() ->> 'email')), ''))
        and invitation.role = new.role
        and invitation.status = 'pending'
        and invitation.expires_at > now()
      order by invitation.created_at desc
      limit 1
    );
    new.joined_at := now();
    new.updated_at := now();
    return new;
  end if;

  if not caller_is_owner then
    raise exception 'Only an owner can change admin team membership.' using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id
     or new.invited_by_user_id is distinct from old.invited_by_user_id
     or new.joined_at is distinct from old.joined_at then
    raise exception 'Admin membership identity fields cannot be changed.' using errcode = '42501';
  end if;

  if old.role = 'owner'
     and old.status = 'active'
     and (new.role <> 'owner' or new.status <> 'active') then
    select count(*)
    into active_owner_count
    from public.admin_memberships membership
    where membership.role = 'owner'
      and membership.status = 'active';

    if active_owner_count <= 1 then
      raise exception 'The final active owner cannot be removed or demoted.' using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "private"."validate_admin_membership_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."validate_coach_venue_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  current_user_id uuid := (select auth.uid());
  is_admin boolean := false;
  is_coach_member boolean := false;
  is_venue_member boolean := false;
  status_changed boolean := false;
  primary_changed boolean := false;
begin
  if current_user_id is null then
    return new;
  end if;

  is_admin := private.is_current_user_admin();

  select exists (
    select 1
    from public.coach_memberships membership
    where membership.coach_id = new.coach_id
      and membership.user_id = current_user_id
  ) into is_coach_member;

  select exists (
    select 1
    from public.venue_memberships membership
    where membership.venue_id = new.venue_id
      and membership.user_id = current_user_id
  ) into is_venue_member;

  if tg_op = 'INSERT' then
    if is_admin then
      if new.initiated_by not in ('admin', 'import') then
        raise exception 'Admin-created relationships must use admin or import as the initiator.'
          using errcode = '23514';
      end if;

      if new.status not in ('active', 'unverified') then
        raise exception 'Admin-created relationships must start as active or unverified.'
          using errcode = '23514';
      end if;

      new.requested_by_user_id := current_user_id;
      new.requested_at := now();
      new.ended_at := null;

      if new.status = 'active' then
        new.responded_by_user_id := current_user_id;
        new.responded_at := now();
      else
        new.responded_by_user_id := null;
        new.responded_at := null;
      end if;

      if new.is_primary is true and new.status not in ('active', 'unverified') then
        raise exception 'Only an active or imported relationship can be primary.'
          using errcode = '23514';
      end if;

      return new;
    end if;

    if new.initiated_by = 'coach' then
      if not is_coach_member then
        raise exception 'Only an authorised coach member can request this venue.'
          using errcode = '42501';
      end if;
    elsif new.initiated_by = 'venue' then
      if not is_venue_member then
        raise exception 'Only an authorised venue member can invite this coach.'
          using errcode = '42501';
      end if;
    else
      raise exception 'Authenticated users may only initiate as coach or venue.'
        using errcode = '23514';
    end if;

    new.requested_by_user_id := current_user_id;
    new.requested_at := now();
    new.ended_at := null;
    new.is_primary := false;

    if is_coach_member and is_venue_member then
      new.status := 'active';
      new.responded_by_user_id := current_user_id;
      new.responded_at := now();
    else
      new.status := 'pending';
      new.responded_by_user_id := null;
      new.responded_at := null;
    end if;

    return new;
  end if;

  if new.coach_id is distinct from old.coach_id then
    raise exception 'coach_id cannot be changed.' using errcode = '42501';
  end if;

  if new.venue_id is distinct from old.venue_id then
    raise exception 'venue_id cannot be changed.' using errcode = '42501';
  end if;

  if new.initiated_by is distinct from old.initiated_by then
    raise exception 'initiated_by cannot be changed.' using errcode = '42501';
  end if;

  if new.requested_by_user_id is distinct from old.requested_by_user_id then
    raise exception 'requested_by_user_id cannot be changed.' using errcode = '42501';
  end if;

  if new.requested_at is distinct from old.requested_at then
    raise exception 'requested_at cannot be changed.' using errcode = '42501';
  end if;

  status_changed := new.status is distinct from old.status;
  primary_changed := new.is_primary is distinct from old.is_primary;

  if is_admin then
    if primary_changed and new.is_primary is true
       and new.status not in ('active', 'unverified') then
      raise exception 'Only an active or imported relationship can be primary.'
        using errcode = '23514';
    end if;

    if status_changed then
      case old.status
        when 'unverified' then
          if new.status not in ('active', 'cancelled') then
            raise exception 'An imported relationship may only be verified or removed.'
              using errcode = '23514';
          end if;
        when 'pending' then
          if new.status not in ('active', 'declined', 'cancelled') then
            raise exception 'Invalid admin transition from pending.'
              using errcode = '23514';
          end if;
        when 'active' then
          if new.status <> 'ended' then
            raise exception 'An active relationship may only be ended.'
              using errcode = '23514';
          end if;
        when 'declined', 'cancelled', 'ended' then
          raise exception 'Historical relationship records cannot be changed.'
            using errcode = '23514';
        else
          raise exception 'Unknown relationship status.' using errcode = '23514';
      end case;

      if new.status in ('active', 'declined', 'cancelled') then
        new.responded_by_user_id := current_user_id;
        new.responded_at := now();
        new.ended_at := null;
      elsif new.status = 'ended' then
        new.ended_at := now();
      end if;

      if new.status in ('declined', 'cancelled', 'ended') then
        new.is_primary := false;
      end if;
    end if;

    return new;
  end if;

  if primary_changed then
    if not is_coach_member then
      raise exception 'Only an authorised coach member can change the primary venue.'
        using errcode = '42501';
    end if;

    if new.is_primary is true and new.status not in ('active', 'unverified') then
      raise exception 'Only an active or imported relationship can be primary.'
        using errcode = '23514';
    end if;
  end if;

  if status_changed then
    case old.status
      when 'pending' then
        if old.initiated_by = 'coach' then
          if new.status in ('active', 'declined') then
            if not is_venue_member then
              raise exception 'Only the venue may respond to this coach request.'
                using errcode = '42501';
            end if;

            if current_user_id = old.requested_by_user_id
               and not (
                 new.status = 'active'
                 and is_coach_member
                 and is_venue_member
               ) then
              raise exception 'The requester cannot approve their own request.'
                using errcode = '42501';
            end if;
          elsif new.status = 'cancelled' then
            if current_user_id <> old.requested_by_user_id then
              raise exception 'Only the requester may cancel this request.'
                using errcode = '42501';
            end if;
          else
            raise exception 'Invalid status transition from pending.'
              using errcode = '23514';
          end if;
        elsif old.initiated_by = 'venue' then
          if new.status in ('active', 'declined') then
            if not is_coach_member then
              raise exception 'Only the coach may respond to this venue invitation.'
                using errcode = '42501';
            end if;

            if current_user_id = old.requested_by_user_id
               and not (
                 new.status = 'active'
                 and is_coach_member
                 and is_venue_member
               ) then
              raise exception 'The requester cannot approve their own invitation.'
                using errcode = '42501';
            end if;
          elsif new.status = 'cancelled' then
            if current_user_id <> old.requested_by_user_id then
              raise exception 'Only the requester may cancel this invitation.'
                using errcode = '42501';
            end if;
          else
            raise exception 'Invalid status transition from pending.'
              using errcode = '23514';
          end if;
        else
          raise exception 'This pending relationship has an invalid initiator.'
            using errcode = '23514';
        end if;
      when 'active' then
        if new.status <> 'ended' then
          raise exception 'An active relationship may only be ended.'
            using errcode = '23514';
        end if;

        if not is_coach_member and not is_venue_member then
          raise exception 'Only the coach or venue may end this relationship.'
            using errcode = '42501';
        end if;
      when 'unverified' then
        raise exception 'Imported relationships require admin verification.'
          using errcode = '42501';
      when 'declined', 'cancelled', 'ended' then
        raise exception 'Historical relationship records cannot be changed.'
          using errcode = '23514';
      else
        raise exception 'Unknown relationship status.' using errcode = '23514';
    end case;

    if new.status in ('active', 'declined', 'cancelled') then
      new.responded_by_user_id := current_user_id;
      new.responded_at := now();
      new.ended_at := null;
    elsif new.status = 'ended' then
      new.ended_at := now();
    end if;

    if new.status in ('declined', 'cancelled', 'ended') then
      new.is_primary := false;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."validate_coach_venue_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_admin_invitation"("invitation_token_digest" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  caller_email text := lower(nullif(btrim((select auth.jwt() ->> 'email')), ''));
  invitation_record public.admin_invitations%rowtype;
begin
  if caller_id is null or caller_email is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select invitation.*
  into invitation_record
  from public.admin_invitations invitation
  where invitation.token_digest = lower(invitation_token_digest)
    and invitation.email = caller_email
    and invitation.status = 'pending'
    and invitation.expires_at > now()
  for update;

  if invitation_record.id is null then
    raise exception 'This invitation is invalid, expired, or belongs to another account.'
      using errcode = '42501';
  end if;

  insert into public.admin_memberships (
    user_id,
    role,
    status,
    invited_by_user_id,
    joined_at,
    updated_at
  )
  values (
    caller_id,
    invitation_record.role,
    'active',
    invitation_record.invited_by_user_id,
    now(),
    now()
  )
  on conflict (user_id)
  do update set
    role = excluded.role,
    status = 'active',
    invited_by_user_id = excluded.invited_by_user_id,
    updated_at = now();

  update public.admin_invitations
  set status = 'accepted',
      accepted_by_user_id = caller_id,
      accepted_at = now(),
      updated_at = now()
  where id = invitation_record.id;

  return invitation_record.role;
end;
$$;


ALTER FUNCTION "public"."accept_admin_invitation"("invitation_token_digest" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_listing_search_key"("input" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
  SELECT regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '', 'g');
$$;


ALTER FUNCTION "public"."normalize_listing_search_key"("input" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "requester_email" "text" NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "reason" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancelled_at" timestamp with time zone,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "account_deletion_requests_email_check" CHECK ((("char_length"("btrim"("requester_email")) >= 5) AND ("char_length"("btrim"("requester_email")) <= 254))),
    CONSTRAINT "account_deletion_requests_reason_check" CHECK ((("reason" IS NULL) OR ("char_length"("btrim"("reason")) <= 1000))),
    CONSTRAINT "account_deletion_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'processing'::"text", 'completed'::"text", 'declined'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."account_deletion_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" bigint NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "actor_role" "text" NOT NULL,
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_audit_log_action_check" CHECK ((("char_length"("btrim"("action")) >= 3) AND ("char_length"("btrim"("action")) <= 120))),
    CONSTRAINT "admin_audit_log_actor_role_check" CHECK (("actor_role" = ANY (ARRAY['owner'::"text", 'operations'::"text", 'reviewer'::"text", 'support'::"text"]))),
    CONSTRAINT "admin_audit_log_details_check" CHECK (("jsonb_typeof"("details") = 'object'::"text")),
    CONSTRAINT "admin_audit_log_target_type_check" CHECK ((("char_length"("btrim"("target_type")) >= 2) AND ("char_length"("btrim"("target_type")) <= 80)))
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


ALTER TABLE "public"."admin_audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."admin_audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."admin_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "token_digest" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_by_user_id" "uuid" NOT NULL,
    "accepted_by_user_id" "uuid",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_email_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "last_send_attempt_at" timestamp with time zone,
    "last_sent_at" timestamp with time zone,
    "send_count" integer DEFAULT 0 NOT NULL,
    "last_email_provider_id" "text",
    "last_email_error_code" "text",
    CONSTRAINT "admin_invitations_delivery_state_check" CHECK ((("last_email_status" = 'pending'::"text") OR (("last_email_status" = 'sent'::"text") AND ("last_send_attempt_at" IS NOT NULL) AND ("last_sent_at" IS NOT NULL)) OR (("last_email_status" = 'failed'::"text") AND ("last_send_attempt_at" IS NOT NULL)))),
    CONSTRAINT "admin_invitations_email_check" CHECK ((("char_length"("btrim"("email")) >= 5) AND ("char_length"("btrim"("email")) <= 254))),
    CONSTRAINT "admin_invitations_email_error_code_check" CHECK ((("last_email_error_code" IS NULL) OR ("char_length"("last_email_error_code") <= 100))),
    CONSTRAINT "admin_invitations_email_status_check" CHECK (("last_email_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"]))),
    CONSTRAINT "admin_invitations_expiry_check" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "admin_invitations_provider_id_check" CHECK ((("last_email_provider_id" IS NULL) OR ("char_length"("last_email_provider_id") <= 255))),
    CONSTRAINT "admin_invitations_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'operations'::"text", 'reviewer'::"text", 'support'::"text"]))),
    CONSTRAINT "admin_invitations_send_count_check" CHECK ((("send_count" >= 0) AND ("send_count" <= 1000))),
    CONSTRAINT "admin_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'cancelled'::"text", 'expired'::"text"]))),
    CONSTRAINT "admin_invitations_token_digest_check" CHECK (("token_digest" ~ '^[a-f0-9]{64}$'::"text"))
);


ALTER TABLE "public"."admin_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_memberships" (
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "invited_by_user_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_memberships_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'operations'::"text", 'reviewer'::"text", 'support'::"text"]))),
    CONSTRAINT "admin_memberships_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."admin_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "year" integer,
    "is_highlight" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "coach_achievements_year_check" CHECK ((("year" IS NULL) OR (("year" >= 1900) AND ("year" <= 2100))))
);


ALTER TABLE "public"."coach_achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_application_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "country" "text" NOT NULL,
    "city" "text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coach_application_locations_city_check" CHECK ((("char_length"("btrim"("city")) >= 2) AND ("char_length"("btrim"("city")) <= 120))),
    CONSTRAINT "coach_application_locations_country_check" CHECK (("country" = ANY (ARRAY['Spain'::"text", 'Italy'::"text", 'Sweden'::"text", 'France'::"text", 'Portugal'::"text", 'United Kingdom'::"text", 'Germany'::"text", 'Belgium'::"text", 'Netherlands'::"text", 'United Arab Emirates'::"text"])))
);


ALTER TABLE "public"."coach_application_locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."coach_application_locations" IS 'Structured repeatable coaching locations belonging to authenticated coach profile applications.';



CREATE TABLE IF NOT EXISTS "public"."coach_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "service_type" "text" NOT NULL,
    "business_name" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "based_in" "text" NOT NULL,
    "operates_multiple_locations" boolean NOT NULL,
    "additional_locations" "text",
    "services_offered" "text"[] NOT NULL,
    "offering_description" "text" NOT NULL,
    "player_levels" "text"[] NOT NULL,
    "player_types_specialty" "text"[] NOT NULL,
    "price_range_per_week" "text" NOT NULL,
    "accommodation_offered" boolean NOT NULL,
    "full_packages_offered" boolean NOT NULL,
    "availability_type" "text" NOT NULL,
    "seasonal_availability_detail" "text",
    "capacity_per_week" "text" NOT NULL,
    "website_url" "text",
    "social_media_links" "text",
    "media_attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "achievements" "text",
    "special_offer_promoted" boolean DEFAULT false NOT NULL,
    "special_offer_description" "text",
    "lead_delivery_preference" "text" NOT NULL,
    "paid_leads_openness" "text" NOT NULL,
    "main_goal" "text" NOT NULL,
    "raw_payload" "jsonb"
);


ALTER TABLE "public"."coach_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_attributes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "audience_adults" boolean DEFAULT false,
    "audience_juniors" boolean DEFAULT false,
    "player_levels" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "coach_attributes_player_levels_check" CHECK (("player_levels" <@ ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text", 'competitive_professional'::"text"]))
);


ALTER TABLE "public"."coach_attributes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_availability_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_venue_id" "uuid" NOT NULL,
    "exception_type" "text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "slot_duration_minutes" smallint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "price_override_minor" integer,
    CONSTRAINT "coach_availability_exceptions_price_check" CHECK (((("exception_type" = 'unavailable'::"text") AND ("price_override_minor" IS NULL)) OR (("exception_type" = 'available'::"text") AND (("price_override_minor" IS NULL) OR (("price_override_minor" >= 0) AND ("price_override_minor" <= 1000000)))))),
    CONSTRAINT "coach_availability_exceptions_slot_check" CHECK (((("exception_type" = 'unavailable'::"text") AND ("slot_duration_minutes" IS NULL)) OR (("exception_type" = 'available'::"text") AND (("slot_duration_minutes" >= 15) AND ("slot_duration_minutes" <= 240)) AND ((("slot_duration_minutes")::integer % 15) = 0) AND (("slot_duration_minutes")::numeric <= (EXTRACT(epoch FROM ("ends_at" - "starts_at")) / (60)::numeric))))),
    CONSTRAINT "coach_availability_exceptions_time_check" CHECK (("ends_at" > "starts_at")),
    CONSTRAINT "coach_availability_exceptions_type_check" CHECK (("exception_type" = ANY (ARRAY['unavailable'::"text", 'available'::"text"])))
);


ALTER TABLE "public"."coach_availability_exceptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_availability_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_venue_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "slot_duration_minutes" smallint DEFAULT 60 NOT NULL,
    "valid_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "price_override_minor" integer,
    CONSTRAINT "coach_availability_rules_day_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 7))),
    CONSTRAINT "coach_availability_rules_price_check" CHECK ((("price_override_minor" IS NULL) OR (("price_override_minor" >= 0) AND ("price_override_minor" <= 1000000)))),
    CONSTRAINT "coach_availability_rules_slot_duration_check" CHECK (((("slot_duration_minutes" >= 15) AND ("slot_duration_minutes" <= 240)) AND ((("slot_duration_minutes")::integer % 15) = 0) AND (("slot_duration_minutes")::numeric <= (EXTRACT(epoch FROM ("end_time" - "start_time")) / (60)::numeric)))),
    CONSTRAINT "coach_availability_rules_time_check" CHECK (("end_time" > "start_time")),
    CONSTRAINT "coach_availability_rules_validity_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" >= "valid_from")))
);


ALTER TABLE "public"."coach_availability_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_booking_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_venue_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "requester_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "timezone" "text" NOT NULL,
    "requester_name" "text" NOT NULL,
    "requester_email" "text" NOT NULL,
    "requester_phone" "text",
    "player_level" "text",
    "message" "text",
    "responded_at" timestamp with time zone,
    "responded_by_user_id" "uuid",
    "cancelled_at" timestamp with time zone,
    "cancelled_by_user_id" "uuid",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "price_amount_minor" integer,
    "currency" "text",
    "pricing_source" "text",
    CONSTRAINT "coach_booking_requests_email_check" CHECK ((("char_length"("btrim"("requester_email")) >= 5) AND ("char_length"("btrim"("requester_email")) <= 254))),
    CONSTRAINT "coach_booking_requests_level_check" CHECK ((("player_level" IS NULL) OR ("player_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text", 'competitive_professional'::"text"])))),
    CONSTRAINT "coach_booking_requests_message_check" CHECK ((("message" IS NULL) OR (("char_length"("btrim"("message")) >= 1) AND ("char_length"("btrim"("message")) <= 1000)))),
    CONSTRAINT "coach_booking_requests_name_check" CHECK ((("char_length"("btrim"("requester_name")) >= 2) AND ("char_length"("btrim"("requester_name")) <= 120))),
    CONSTRAINT "coach_booking_requests_phone_check" CHECK ((("requester_phone" IS NULL) OR (("char_length"("btrim"("requester_phone")) >= 5) AND ("char_length"("btrim"("requester_phone")) <= 40)))),
    CONSTRAINT "coach_booking_requests_pricing_check" CHECK (((("price_amount_minor" IS NULL) AND ("currency" IS NULL) AND ("pricing_source" IS NULL)) OR ((("price_amount_minor" >= 0) AND ("price_amount_minor" <= 1000000)) AND ("currency" ~ '^[A-Z]{3}$'::"text") AND ("pricing_source" = ANY (ARRAY['default_hourly_rate'::"text", 'rule_override'::"text", 'exception_override'::"text"]))))),
    CONSTRAINT "coach_booking_requests_response_consistency_check" CHECK (((("status" = 'requested'::"text") AND ("responded_at" IS NULL) AND ("responded_by_user_id" IS NULL) AND ("cancelled_at" IS NULL) AND ("cancelled_by_user_id" IS NULL) AND ("completed_at" IS NULL)) OR (("status" = ANY (ARRAY['accepted'::"text", 'declined'::"text"])) AND ("responded_at" IS NOT NULL) AND ("responded_by_user_id" IS NOT NULL) AND ("cancelled_at" IS NULL) AND ("cancelled_by_user_id" IS NULL) AND ("completed_at" IS NULL)) OR (("status" = 'cancelled'::"text") AND ("cancelled_at" IS NOT NULL) AND ("cancelled_by_user_id" IS NOT NULL) AND ("completed_at" IS NULL)) OR (("status" = 'completed'::"text") AND ("responded_at" IS NOT NULL) AND ("responded_by_user_id" IS NOT NULL) AND ("completed_at" IS NOT NULL) AND ("cancelled_at" IS NULL) AND ("cancelled_by_user_id" IS NULL)))),
    CONSTRAINT "coach_booking_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text", 'completed'::"text"]))),
    CONSTRAINT "coach_booking_requests_time_check" CHECK (("ends_at" > "starts_at"))
);


ALTER TABLE "public"."coach_booking_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coach_images_url_not_blank_check" CHECK (("btrim"("image_url") <> ''::"text"))
);


ALTER TABLE "public"."coach_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "country" "text" NOT NULL,
    "city" "text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coach_locations_city_check" CHECK ((("char_length"("btrim"("city")) >= 2) AND ("char_length"("btrim"("city")) <= 120))),
    CONSTRAINT "coach_locations_country_check" CHECK (("country" = ANY (ARRAY['Spain'::"text", 'Italy'::"text", 'Sweden'::"text", 'France'::"text", 'Portugal'::"text", 'United Kingdom'::"text", 'Germany'::"text", 'Belgium'::"text", 'Netherlands'::"text", 'United Arab Emirates'::"text"])))
);


ALTER TABLE "public"."coach_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_memberships" (
    "coach_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "membership_role" "text" DEFAULT 'manager'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coach_memberships_role_check" CHECK (("membership_role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))
);


ALTER TABLE "public"."coach_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_outcomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "outcome" "text" NOT NULL,
    "outcome_key" "text",
    CONSTRAINT "coach_outcomes_key_check" CHECK ((("outcome_key" IS NULL) OR ("outcome_key" = ANY (ARRAY['learn_fundamentals'::"text", 'improve_technique'::"text", 'improve_match_tactics'::"text", 'prepare_for_competition'::"text", 'build_confidence'::"text", 'improve_fitness_movement'::"text", 'junior_development'::"text", 'high_performance_development'::"text"])))),
    CONSTRAINT "coach_outcomes_text_check" CHECK (("btrim"("outcome") <> ''::"text"))
);


ALTER TABLE "public"."coach_outcomes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_profile_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "current_step" integer DEFAULT 1 NOT NULL,
    "full_name" "text",
    "phone" "text",
    "coaching_role" "text",
    "coaching_role_other" "text",
    "experience_years" integer,
    "description" "text",
    "player_levels" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "audiences" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "outcomes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "terms_accepted_at" timestamp with time zone,
    "privacy_accepted_at" timestamp with time zone,
    "submitted_at" timestamp with time zone,
    "coach_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by_user_id" "uuid",
    "review_note" "text",
    "application_mode" "text" DEFAULT 'create_new'::"text" NOT NULL,
    "target_coach_id" "uuid",
    "applicant_email" "text" NOT NULL,
    CONSTRAINT "coach_profile_applications_audiences_check" CHECK (("audiences" <@ ARRAY['adults'::"text", 'juniors'::"text"])),
    CONSTRAINT "coach_profile_applications_current_step_check" CHECK ((("current_step" >= 1) AND ("current_step" <= 4))),
    CONSTRAINT "coach_profile_applications_description_check" CHECK ((("description" IS NULL) OR (("char_length"("btrim"("description")) >= 40) AND ("char_length"("btrim"("description")) <= 500)))),
    CONSTRAINT "coach_profile_applications_email_check" CHECK ((("char_length"("btrim"("applicant_email")) >= 5) AND ("char_length"("btrim"("applicant_email")) <= 254))),
    CONSTRAINT "coach_profile_applications_experience_check" CHECK ((("experience_years" IS NULL) OR (("experience_years" >= 0) AND ("experience_years" <= 60)))),
    CONSTRAINT "coach_profile_applications_full_name_check" CHECK ((("full_name" IS NULL) OR (("char_length"("btrim"("full_name")) >= 2) AND ("char_length"("btrim"("full_name")) <= 120)))),
    CONSTRAINT "coach_profile_applications_mode_check" CHECK (("application_mode" = ANY (ARRAY['create_new'::"text", 'claim_existing'::"text"]))),
    CONSTRAINT "coach_profile_applications_other_role_check" CHECK ((("coaching_role" <> 'other'::"text") OR (("coaching_role_other" IS NOT NULL) AND (("char_length"("btrim"("coaching_role_other")) >= 2) AND ("char_length"("btrim"("coaching_role_other")) <= 100))))),
    CONSTRAINT "coach_profile_applications_outcomes_check" CHECK (("outcomes" <@ ARRAY['learn_fundamentals'::"text", 'improve_technique'::"text", 'improve_match_tactics'::"text", 'prepare_for_competition'::"text", 'build_confidence'::"text", 'improve_fitness_movement'::"text", 'junior_development'::"text", 'high_performance_development'::"text"])),
    CONSTRAINT "coach_profile_applications_phone_check" CHECK ((("phone" IS NULL) OR (("char_length"("btrim"("phone")) >= 5) AND ("char_length"("btrim"("phone")) <= 40)))),
    CONSTRAINT "coach_profile_applications_player_levels_check" CHECK (("player_levels" <@ ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text", 'competitive_professional'::"text"])),
    CONSTRAINT "coach_profile_applications_review_note_check" CHECK ((("review_note" IS NULL) OR ("char_length"("btrim"("review_note")) <= 2000))),
    CONSTRAINT "coach_profile_applications_role_check" CHECK ((("coaching_role" IS NULL) OR ("coaching_role" = ANY (ARRAY['padel_coach'::"text", 'head_coach'::"text", 'performance_coach'::"text", 'junior_development_coach'::"text", 'former_professional_player_and_coach'::"text", 'other'::"text"])))),
    CONSTRAINT "coach_profile_applications_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'under_review'::"text", 'changes_requested'::"text", 'approved'::"text", 'declined'::"text", 'withdrawn'::"text"]))),
    CONSTRAINT "coach_profile_applications_target_check" CHECK (((("application_mode" = 'create_new'::"text") AND ("target_coach_id" IS NULL)) OR (("application_mode" = 'claim_existing'::"text") AND ("target_coach_id" IS NOT NULL))))
);


ALTER TABLE "public"."coach_profile_applications" OWNER TO "postgres";


COMMENT ON TABLE "public"."coach_profile_applications" IS 'Authenticated, saveable individual coach onboarding applications. Legacy public submissions remain in coach_applications.';



CREATE TABLE IF NOT EXISTS "public"."coach_socials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "url" "text" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "coach_socials_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'tiktok'::"text", 'youtube'::"text", 'linkedin'::"text", 'x'::"text"]))),
    CONSTRAINT "coach_socials_url_not_blank_check" CHECK (("btrim"("url") <> ''::"text"))
);


ALTER TABLE "public"."coach_socials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_venue_availability_settings" (
    "coach_venue_id" "uuid" NOT NULL,
    "timezone" "text" NOT NULL,
    "default_slot_duration_minutes" smallint DEFAULT 60 NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "currency" "text",
    "default_hourly_rate_minor" integer,
    CONSTRAINT "coach_venue_availability_pricing_check" CHECK (((("currency" IS NULL) AND ("default_hourly_rate_minor" IS NULL)) OR (("currency" ~ '^[A-Z]{3}$'::"text") AND (("default_hourly_rate_minor" >= 0) AND ("default_hourly_rate_minor" <= 1000000))))),
    CONSTRAINT "coach_venue_availability_slot_duration_check" CHECK (((("default_slot_duration_minutes" >= 15) AND ("default_slot_duration_minutes" <= 240)) AND ((("default_slot_duration_minutes")::integer % 15) = 0)))
);


ALTER TABLE "public"."coach_venue_availability_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "initiated_by" "text" DEFAULT 'coach'::"text" NOT NULL,
    "requested_by_user_id" "uuid" DEFAULT "auth"."uid"(),
    "responded_by_user_id" "uuid",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    CONSTRAINT "coach_venues_ended_at_check" CHECK (((("status" = 'ended'::"text") AND ("ended_at" IS NOT NULL)) OR (("status" <> 'ended'::"text") AND ("ended_at" IS NULL)))),
    CONSTRAINT "coach_venues_initiated_by_check" CHECK (("initiated_by" = ANY (ARRAY['coach'::"text", 'venue'::"text", 'admin'::"text", 'import'::"text"]))),
    CONSTRAINT "coach_venues_response_consistency_check" CHECK (((("status" = ANY (ARRAY['unverified'::"text", 'pending'::"text"])) AND ("responded_at" IS NULL)) OR (("status" = ANY (ARRAY['active'::"text", 'declined'::"text", 'cancelled'::"text", 'ended'::"text"])) AND ("responded_at" IS NOT NULL)))),
    CONSTRAINT "coach_venues_status_check" CHECK (("status" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'active'::"text", 'declined'::"text", 'cancelled'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."coach_venues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "role" "text",
    "description" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "image_url" "text",
    "slug" "text",
    "level" "text",
    "experience_years" integer,
    "rating" double precision DEFAULT 0,
    "review_count" integer DEFAULT 0,
    "travel_available" boolean DEFAULT false,
    "price_from" integer,
    "email" "text",
    "phone" "text",
    "normalized_name" "text",
    "search_key" "text" GENERATED ALWAYS AS ("public"."normalize_listing_search_key"(((COALESCE("name", ''::"text") || COALESCE("role", ''::"text")) || COALESCE("normalized_name", ''::"text")))) STORED,
    "source" "text" DEFAULT 'crawler'::"text",
    "is_approved" boolean DEFAULT false,
    "data_quality_status" "text" DEFAULT 'needs_review'::"text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "text",
    "is_claimed" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."coaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid",
    "venue_id" "uuid",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "age" integer,
    "nationality" "text",
    "playing_level" "text",
    "playing_duration" "text",
    "main_goals" "text"[],
    "goals_detail" "text",
    "preferred_destinations" "text"[],
    "preferred_duration" "text",
    "preferred_start_date" "date",
    "training_type" "text",
    "budget_range" "text",
    "accommodation" "text",
    "trained_abroad" boolean,
    "injuries" "text",
    "anything_else" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "current_location_country" "text",
    "current_location_city" "text",
    "wants_personalised_recommendation" boolean DEFAULT false,
    "status" "text" DEFAULT 'new'::"text",
    "subject_type" "text",
    "subject_name" "text",
    "subject_slug" "text",
    "source_url" "text"
);


ALTER TABLE "public"."enquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_workspace_type" "text",
    "last_workspace_entity_id" "uuid",
    "avatar_path" "text",
    "avatar_updated_at" timestamp with time zone,
    CONSTRAINT "profiles_avatar_path_check" CHECK ((("avatar_path" IS NULL) OR ("avatar_path" = (('accounts/'::"text" || ("id")::"text") || '/avatar'::"text")))),
    CONSTRAINT "profiles_last_workspace_check" CHECK (((("last_workspace_type" IS NULL) AND ("last_workspace_entity_id" IS NULL)) OR (("last_workspace_type" = ANY (ARRAY['personal'::"text", 'admin'::"text"])) AND ("last_workspace_entity_id" IS NULL)) OR (("last_workspace_type" = ANY (ARRAY['coach'::"text", 'venue'::"text"])) AND ("last_workspace_entity_id" IS NOT NULL)))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venue_booking_blocks" (
    "booking_request_id" "uuid" NOT NULL,
    "coach_venue_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "timezone" "text" NOT NULL,
    "price_amount_minor" integer,
    "currency" "text",
    "requested_at" timestamp with time zone NOT NULL,
    "responded_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "venue_booking_blocks_pricing_check" CHECK (((("price_amount_minor" IS NULL) AND ("currency" IS NULL)) OR ((("price_amount_minor" >= 0) AND ("price_amount_minor" <= 1000000)) AND ("currency" ~ '^[A-Z]{3}$'::"text")))),
    CONSTRAINT "venue_booking_blocks_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text", 'completed'::"text"]))),
    CONSTRAINT "venue_booking_blocks_time_check" CHECK (("ends_at" > "starts_at"))
);


ALTER TABLE "public"."venue_booking_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venue_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "venue_images_url_not_blank_check" CHECK (("btrim"("url") <> ''::"text"))
);


ALTER TABLE "public"."venue_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venue_memberships" (
    "venue_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "membership_role" "text" DEFAULT 'manager'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "venue_memberships_role_check" CHECK (("membership_role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))
);


ALTER TABLE "public"."venue_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venue_profile_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "current_step" integer DEFAULT 1 NOT NULL,
    "application_mode" "text",
    "relationship_to_venue" "text",
    "target_venue_id" "uuid",
    "proposed_venue_name" "text",
    "proposed_country" "text",
    "proposed_city" "text",
    "proposed_address" "text",
    "proposed_website" "text",
    "phone" "text",
    "supporting_note" "text",
    "terms_accepted_at" timestamp with time zone,
    "privacy_accepted_at" timestamp with time zone,
    "submitted_at" timestamp with time zone,
    "approved_venue_id" "uuid",
    "approved_membership_role" "text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by_user_id" "uuid",
    "review_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applicant_email" "text" NOT NULL,
    CONSTRAINT "venue_profile_applications_address_check" CHECK ((("proposed_address" IS NULL) OR ("char_length"("btrim"("proposed_address")) <= 300))),
    CONSTRAINT "venue_profile_applications_city_check" CHECK ((("proposed_city" IS NULL) OR (("char_length"("btrim"("proposed_city")) >= 1) AND ("char_length"("btrim"("proposed_city")) <= 120)))),
    CONSTRAINT "venue_profile_applications_country_check" CHECK ((("proposed_country" IS NULL) OR ("proposed_country" = ANY (ARRAY['Spain'::"text", 'Italy'::"text", 'Sweden'::"text", 'France'::"text", 'Portugal'::"text", 'United Kingdom'::"text", 'Germany'::"text", 'Belgium'::"text", 'Netherlands'::"text", 'United Arab Emirates'::"text"])))),
    CONSTRAINT "venue_profile_applications_email_check" CHECK ((("char_length"("btrim"("applicant_email")) >= 5) AND ("char_length"("btrim"("applicant_email")) <= 254))),
    CONSTRAINT "venue_profile_applications_membership_role_check" CHECK ((("approved_membership_role" IS NULL) OR ("approved_membership_role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))),
    CONSTRAINT "venue_profile_applications_mode_check" CHECK ((("application_mode" IS NULL) OR ("application_mode" = ANY (ARRAY['claim_existing'::"text", 'create_new'::"text"])))),
    CONSTRAINT "venue_profile_applications_name_check" CHECK ((("proposed_venue_name" IS NULL) OR (("char_length"("btrim"("proposed_venue_name")) >= 2) AND ("char_length"("btrim"("proposed_venue_name")) <= 160)))),
    CONSTRAINT "venue_profile_applications_phone_check" CHECK ((("phone" IS NULL) OR (("char_length"("btrim"("phone")) >= 5) AND ("char_length"("btrim"("phone")) <= 40)))),
    CONSTRAINT "venue_profile_applications_relationship_check" CHECK ((("relationship_to_venue" IS NULL) OR ("relationship_to_venue" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'authorised_representative'::"text"])))),
    CONSTRAINT "venue_profile_applications_review_note_check" CHECK ((("review_note" IS NULL) OR ("char_length"("btrim"("review_note")) <= 2000))),
    CONSTRAINT "venue_profile_applications_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'under_review'::"text", 'changes_requested'::"text", 'approved'::"text", 'declined'::"text", 'withdrawn'::"text"]))),
    CONSTRAINT "venue_profile_applications_step_check" CHECK ((("current_step" >= 1) AND ("current_step" <= 4))),
    CONSTRAINT "venue_profile_applications_supporting_note_check" CHECK ((("supporting_note" IS NULL) OR ("char_length"("btrim"("supporting_note")) <= 1000))),
    CONSTRAINT "venue_profile_applications_target_consistency_check" CHECK ((("application_mode" IS NULL) OR (("application_mode" = 'claim_existing'::"text") AND ("target_venue_id" IS NOT NULL)) OR (("application_mode" = 'create_new'::"text") AND ("target_venue_id" IS NULL)))),
    CONSTRAINT "venue_profile_applications_website_check" CHECK ((("proposed_website" IS NULL) OR ("char_length"("btrim"("proposed_website")) <= 500)))
);


ALTER TABLE "public"."venue_profile_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venue_socials" (
    "id" bigint NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "url" "text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "venue_socials_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'tiktok'::"text", 'youtube'::"text", 'linkedin'::"text", 'x'::"text"]))),
    CONSTRAINT "venue_socials_url_not_blank_check" CHECK (("btrim"("url") <> ''::"text"))
);


ALTER TABLE "public"."venue_socials" OWNER TO "postgres";


ALTER TABLE "public"."venue_socials" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."venue_socials_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "city" "text",
    "country" "text",
    "lat" double precision,
    "lng" double precision,
    "google_place_id" "text",
    "rating" double precision,
    "review_count" integer,
    "website" "text",
    "image_url" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "courts" smallint,
    "court_type" "text",
    "coaching_available" boolean,
    "price" "text",
    "ai_confidence" "text",
    "coaching_description" "text",
    "venue_type" "text",
    "phone" "text",
    "opening_hours" "text",
    "address" "text",
    "images" "text"[],
    "last_synced_at" timestamp with time zone,
    "last_crawled_at" timestamp with time zone,
    "crawl_version" "text",
    "search_key" "text" GENERATED ALWAYS AS ("public"."normalize_listing_search_key"(((COALESCE("name", ''::"text") || COALESCE("city", ''::"text")) || COALESCE("country", ''::"text")))) STORED,
    "source" "text" DEFAULT 'crawler'::"text",
    "is_approved" boolean DEFAULT false,
    "data_quality_status" "text" DEFAULT 'needs_review'::"text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "text",
    "opening_hours_structured" "jsonb",
    CONSTRAINT "venues_opening_hours_structured_check" CHECK ((("opening_hours_structured" IS NULL) OR (("jsonb_typeof"("opening_hours_structured") = 'object'::"text") AND ("opening_hours_structured" ?& ARRAY['monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text", 'sunday'::"text"]) AND (("opening_hours_structured" - ARRAY['monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text", 'sunday'::"text"]) = '{}'::"jsonb"))))
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


COMMENT ON COLUMN "public"."venues"."opening_hours_structured" IS 'Structured weekly opening hours. Each weekday stores status plus optional opens/closes times. Legacy opening_hours text remains available as fallback.';



ALTER TABLE ONLY "public"."account_deletion_requests"
    ADD CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_invitations"
    ADD CONSTRAINT "admin_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_invitations"
    ADD CONSTRAINT "admin_invitations_token_digest_key" UNIQUE ("token_digest");



ALTER TABLE ONLY "public"."admin_memberships"
    ADD CONSTRAINT "admin_memberships_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."coach_achievements"
    ADD CONSTRAINT "coach_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_application_locations"
    ADD CONSTRAINT "coach_application_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_applications"
    ADD CONSTRAINT "coach_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_attributes"
    ADD CONSTRAINT "coach_attributes_coach_id_key" UNIQUE ("coach_id");



ALTER TABLE ONLY "public"."coach_attributes"
    ADD CONSTRAINT "coach_attributes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_availability_exceptions"
    ADD CONSTRAINT "coach_availability_exceptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_availability_rules"
    ADD CONSTRAINT "coach_availability_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_booking_requests"
    ADD CONSTRAINT "coach_booking_requests_no_accepted_overlap" EXCLUDE USING "gist" ("coach_id" WITH =, "tstzrange"("starts_at", "ends_at", '[)'::"text") WITH &&) WHERE (("status" = 'accepted'::"text"));



ALTER TABLE ONLY "public"."coach_booking_requests"
    ADD CONSTRAINT "coach_booking_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_images"
    ADD CONSTRAINT "coach_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_locations"
    ADD CONSTRAINT "coach_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_locations"
    ADD CONSTRAINT "coach_locations_unique" UNIQUE ("coach_id", "country", "city");



ALTER TABLE ONLY "public"."coach_memberships"
    ADD CONSTRAINT "coach_memberships_pkey" PRIMARY KEY ("coach_id", "user_id");



ALTER TABLE ONLY "public"."coach_outcomes"
    ADD CONSTRAINT "coach_outcomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_profile_applications"
    ADD CONSTRAINT "coach_profile_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_socials"
    ADD CONSTRAINT "coach_socials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_venue_availability_settings"
    ADD CONSTRAINT "coach_venue_availability_settings_pkey" PRIMARY KEY ("coach_venue_id");



ALTER TABLE ONLY "public"."coach_venues"
    ADD CONSTRAINT "coach_venues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_booking_blocks"
    ADD CONSTRAINT "venue_booking_blocks_pkey" PRIMARY KEY ("booking_request_id");



ALTER TABLE ONLY "public"."venue_images"
    ADD CONSTRAINT "venue_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_images"
    ADD CONSTRAINT "venue_images_unique" UNIQUE ("venue_id", "url");



ALTER TABLE ONLY "public"."venue_memberships"
    ADD CONSTRAINT "venue_memberships_pkey" PRIMARY KEY ("venue_id", "user_id");



ALTER TABLE ONLY "public"."venue_profile_applications"
    ADD CONSTRAINT "venue_profile_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_socials"
    ADD CONSTRAINT "venue_socials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_socials"
    ADD CONSTRAINT "venue_socials_unique" UNIQUE ("venue_id", "platform", "url");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_google_place_id_key" UNIQUE ("google_place_id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "account_deletion_requests_one_open_per_user_idx" ON "public"."account_deletion_requests" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['requested'::"text", 'processing'::"text"]));



CREATE INDEX "account_deletion_requests_status_idx" ON "public"."account_deletion_requests" USING "btree" ("status", "requested_at" DESC);



CREATE INDEX "admin_audit_log_actor_idx" ON "public"."admin_audit_log" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "admin_audit_log_created_idx" ON "public"."admin_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "admin_audit_log_target_idx" ON "public"."admin_audit_log" USING "btree" ("target_type", "target_id", "created_at" DESC);



CREATE UNIQUE INDEX "admin_invitations_one_pending_email_idx" ON "public"."admin_invitations" USING "btree" ("lower"("email")) WHERE ("status" = 'pending'::"text");



CREATE INDEX "admin_invitations_status_expiry_idx" ON "public"."admin_invitations" USING "btree" ("status", "expires_at");



CREATE INDEX "admin_memberships_role_status_idx" ON "public"."admin_memberships" USING "btree" ("role", "status");



CREATE UNIQUE INDEX "coach_achievements_unique_idx" ON "public"."coach_achievements" USING "btree" ("coach_id", "title");



CREATE INDEX "coach_application_locations_application_idx" ON "public"."coach_application_locations" USING "btree" ("application_id");



CREATE UNIQUE INDEX "coach_application_locations_one_primary_idx" ON "public"."coach_application_locations" USING "btree" ("application_id") WHERE ("is_primary" IS TRUE);



CREATE UNIQUE INDEX "coach_application_locations_unique_location_idx" ON "public"."coach_application_locations" USING "btree" ("application_id", "lower"("country"), "lower"("city"));



CREATE INDEX "coach_applications_created_at_idx" ON "public"."coach_applications" USING "btree" ("created_at" DESC);



CREATE INDEX "coach_applications_email_idx" ON "public"."coach_applications" USING "btree" ("email");



CREATE INDEX "coach_applications_status_idx" ON "public"."coach_applications" USING "btree" ("status");



CREATE INDEX "coach_availability_exceptions_relationship_idx" ON "public"."coach_availability_exceptions" USING "btree" ("coach_venue_id");



CREATE INDEX "coach_availability_exceptions_time_idx" ON "public"."coach_availability_exceptions" USING "btree" ("starts_at", "ends_at");



CREATE INDEX "coach_availability_rules_relationship_idx" ON "public"."coach_availability_rules" USING "btree" ("coach_venue_id");



CREATE INDEX "coach_availability_rules_schedule_idx" ON "public"."coach_availability_rules" USING "btree" ("day_of_week", "valid_from", "valid_until") WHERE ("is_active" IS TRUE);



CREATE INDEX "coach_booking_requests_coach_status_start_idx" ON "public"."coach_booking_requests" USING "btree" ("coach_id", "status", "starts_at");



CREATE UNIQUE INDEX "coach_booking_requests_one_open_request_per_user_slot_idx" ON "public"."coach_booking_requests" USING "btree" ("requester_user_id", "coach_venue_id", "starts_at", "ends_at") WHERE ("status" = ANY (ARRAY['requested'::"text", 'accepted'::"text"]));



CREATE INDEX "coach_booking_requests_requester_status_start_idx" ON "public"."coach_booking_requests" USING "btree" ("requester_user_id", "status", "starts_at");



CREATE INDEX "coach_booking_requests_venue_start_idx" ON "public"."coach_booking_requests" USING "btree" ("venue_id", "starts_at");



CREATE UNIQUE INDEX "coach_images_one_primary_per_coach_idx" ON "public"."coach_images" USING "btree" ("coach_id") WHERE ("is_primary" IS TRUE);



CREATE UNIQUE INDEX "coach_images_unique_idx" ON "public"."coach_images" USING "btree" ("coach_id", "image_url");



CREATE INDEX "coach_locations_country_city_idx" ON "public"."coach_locations" USING "btree" ("country", "city");



CREATE UNIQUE INDEX "coach_locations_one_primary_per_coach_idx" ON "public"."coach_locations" USING "btree" ("coach_id") WHERE ("is_primary" IS TRUE);



CREATE INDEX "coach_memberships_user_id_idx" ON "public"."coach_memberships" USING "btree" ("user_id");



CREATE UNIQUE INDEX "coach_outcomes_unique_idx" ON "public"."coach_outcomes" USING "btree" ("coach_id", "outcome");



CREATE UNIQUE INDEX "coach_outcomes_unique_key_per_coach_idx" ON "public"."coach_outcomes" USING "btree" ("coach_id", "outcome_key") WHERE ("outcome_key" IS NOT NULL);



CREATE UNIQUE INDEX "coach_profile_applications_one_active_per_user_idx" ON "public"."coach_profile_applications" USING "btree" ("user_id") WHERE ("status" <> ALL (ARRAY['declined'::"text", 'withdrawn'::"text"]));



CREATE INDEX "coach_profile_applications_reviewed_by_idx" ON "public"."coach_profile_applications" USING "btree" ("reviewed_by_user_id");



CREATE INDEX "coach_profile_applications_status_idx" ON "public"."coach_profile_applications" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "coach_profile_applications_target_idx" ON "public"."coach_profile_applications" USING "btree" ("target_coach_id", "status") WHERE ("target_coach_id" IS NOT NULL);



CREATE INDEX "coach_profile_applications_user_idx" ON "public"."coach_profile_applications" USING "btree" ("user_id");



CREATE INDEX "coach_socials_coach_idx" ON "public"."coach_socials" USING "btree" ("coach_id");



CREATE UNIQUE INDEX "coach_socials_one_primary_per_coach_idx" ON "public"."coach_socials" USING "btree" ("coach_id") WHERE ("is_primary" IS TRUE);



CREATE UNIQUE INDEX "coach_socials_unique_platform_idx" ON "public"."coach_socials" USING "btree" ("coach_id", "platform");



CREATE UNIQUE INDEX "coach_venues_one_current_pair_idx" ON "public"."coach_venues" USING "btree" ("coach_id", "venue_id") WHERE ("status" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'active'::"text"]));



CREATE UNIQUE INDEX "coach_venues_one_primary_per_coach_idx" ON "public"."coach_venues" USING "btree" ("coach_id") WHERE ("is_primary" IS TRUE);



CREATE INDEX "coach_venues_requested_by_user_id_idx" ON "public"."coach_venues" USING "btree" ("requested_by_user_id");



CREATE INDEX "coach_venues_responded_by_user_id_idx" ON "public"."coach_venues" USING "btree" ("responded_by_user_id");



CREATE INDEX "coach_venues_venue_id_idx" ON "public"."coach_venues" USING "btree" ("venue_id");



CREATE UNIQUE INDEX "coaches_normalized_name_idx" ON "public"."coaches" USING "btree" ("normalized_name");



CREATE INDEX "coaches_search_key_idx" ON "public"."coaches" USING "btree" ("search_key");



CREATE INDEX "enquiries_coach_id_idx" ON "public"."enquiries" USING "btree" ("coach_id");



CREATE INDEX "enquiries_venue_id_idx" ON "public"."enquiries" USING "btree" ("venue_id");



CREATE INDEX "venue_booking_blocks_coach_time_idx" ON "public"."venue_booking_blocks" USING "btree" ("coach_id", "starts_at");



CREATE INDEX "venue_booking_blocks_venue_status_time_idx" ON "public"."venue_booking_blocks" USING "btree" ("venue_id", "status", "starts_at");



CREATE INDEX "venue_booking_blocks_venue_time_idx" ON "public"."venue_booking_blocks" USING "btree" ("venue_id", "starts_at", "ends_at");



CREATE UNIQUE INDEX "venue_images_one_primary_per_venue_idx" ON "public"."venue_images" USING "btree" ("venue_id") WHERE ("is_primary" IS TRUE);



CREATE INDEX "venue_memberships_user_id_idx" ON "public"."venue_memberships" USING "btree" ("user_id");



CREATE INDEX "venue_profile_applications_approved_venue_idx" ON "public"."venue_profile_applications" USING "btree" ("approved_venue_id");



CREATE UNIQUE INDEX "venue_profile_applications_one_active_per_user_idx" ON "public"."venue_profile_applications" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'under_review'::"text", 'changes_requested'::"text"]));



CREATE INDEX "venue_profile_applications_reviewed_by_idx" ON "public"."venue_profile_applications" USING "btree" ("reviewed_by_user_id");



CREATE INDEX "venue_profile_applications_status_idx" ON "public"."venue_profile_applications" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "venue_profile_applications_target_venue_idx" ON "public"."venue_profile_applications" USING "btree" ("target_venue_id");



CREATE UNIQUE INDEX "venue_socials_one_primary_per_venue_idx" ON "public"."venue_socials" USING "btree" ("venue_id") WHERE ("is_primary" IS TRUE);



CREATE INDEX "venue_socials_venue_idx" ON "public"."venue_socials" USING "btree" ("venue_id");



CREATE INDEX "venues_search_key_idx" ON "public"."venues" USING "btree" ("search_key");



CREATE OR REPLACE TRIGGER "coach_application_notification_email" BEFORE INSERT OR UPDATE ON "public"."coach_profile_applications" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_application_notification_email"();



CREATE OR REPLACE TRIGGER "coach_profile_applications_prepare_update" BEFORE UPDATE ON "public"."coach_profile_applications" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_coach_profile_application_update"();



CREATE OR REPLACE TRIGGER "finalize_approved_coach_application_trigger" AFTER UPDATE ON "public"."coach_profile_applications" FOR EACH ROW EXECUTE FUNCTION "private"."finalize_approved_coach_application"();



CREATE OR REPLACE TRIGGER "finalize_approved_venue_application_trigger" AFTER UPDATE ON "public"."venue_profile_applications" FOR EACH ROW EXECUTE FUNCTION "private"."finalize_approved_venue_application"();



CREATE OR REPLACE TRIGGER "prepare_account_deletion_request" BEFORE INSERT OR UPDATE ON "public"."account_deletion_requests" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_account_deletion_request"();



CREATE OR REPLACE TRIGGER "prepare_admin_audit_event" BEFORE INSERT ON "public"."admin_audit_log" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_admin_audit_event"();



CREATE OR REPLACE TRIGGER "prepare_coach_availability_exception" BEFORE INSERT OR UPDATE ON "public"."coach_availability_exceptions" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_coach_availability_exception"();



CREATE OR REPLACE TRIGGER "prepare_coach_availability_rule" BEFORE INSERT OR UPDATE ON "public"."coach_availability_rules" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_coach_availability_rule"();



CREATE OR REPLACE TRIGGER "prepare_coach_booking_request" BEFORE INSERT OR UPDATE ON "public"."coach_booking_requests" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_coach_booking_request"();



CREATE OR REPLACE TRIGGER "prepare_coach_venue_availability_settings" BEFORE INSERT OR UPDATE ON "public"."coach_venue_availability_settings" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_coach_venue_availability_settings"();



CREATE OR REPLACE TRIGGER "prepare_venue_profile_application_update_trigger" BEFORE UPDATE ON "public"."venue_profile_applications" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_venue_profile_application_update"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."set_profile_updated_at"();



CREATE OR REPLACE TRIGGER "sync_coach_claimed_state" AFTER INSERT OR DELETE OR UPDATE ON "public"."coach_memberships" FOR EACH ROW EXECUTE FUNCTION "private"."sync_coach_claimed_state"();



CREATE OR REPLACE TRIGGER "sync_venue_booking_block" AFTER INSERT OR DELETE OR UPDATE ON "public"."coach_booking_requests" FOR EACH ROW EXECUTE FUNCTION "private"."sync_venue_booking_block"();



CREATE OR REPLACE TRIGGER "validate_admin_invitation_change" BEFORE INSERT OR UPDATE ON "public"."admin_invitations" FOR EACH ROW EXECUTE FUNCTION "private"."validate_admin_invitation_change"();



CREATE OR REPLACE TRIGGER "validate_admin_membership_change" BEFORE INSERT OR UPDATE ON "public"."admin_memberships" FOR EACH ROW EXECUTE FUNCTION "private"."validate_admin_membership_change"();



CREATE OR REPLACE TRIGGER "validate_coach_venue_change" BEFORE INSERT OR UPDATE ON "public"."coach_venues" FOR EACH ROW EXECUTE FUNCTION "private"."validate_coach_venue_change"();



CREATE OR REPLACE TRIGGER "venue_application_notification_email" BEFORE INSERT OR UPDATE ON "public"."venue_profile_applications" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_application_notification_email"();



ALTER TABLE ONLY "public"."account_deletion_requests"
    ADD CONSTRAINT "account_deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."admin_invitations"
    ADD CONSTRAINT "admin_invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."admin_invitations"
    ADD CONSTRAINT "admin_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."admin_memberships"
    ADD CONSTRAINT "admin_memberships_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_memberships"
    ADD CONSTRAINT "admin_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."coach_achievements"
    ADD CONSTRAINT "coach_achievements_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_application_locations"
    ADD CONSTRAINT "coach_application_locations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."coach_profile_applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_attributes"
    ADD CONSTRAINT "coach_attributes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_availability_exceptions"
    ADD CONSTRAINT "coach_availability_exceptions_coach_venue_id_fkey" FOREIGN KEY ("coach_venue_id") REFERENCES "public"."coach_venue_availability_settings"("coach_venue_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_availability_rules"
    ADD CONSTRAINT "coach_availability_rules_coach_venue_id_fkey" FOREIGN KEY ("coach_venue_id") REFERENCES "public"."coach_venue_availability_settings"("coach_venue_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_booking_requests"
    ADD CONSTRAINT "coach_booking_requests_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coach_booking_requests"
    ADD CONSTRAINT "coach_booking_requests_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."coach_booking_requests"
    ADD CONSTRAINT "coach_booking_requests_coach_venue_id_fkey" FOREIGN KEY ("coach_venue_id") REFERENCES "public"."coach_venues"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."coach_booking_requests"
    ADD CONSTRAINT "coach_booking_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."coach_booking_requests"
    ADD CONSTRAINT "coach_booking_requests_responded_by_user_id_fkey" FOREIGN KEY ("responded_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coach_booking_requests"
    ADD CONSTRAINT "coach_booking_requests_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."coach_images"
    ADD CONSTRAINT "coach_images_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_locations"
    ADD CONSTRAINT "coach_locations_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_memberships"
    ADD CONSTRAINT "coach_memberships_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_memberships"
    ADD CONSTRAINT "coach_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_outcomes"
    ADD CONSTRAINT "coach_outcomes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_profile_applications"
    ADD CONSTRAINT "coach_profile_applications_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coach_profile_applications"
    ADD CONSTRAINT "coach_profile_applications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coach_profile_applications"
    ADD CONSTRAINT "coach_profile_applications_target_coach_id_fkey" FOREIGN KEY ("target_coach_id") REFERENCES "public"."coaches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."coach_profile_applications"
    ADD CONSTRAINT "coach_profile_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_socials"
    ADD CONSTRAINT "coach_socials_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_venue_availability_settings"
    ADD CONSTRAINT "coach_venue_availability_settings_coach_venue_id_fkey" FOREIGN KEY ("coach_venue_id") REFERENCES "public"."coach_venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_venues"
    ADD CONSTRAINT "coach_venues_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_venues"
    ADD CONSTRAINT "coach_venues_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coach_venues"
    ADD CONSTRAINT "coach_venues_responded_by_user_id_fkey" FOREIGN KEY ("responded_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coach_venues"
    ADD CONSTRAINT "coach_venues_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id");



ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_booking_blocks"
    ADD CONSTRAINT "venue_booking_blocks_booking_request_id_fkey" FOREIGN KEY ("booking_request_id") REFERENCES "public"."coach_booking_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_booking_blocks"
    ADD CONSTRAINT "venue_booking_blocks_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."venue_booking_blocks"
    ADD CONSTRAINT "venue_booking_blocks_coach_venue_id_fkey" FOREIGN KEY ("coach_venue_id") REFERENCES "public"."coach_venues"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."venue_booking_blocks"
    ADD CONSTRAINT "venue_booking_blocks_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."venue_images"
    ADD CONSTRAINT "venue_images_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_memberships"
    ADD CONSTRAINT "venue_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_memberships"
    ADD CONSTRAINT "venue_memberships_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_profile_applications"
    ADD CONSTRAINT "venue_profile_applications_approved_venue_id_fkey" FOREIGN KEY ("approved_venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venue_profile_applications"
    ADD CONSTRAINT "venue_profile_applications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venue_profile_applications"
    ADD CONSTRAINT "venue_profile_applications_target_venue_id_fkey" FOREIGN KEY ("target_venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venue_profile_applications"
    ADD CONSTRAINT "venue_profile_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_socials"
    ADD CONSTRAINT "venue_socials_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



CREATE POLICY "Active admins can append audit events" ON "public"."admin_audit_log" FOR INSERT TO "authenticated" WITH CHECK ((("actor_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND "private"."has_admin_permission"('admin.access'::"text")));



CREATE POLICY "Admin team can view account deletion requests" ON "public"."account_deletion_requests" FOR SELECT TO "authenticated" USING ("private"."has_admin_permission"('deletions.read'::"text"));



CREATE POLICY "Admin team can view coach memberships" ON "public"."coach_memberships" FOR SELECT TO "authenticated" USING ("private"."has_admin_permission"('relationships.read'::"text"));



CREATE POLICY "Admin team can view permitted memberships" ON "public"."admin_memberships" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."has_admin_permission"('team.manage'::"text")));



CREATE POLICY "Admin team can view profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("private"."has_admin_permission"('profiles.read'::"text"));



CREATE POLICY "Admin team can view relationships" ON "public"."coach_venues" FOR SELECT TO "authenticated" USING ("private"."has_admin_permission"('relationships.read'::"text"));



CREATE POLICY "Admin team can view venue booking blocks" ON "public"."venue_booking_blocks" FOR SELECT TO "authenticated" USING ("private"."has_admin_permission"('bookings.read'::"text"));



CREATE POLICY "Admin team can view venue memberships" ON "public"."venue_memberships" FOR SELECT TO "authenticated" USING ("private"."has_admin_permission"('relationships.read'::"text"));



CREATE POLICY "Admins can create coach memberships" ON "public"."coach_memberships" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can create coach venue links" ON "public"."coach_venues" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can create coaches" ON "public"."coaches" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can create venue memberships" ON "public"."venue_memberships" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can create venues" ON "public"."venues" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can delete coach memberships" ON "public"."coach_memberships" FOR DELETE TO "authenticated" USING ("private"."is_current_user_admin"());



CREATE POLICY "Admins can delete venue memberships" ON "public"."venue_memberships" FOR DELETE TO "authenticated" USING ("private"."is_current_user_admin"());



CREATE POLICY "Admins can update account deletion requests" ON "public"."account_deletion_requests" FOR UPDATE TO "authenticated" USING ("private"."is_current_user_admin"()) WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can update all coach venue links" ON "public"."coach_venues" FOR UPDATE TO "authenticated" USING ("private"."is_current_user_admin"()) WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can update coach applications" ON "public"."coach_profile_applications" FOR UPDATE TO "authenticated" USING ("private"."is_current_user_admin"()) WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can update coach memberships" ON "public"."coach_memberships" FOR UPDATE TO "authenticated" USING ("private"."is_current_user_admin"()) WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can update coaches" ON "public"."coaches" FOR UPDATE TO "authenticated" USING ("private"."is_current_user_admin"()) WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can update venue applications" ON "public"."venue_profile_applications" FOR UPDATE TO "authenticated" USING ("private"."is_current_user_admin"()) WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can update venue memberships" ON "public"."venue_memberships" FOR UPDATE TO "authenticated" USING ("private"."is_current_user_admin"()) WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can update venues" ON "public"."venues" FOR UPDATE TO "authenticated" USING ("private"."is_current_user_admin"()) WITH CHECK ("private"."is_current_user_admin"());



CREATE POLICY "Admins can view account deletion requests" ON "public"."account_deletion_requests" FOR SELECT TO "authenticated" USING ("private"."is_current_user_admin"());



CREATE POLICY "Admins can view all coach applications" ON "public"."coach_profile_applications" FOR SELECT TO "authenticated" USING ("private"."is_current_user_admin"());



CREATE POLICY "Admins can view all coach memberships" ON "public"."coach_memberships" FOR SELECT TO "authenticated" USING ("private"."is_current_user_admin"());



CREATE POLICY "Admins can view all coach venue links" ON "public"."coach_venues" FOR SELECT TO "authenticated" USING ("private"."is_current_user_admin"());



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("private"."is_current_user_admin"());



CREATE POLICY "Admins can view all venue applications" ON "public"."venue_profile_applications" FOR SELECT TO "authenticated" USING ("private"."is_current_user_admin"());



CREATE POLICY "Admins can view all venue memberships" ON "public"."venue_memberships" FOR SELECT TO "authenticated" USING ("private"."is_current_user_admin"());



CREATE POLICY "Anonymous users can view current coach venue links" ON "public"."coach_venues" FOR SELECT TO "anon" USING (("status" = ANY (ARRAY['unverified'::"text", 'active'::"text"])));



CREATE POLICY "Authenticated users can view permitted availability exceptions" ON "public"."coach_availability_exceptions" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."coach_venue_availability_settings" "settings"
     JOIN "public"."coach_venues" "relationship" ON (("relationship"."id" = "settings"."coach_venue_id")))
  WHERE (("settings"."coach_venue_id" = "coach_availability_exceptions"."coach_venue_id") AND ("settings"."is_public" IS TRUE) AND ("relationship"."status" = 'active'::"text")))) OR (EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_availability_exceptions"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."venue_memberships" "membership" ON (("membership"."venue_id" = "relationship"."venue_id")))
  WHERE (("relationship"."id" = "coach_availability_exceptions"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Authenticated users can view permitted availability rules" ON "public"."coach_availability_rules" FOR SELECT TO "authenticated" USING (((("is_active" IS TRUE) AND (EXISTS ( SELECT 1
   FROM ("public"."coach_venue_availability_settings" "settings"
     JOIN "public"."coach_venues" "relationship" ON (("relationship"."id" = "settings"."coach_venue_id")))
  WHERE (("settings"."coach_venue_id" = "coach_availability_rules"."coach_venue_id") AND ("settings"."is_public" IS TRUE) AND ("relationship"."status" = 'active'::"text"))))) OR (EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_availability_rules"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."venue_memberships" "membership" ON (("membership"."venue_id" = "relationship"."venue_id")))
  WHERE (("relationship"."id" = "coach_availability_rules"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Authenticated users can view permitted availability settings" ON "public"."coach_venue_availability_settings" FOR SELECT TO "authenticated" USING (((("is_public" IS TRUE) AND (EXISTS ( SELECT 1
   FROM "public"."coach_venues" "relationship"
  WHERE (("relationship"."id" = "coach_venue_availability_settings"."coach_venue_id") AND ("relationship"."status" = 'active'::"text"))))) OR (EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_venue_availability_settings"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."venue_memberships" "membership" ON (("membership"."venue_id" = "relationship"."venue_id")))
  WHERE (("relationship"."id" = "coach_venue_availability_settings"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Authenticated users can view permitted coach venue links" ON "public"."coach_venues" FOR SELECT TO "authenticated" USING ((("status" = ANY (ARRAY['unverified'::"text", 'active'::"text"])) OR ("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Coach members can create availability exceptions" ON "public"."coach_availability_exceptions" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_availability_exceptions"."coach_venue_id") AND ("relationship"."status" = 'active'::"text") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can create availability rules" ON "public"."coach_availability_rules" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_availability_rules"."coach_venue_id") AND ("relationship"."status" = 'active'::"text") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can create availability settings" ON "public"."coach_venue_availability_settings" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_venue_availability_settings"."coach_venue_id") AND ("relationship"."status" = 'active'::"text") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can create coach achievements" ON "public"."coach_achievements" FOR INSERT TO "authenticated" WITH CHECK (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can create coach attributes" ON "public"."coach_attributes" FOR INSERT TO "authenticated" WITH CHECK (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can create coach images" ON "public"."coach_images" FOR INSERT TO "authenticated" WITH CHECK (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can create coach locations" ON "public"."coach_locations" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."coach_memberships" "membership"
  WHERE (("membership"."coach_id" = "coach_locations"."coach_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can create coach outcomes" ON "public"."coach_outcomes" FOR INSERT TO "authenticated" WITH CHECK (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can create coach socials" ON "public"."coach_socials" FOR INSERT TO "authenticated" WITH CHECK (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can delete availability exceptions" ON "public"."coach_availability_exceptions" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_availability_exceptions"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can delete availability rules" ON "public"."coach_availability_rules" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_availability_rules"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can delete availability settings" ON "public"."coach_venue_availability_settings" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_venue_availability_settings"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can delete coach achievements" ON "public"."coach_achievements" FOR DELETE TO "authenticated" USING (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can delete coach images" ON "public"."coach_images" FOR DELETE TO "authenticated" USING (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can delete coach locations" ON "public"."coach_locations" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."coach_memberships" "membership"
  WHERE (("membership"."coach_id" = "coach_locations"."coach_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can delete coach outcomes" ON "public"."coach_outcomes" FOR DELETE TO "authenticated" USING (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can delete coach socials" ON "public"."coach_socials" FOR DELETE TO "authenticated" USING (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can update availability exceptions" ON "public"."coach_availability_exceptions" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_availability_exceptions"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"())) WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_availability_exceptions"."coach_venue_id") AND ("relationship"."status" = 'active'::"text") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can update availability rules" ON "public"."coach_availability_rules" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_availability_rules"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"())) WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_availability_rules"."coach_venue_id") AND ("relationship"."status" = 'active'::"text") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can update availability settings" ON "public"."coach_venue_availability_settings" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_venue_availability_settings"."coach_venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"())) WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."coach_venues" "relationship"
     JOIN "public"."coach_memberships" "membership" ON (("membership"."coach_id" = "relationship"."coach_id")))
  WHERE (("relationship"."id" = "coach_venue_availability_settings"."coach_venue_id") AND ("relationship"."status" = 'active'::"text") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can update coach achievements" ON "public"."coach_achievements" FOR UPDATE TO "authenticated" USING (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can update coach attributes" ON "public"."coach_attributes" FOR UPDATE TO "authenticated" USING (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can update coach images" ON "public"."coach_images" FOR UPDATE TO "authenticated" USING (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can update coach locations" ON "public"."coach_locations" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."coach_memberships" "membership"
  WHERE (("membership"."coach_id" = "coach_locations"."coach_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"())) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."coach_memberships" "membership"
  WHERE (("membership"."coach_id" = "coach_locations"."coach_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Coach members can update coach outcomes" ON "public"."coach_outcomes" FOR UPDATE TO "authenticated" USING (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can update coach socials" ON "public"."coach_socials" FOR UPDATE TO "authenticated" USING (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Coach members can update their coach profile" ON "public"."coaches" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_memberships" "membership"
  WHERE (("membership"."coach_id" = "coaches"."id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."coach_memberships" "membership"
  WHERE (("membership"."coach_id" = "coaches"."id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Invitees can create their accepted admin membership" ON "public"."admin_memberships" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."admin_invitations" "invitation"
  WHERE (("invitation"."email" = "lower"(NULLIF("btrim"(( SELECT ("auth"."jwt"() ->> 'email'::"text"))), ''::"text"))) AND ("invitation"."role" = "admin_memberships"."role") AND ("invitation"."status" = 'pending'::"text") AND ("invitation"."expires_at" > "now"()))))));



CREATE POLICY "Invitees can reactivate their invited admin membership" ON "public"."admin_memberships" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."admin_invitations" "invitation"
  WHERE (("invitation"."email" = "lower"(NULLIF("btrim"(( SELECT ("auth"."jwt"() ->> 'email'::"text"))), ''::"text"))) AND ("invitation"."status" = 'pending'::"text") AND ("invitation"."expires_at" > "now"())))))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."admin_invitations" "invitation"
  WHERE (("invitation"."email" = "lower"(NULLIF("btrim"(( SELECT ("auth"."jwt"() ->> 'email'::"text"))), ''::"text"))) AND ("invitation"."role" = "admin_memberships"."role") AND ("invitation"."status" = 'pending'::"text") AND ("invitation"."expires_at" > "now"()))))));



CREATE POLICY "Invitees can view invitations sent to their email" ON "public"."admin_invitations" FOR SELECT TO "authenticated" USING (("email" = "lower"(NULLIF("btrim"(( SELECT ("auth"."jwt"() ->> 'email'::"text"))), ''::"text"))));



CREATE POLICY "Matching invitees can accept admin invitations" ON "public"."admin_invitations" FOR UPDATE TO "authenticated" USING ((("status" = 'pending'::"text") AND ("expires_at" > "now"()) AND ("email" = "lower"(NULLIF("btrim"(( SELECT ("auth"."jwt"() ->> 'email'::"text"))), ''::"text"))))) WITH CHECK ((("status" = 'accepted'::"text") AND ("accepted_by_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("email" = "lower"(NULLIF("btrim"(( SELECT ("auth"."jwt"() ->> 'email'::"text"))), ''::"text")))));



CREATE POLICY "Members can create coach venue requests" ON "public"."coach_venues" FOR INSERT TO "authenticated" WITH CHECK ((("status" = 'pending'::"text") AND ("requested_by_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ((("initiated_by" = 'coach'::"text") AND ("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (("initiated_by" = 'venue'::"text") AND ("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "Owners can create admin invitations" ON "public"."admin_invitations" FOR INSERT TO "authenticated" WITH CHECK ("private"."has_admin_permission"('team.manage'::"text"));



CREATE POLICY "Owners can create admin memberships" ON "public"."admin_memberships" FOR INSERT TO "authenticated" WITH CHECK ("private"."has_admin_permission"('team.manage'::"text"));



CREATE POLICY "Owners can update admin invitations" ON "public"."admin_invitations" FOR UPDATE TO "authenticated" USING ("private"."has_admin_permission"('team.manage'::"text")) WITH CHECK ("private"."has_admin_permission"('team.manage'::"text"));



CREATE POLICY "Owners can update admin memberships" ON "public"."admin_memberships" FOR UPDATE TO "authenticated" USING ("private"."has_admin_permission"('team.manage'::"text")) WITH CHECK ("private"."has_admin_permission"('team.manage'::"text"));



CREATE POLICY "Owners can view admin audit log" ON "public"."admin_audit_log" FOR SELECT TO "authenticated" USING ("private"."has_admin_permission"('audit.read'::"text"));



CREATE POLICY "Owners can view admin invitations" ON "public"."admin_invitations" FOR SELECT TO "authenticated" USING ("private"."has_admin_permission"('team.manage'::"text"));



CREATE POLICY "Public can read coach socials" ON "public"."coach_socials" FOR SELECT USING (true);



CREATE POLICY "Public can submit new enquiries" ON "public"."enquiries" FOR INSERT TO "authenticated", "anon" WITH CHECK (("status" = 'new'::"text"));



CREATE POLICY "Public can submit pending coach applications" ON "public"."coach_applications" FOR INSERT TO "authenticated", "anon" WITH CHECK (("status" = 'pending'::"text"));



CREATE POLICY "Public can view published availability exceptions" ON "public"."coach_availability_exceptions" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."coach_venue_availability_settings" "settings"
     JOIN "public"."coach_venues" "relationship" ON (("relationship"."id" = "settings"."coach_venue_id")))
  WHERE (("settings"."coach_venue_id" = "coach_availability_exceptions"."coach_venue_id") AND ("settings"."is_public" IS TRUE) AND ("relationship"."status" = 'active'::"text")))));



CREATE POLICY "Public can view published availability rules" ON "public"."coach_availability_rules" FOR SELECT TO "anon" USING ((("is_active" IS TRUE) AND (EXISTS ( SELECT 1
   FROM ("public"."coach_venue_availability_settings" "settings"
     JOIN "public"."coach_venues" "relationship" ON (("relationship"."id" = "settings"."coach_venue_id")))
  WHERE (("settings"."coach_venue_id" = "coach_availability_rules"."coach_venue_id") AND ("settings"."is_public" IS TRUE) AND ("relationship"."status" = 'active'::"text"))))));



CREATE POLICY "Public can view published coach venue availability settings" ON "public"."coach_venue_availability_settings" FOR SELECT TO "anon" USING ((("is_public" IS TRUE) AND (EXISTS ( SELECT 1
   FROM "public"."coach_venues" "relationship"
  WHERE (("relationship"."id" = "coach_venue_availability_settings"."coach_venue_id") AND ("relationship"."status" = 'active'::"text"))))));



CREATE POLICY "Public can view venue images" ON "public"."venue_images" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can view venue socials" ON "public"."venue_socials" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read coach locations" ON "public"."coach_locations" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read coach_achievements" ON "public"."coach_achievements" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read coach_attributes" ON "public"."coach_attributes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read coach_images" ON "public"."coach_images" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read coach_outcomes" ON "public"."coach_outcomes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read coaches" ON "public"."coaches" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read venues" ON "public"."venues" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Relationship members can update workflow status" ON "public"."coach_venues" FOR UPDATE TO "authenticated" USING ((("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((("coach_id" IN ( SELECT "membership"."coach_id"
   FROM "public"."coach_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Requesters and coach members can update booking workflow" ON "public"."coach_booking_requests" FOR UPDATE TO "authenticated" USING ((("requester_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."coach_memberships" "membership"
  WHERE (("membership"."coach_id" = "coach_booking_requests"."coach_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"())) WITH CHECK ((("requester_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."coach_memberships" "membership"
  WHERE (("membership"."coach_id" = "coach_booking_requests"."coach_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Requesters and coach members can view booking requests" ON "public"."coach_booking_requests" FOR SELECT TO "authenticated" USING ((("requester_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."coach_memberships" "membership"
  WHERE (("membership"."coach_id" = "coach_booking_requests"."coach_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



CREATE POLICY "Requesters can create booking requests" ON "public"."coach_booking_requests" FOR INSERT TO "authenticated" WITH CHECK ((("requester_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'requested'::"text")));



CREATE POLICY "Reviewers and support can view coach applications" ON "public"."coach_profile_applications" FOR SELECT TO "authenticated" USING ("private"."has_admin_permission"('applications.read'::"text"));



CREATE POLICY "Reviewers and support can view venue applications" ON "public"."venue_profile_applications" FOR SELECT TO "authenticated" USING ("private"."has_admin_permission"('applications.read'::"text"));



CREATE POLICY "Reviewers can update coach applications" ON "public"."coach_profile_applications" FOR UPDATE TO "authenticated" USING ("private"."has_admin_permission"('applications.review'::"text")) WITH CHECK ("private"."has_admin_permission"('applications.review'::"text"));



CREATE POLICY "Reviewers can update venue applications" ON "public"."venue_profile_applications" FOR UPDATE TO "authenticated" USING ("private"."has_admin_permission"('applications.review'::"text")) WITH CHECK ("private"."has_admin_permission"('applications.review'::"text"));



CREATE POLICY "Support can view booking requests" ON "public"."coach_booking_requests" FOR SELECT TO "authenticated" USING ("private"."has_admin_permission"('bookings.read'::"text"));



CREATE POLICY "Users can add coach application locations" ON "public"."coach_application_locations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."coach_profile_applications" "application"
  WHERE (("application"."id" = "coach_application_locations"."application_id") AND ("application"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("application"."status" = ANY (ARRAY['draft'::"text", 'changes_requested'::"text"]))))));



CREATE POLICY "Users can cancel their account deletion request" ON "public"."account_deletion_requests" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("status" = 'requested'::"text"))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("status" = 'cancelled'::"text")));



CREATE POLICY "Users can create their account deletion request" ON "public"."account_deletion_requests" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("status" = 'requested'::"text")));



CREATE POLICY "Users can create their coach application draft" ON "public"."coach_profile_applications" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("status" = 'draft'::"text") AND ("coach_id" IS NULL)));



CREATE POLICY "Users can create their venue application draft" ON "public"."venue_profile_applications" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("status" = 'draft'::"text") AND ("approved_venue_id" IS NULL) AND ("reviewed_by_user_id" IS NULL)));



CREATE POLICY "Users can delete coach application locations" ON "public"."coach_application_locations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_profile_applications" "application"
  WHERE (("application"."id" = "coach_application_locations"."application_id") AND ("application"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("application"."status" = ANY (ARRAY['draft'::"text", 'changes_requested'::"text"]))))));



CREATE POLICY "Users can delete their coach application drafts" ON "public"."coach_profile_applications" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("status" = 'draft'::"text")));



CREATE POLICY "Users can delete their venue application drafts" ON "public"."venue_profile_applications" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("status" = 'draft'::"text")));



CREATE POLICY "Users can update coach application locations" ON "public"."coach_application_locations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_profile_applications" "application"
  WHERE (("application"."id" = "coach_application_locations"."application_id") AND ("application"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("application"."status" = ANY (ARRAY['draft'::"text", 'changes_requested'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."coach_profile_applications" "application"
  WHERE (("application"."id" = "coach_application_locations"."application_id") AND ("application"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("application"."status" = ANY (ARRAY['draft'::"text", 'changes_requested'::"text"]))))));



CREATE POLICY "Users can update their coach applications" ON "public"."coach_profile_applications" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update their venue applications" ON "public"."venue_profile_applications" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their account deletion requests" ON "public"."account_deletion_requests" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their coach application locations" ON "public"."coach_application_locations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_profile_applications" "application"
  WHERE (("application"."id" = "coach_application_locations"."application_id") AND ("application"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view their coach applications" ON "public"."coach_profile_applications" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own coach memberships" ON "public"."coach_memberships" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view their own venue memberships" ON "public"."venue_memberships" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their venue applications" ON "public"."venue_profile_applications" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Venue members can create venue images" ON "public"."venue_images" FOR INSERT TO "authenticated" WITH CHECK (("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Venue members can create venue socials" ON "public"."venue_socials" FOR INSERT TO "authenticated" WITH CHECK (("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Venue members can delete venue images" ON "public"."venue_images" FOR DELETE TO "authenticated" USING (("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Venue members can delete venue socials" ON "public"."venue_socials" FOR DELETE TO "authenticated" USING (("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Venue members can update their venue" ON "public"."venues" FOR UPDATE TO "authenticated" USING (("id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Venue members can update venue images" ON "public"."venue_images" FOR UPDATE TO "authenticated" USING (("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Venue members can update venue socials" ON "public"."venue_socials" FOR UPDATE TO "authenticated" USING (("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("venue_id" IN ( SELECT "membership"."venue_id"
   FROM "public"."venue_memberships" "membership"
  WHERE ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Venue members can view venue booking blocks" ON "public"."venue_booking_blocks" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."venue_memberships" "membership"
  WHERE (("membership"."venue_id" = "venue_booking_blocks"."venue_id") AND ("membership"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "private"."is_current_user_admin"()));



ALTER TABLE "public"."account_deletion_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_application_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_attributes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_availability_exceptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_availability_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_booking_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_outcomes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_profile_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_socials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_venue_availability_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_venues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coaches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_booking_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_profile_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_socials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "private" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































































































































































































































































































































































































































































































































































































































REVOKE ALL ON FUNCTION "private"."current_admin_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."current_admin_role"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."finalize_approved_coach_application"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."finalize_approved_venue_application"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."handle_new_user"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."has_admin_permission"("permission_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."has_admin_permission"("permission_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."is_current_user_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_current_user_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."prepare_coach_profile_application_update"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."prepare_venue_profile_application_update"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."set_profile_updated_at"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."sync_coach_claimed_state"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."sync_venue_booking_block"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."validate_coach_venue_change"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."accept_admin_invitation"("invitation_token_digest" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_admin_invitation"("invitation_token_digest" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_admin_invitation"("invitation_token_digest" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_listing_search_key"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_listing_search_key"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_listing_search_key"("input" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."account_deletion_requests" TO "anon";
GRANT ALL ON TABLE "public"."account_deletion_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."account_deletion_requests" TO "service_role";



GRANT INSERT("user_id") ON TABLE "public"."account_deletion_requests" TO "authenticated";



GRANT INSERT("status"),UPDATE("status") ON TABLE "public"."account_deletion_requests" TO "authenticated";



GRANT INSERT("reason") ON TABLE "public"."account_deletion_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT INSERT("actor_user_id") ON TABLE "public"."admin_audit_log" TO "authenticated";



GRANT INSERT("actor_role") ON TABLE "public"."admin_audit_log" TO "authenticated";



GRANT INSERT("action") ON TABLE "public"."admin_audit_log" TO "authenticated";



GRANT INSERT("target_type") ON TABLE "public"."admin_audit_log" TO "authenticated";



GRANT INSERT("target_id") ON TABLE "public"."admin_audit_log" TO "authenticated";



GRANT INSERT("details") ON TABLE "public"."admin_audit_log" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."admin_invitations" TO "anon";
GRANT ALL ON TABLE "public"."admin_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_invitations" TO "service_role";



GRANT INSERT("email") ON TABLE "public"."admin_invitations" TO "authenticated";



GRANT INSERT("role") ON TABLE "public"."admin_invitations" TO "authenticated";



GRANT INSERT("token_digest") ON TABLE "public"."admin_invitations" TO "authenticated";



GRANT INSERT("status"),UPDATE("status") ON TABLE "public"."admin_invitations" TO "authenticated";



GRANT INSERT("invited_by_user_id") ON TABLE "public"."admin_invitations" TO "authenticated";



GRANT UPDATE("accepted_by_user_id") ON TABLE "public"."admin_invitations" TO "authenticated";



GRANT INSERT("expires_at") ON TABLE "public"."admin_invitations" TO "authenticated";



GRANT UPDATE("accepted_at") ON TABLE "public"."admin_invitations" TO "authenticated";



GRANT UPDATE("cancelled_at") ON TABLE "public"."admin_invitations" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."admin_invitations" TO "authenticated";



GRANT ALL ON TABLE "public"."admin_memberships" TO "anon";
GRANT ALL ON TABLE "public"."admin_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_memberships" TO "service_role";



GRANT INSERT("user_id") ON TABLE "public"."admin_memberships" TO "authenticated";



GRANT INSERT("role"),UPDATE("role") ON TABLE "public"."admin_memberships" TO "authenticated";



GRANT INSERT("status"),UPDATE("status") ON TABLE "public"."admin_memberships" TO "authenticated";



GRANT INSERT("invited_by_user_id") ON TABLE "public"."admin_memberships" TO "authenticated";



GRANT INSERT("joined_at") ON TABLE "public"."admin_memberships" TO "authenticated";



GRANT INSERT("updated_at"),UPDATE("updated_at") ON TABLE "public"."admin_memberships" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_achievements" TO "service_role";
GRANT SELECT ON TABLE "public"."coach_achievements" TO "anon";
GRANT SELECT,DELETE ON TABLE "public"."coach_achievements" TO "authenticated";



GRANT INSERT("coach_id") ON TABLE "public"."coach_achievements" TO "authenticated";



GRANT INSERT("title"),UPDATE("title") ON TABLE "public"."coach_achievements" TO "authenticated";



GRANT INSERT("description"),UPDATE("description") ON TABLE "public"."coach_achievements" TO "authenticated";



GRANT INSERT("year"),UPDATE("year") ON TABLE "public"."coach_achievements" TO "authenticated";



GRANT INSERT("is_highlight"),UPDATE("is_highlight") ON TABLE "public"."coach_achievements" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_application_locations" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."coach_application_locations" TO "authenticated";



GRANT INSERT("application_id") ON TABLE "public"."coach_application_locations" TO "authenticated";



GRANT INSERT("country"),UPDATE("country") ON TABLE "public"."coach_application_locations" TO "authenticated";



GRANT INSERT("city"),UPDATE("city") ON TABLE "public"."coach_application_locations" TO "authenticated";



GRANT INSERT("is_primary"),UPDATE("is_primary") ON TABLE "public"."coach_application_locations" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_applications" TO "service_role";



GRANT INSERT("status") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("status") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("service_type") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("service_type") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("business_name") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("business_name") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("contact_name") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("contact_name") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("email") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("email") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("phone") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("phone") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("based_in") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("based_in") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("operates_multiple_locations") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("operates_multiple_locations") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("additional_locations") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("additional_locations") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("services_offered") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("services_offered") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("offering_description") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("offering_description") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("player_levels") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("player_levels") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("player_types_specialty") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("player_types_specialty") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("price_range_per_week") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("price_range_per_week") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("accommodation_offered") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("accommodation_offered") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("full_packages_offered") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("full_packages_offered") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("availability_type") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("availability_type") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("seasonal_availability_detail") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("seasonal_availability_detail") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("capacity_per_week") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("capacity_per_week") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("website_url") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("website_url") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("social_media_links") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("social_media_links") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("media_attachments") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("media_attachments") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("achievements") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("achievements") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("special_offer_promoted") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("special_offer_promoted") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("special_offer_description") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("special_offer_description") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("lead_delivery_preference") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("lead_delivery_preference") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("paid_leads_openness") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("paid_leads_openness") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("main_goal") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("main_goal") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT INSERT("raw_payload") ON TABLE "public"."coach_applications" TO "anon";
GRANT INSERT("raw_payload") ON TABLE "public"."coach_applications" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_attributes" TO "service_role";
GRANT SELECT ON TABLE "public"."coach_attributes" TO "anon";
GRANT SELECT ON TABLE "public"."coach_attributes" TO "authenticated";



GRANT INSERT("coach_id") ON TABLE "public"."coach_attributes" TO "authenticated";



GRANT INSERT("audience_adults"),UPDATE("audience_adults") ON TABLE "public"."coach_attributes" TO "authenticated";



GRANT INSERT("audience_juniors"),UPDATE("audience_juniors") ON TABLE "public"."coach_attributes" TO "authenticated";



GRANT INSERT("player_levels"),UPDATE("player_levels") ON TABLE "public"."coach_attributes" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_availability_exceptions" TO "anon";
GRANT ALL ON TABLE "public"."coach_availability_exceptions" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_availability_exceptions" TO "service_role";



GRANT INSERT("coach_venue_id") ON TABLE "public"."coach_availability_exceptions" TO "authenticated";



GRANT INSERT("exception_type"),UPDATE("exception_type") ON TABLE "public"."coach_availability_exceptions" TO "authenticated";



GRANT INSERT("starts_at"),UPDATE("starts_at") ON TABLE "public"."coach_availability_exceptions" TO "authenticated";



GRANT INSERT("ends_at"),UPDATE("ends_at") ON TABLE "public"."coach_availability_exceptions" TO "authenticated";



GRANT INSERT("slot_duration_minutes"),UPDATE("slot_duration_minutes") ON TABLE "public"."coach_availability_exceptions" TO "authenticated";



GRANT SELECT("price_override_minor") ON TABLE "public"."coach_availability_exceptions" TO "anon";
GRANT SELECT("price_override_minor"),INSERT("price_override_minor"),UPDATE("price_override_minor") ON TABLE "public"."coach_availability_exceptions" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_availability_rules" TO "anon";
GRANT ALL ON TABLE "public"."coach_availability_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_availability_rules" TO "service_role";



GRANT INSERT("coach_venue_id") ON TABLE "public"."coach_availability_rules" TO "authenticated";



GRANT INSERT("day_of_week"),UPDATE("day_of_week") ON TABLE "public"."coach_availability_rules" TO "authenticated";



GRANT INSERT("start_time"),UPDATE("start_time") ON TABLE "public"."coach_availability_rules" TO "authenticated";



GRANT INSERT("end_time"),UPDATE("end_time") ON TABLE "public"."coach_availability_rules" TO "authenticated";



GRANT INSERT("slot_duration_minutes"),UPDATE("slot_duration_minutes") ON TABLE "public"."coach_availability_rules" TO "authenticated";



GRANT INSERT("valid_from"),UPDATE("valid_from") ON TABLE "public"."coach_availability_rules" TO "authenticated";



GRANT INSERT("valid_until"),UPDATE("valid_until") ON TABLE "public"."coach_availability_rules" TO "authenticated";



GRANT INSERT("is_active"),UPDATE("is_active") ON TABLE "public"."coach_availability_rules" TO "authenticated";



GRANT SELECT("price_override_minor") ON TABLE "public"."coach_availability_rules" TO "anon";
GRANT SELECT("price_override_minor"),INSERT("price_override_minor"),UPDATE("price_override_minor") ON TABLE "public"."coach_availability_rules" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_booking_requests" TO "anon";
GRANT ALL ON TABLE "public"."coach_booking_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_booking_requests" TO "service_role";



GRANT INSERT("coach_venue_id") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT INSERT("requester_user_id") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT UPDATE("status") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT INSERT("starts_at") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT INSERT("ends_at") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT INSERT("requester_name") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT INSERT("requester_email") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT INSERT("requester_phone") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT INSERT("player_level") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT INSERT("message") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT SELECT("price_amount_minor") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT SELECT("currency") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT SELECT("pricing_source") ON TABLE "public"."coach_booking_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_images" TO "service_role";
GRANT SELECT ON TABLE "public"."coach_images" TO "anon";
GRANT SELECT,DELETE ON TABLE "public"."coach_images" TO "authenticated";



GRANT INSERT("coach_id") ON TABLE "public"."coach_images" TO "authenticated";



GRANT INSERT("image_url"),UPDATE("image_url") ON TABLE "public"."coach_images" TO "authenticated";



GRANT INSERT("is_primary"),UPDATE("is_primary") ON TABLE "public"."coach_images" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."coach_images" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."coach_images" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_locations" TO "anon";
GRANT ALL ON TABLE "public"."coach_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_locations" TO "service_role";



GRANT INSERT("coach_id") ON TABLE "public"."coach_locations" TO "authenticated";



GRANT INSERT("country"),UPDATE("country") ON TABLE "public"."coach_locations" TO "authenticated";



GRANT INSERT("city"),UPDATE("city") ON TABLE "public"."coach_locations" TO "authenticated";



GRANT INSERT("is_primary"),UPDATE("is_primary") ON TABLE "public"."coach_locations" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_memberships" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."coach_memberships" TO "authenticated";



GRANT INSERT("coach_id") ON TABLE "public"."coach_memberships" TO "authenticated";



GRANT INSERT("user_id") ON TABLE "public"."coach_memberships" TO "authenticated";



GRANT INSERT("membership_role"),UPDATE("membership_role") ON TABLE "public"."coach_memberships" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_outcomes" TO "service_role";
GRANT SELECT ON TABLE "public"."coach_outcomes" TO "anon";
GRANT SELECT,DELETE ON TABLE "public"."coach_outcomes" TO "authenticated";



GRANT INSERT("coach_id") ON TABLE "public"."coach_outcomes" TO "authenticated";



GRANT INSERT("outcome"),UPDATE("outcome") ON TABLE "public"."coach_outcomes" TO "authenticated";



GRANT INSERT("outcome_key"),UPDATE("outcome_key") ON TABLE "public"."coach_outcomes" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_profile_applications" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("user_id") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("status"),UPDATE("status") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("current_step"),UPDATE("current_step") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("full_name"),UPDATE("full_name") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("phone"),UPDATE("phone") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("coaching_role"),UPDATE("coaching_role") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("coaching_role_other"),UPDATE("coaching_role_other") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("experience_years"),UPDATE("experience_years") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("description"),UPDATE("description") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("player_levels"),UPDATE("player_levels") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("audiences"),UPDATE("audiences") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("outcomes"),UPDATE("outcomes") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("terms_accepted_at"),UPDATE("terms_accepted_at") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT INSERT("privacy_accepted_at"),UPDATE("privacy_accepted_at") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT UPDATE("coach_id") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT UPDATE("reviewed_at") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT UPDATE("reviewed_by_user_id") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT UPDATE("review_note") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT SELECT("application_mode"),INSERT("application_mode") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT SELECT("target_coach_id"),INSERT("target_coach_id") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT SELECT("applicant_email") ON TABLE "public"."coach_profile_applications" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_socials" TO "service_role";
GRANT SELECT ON TABLE "public"."coach_socials" TO "anon";
GRANT SELECT,DELETE ON TABLE "public"."coach_socials" TO "authenticated";



GRANT INSERT("coach_id") ON TABLE "public"."coach_socials" TO "authenticated";



GRANT INSERT("platform"),UPDATE("platform") ON TABLE "public"."coach_socials" TO "authenticated";



GRANT INSERT("url"),UPDATE("url") ON TABLE "public"."coach_socials" TO "authenticated";



GRANT INSERT("is_primary"),UPDATE("is_primary") ON TABLE "public"."coach_socials" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_venue_availability_settings" TO "anon";
GRANT ALL ON TABLE "public"."coach_venue_availability_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_venue_availability_settings" TO "service_role";



GRANT INSERT("coach_venue_id") ON TABLE "public"."coach_venue_availability_settings" TO "authenticated";



GRANT INSERT("timezone"),UPDATE("timezone") ON TABLE "public"."coach_venue_availability_settings" TO "authenticated";



GRANT INSERT("default_slot_duration_minutes"),UPDATE("default_slot_duration_minutes") ON TABLE "public"."coach_venue_availability_settings" TO "authenticated";



GRANT INSERT("is_public"),UPDATE("is_public") ON TABLE "public"."coach_venue_availability_settings" TO "authenticated";



GRANT SELECT("currency") ON TABLE "public"."coach_venue_availability_settings" TO "anon";
GRANT SELECT("currency"),INSERT("currency"),UPDATE("currency") ON TABLE "public"."coach_venue_availability_settings" TO "authenticated";



GRANT SELECT("default_hourly_rate_minor") ON TABLE "public"."coach_venue_availability_settings" TO "anon";
GRANT SELECT("default_hourly_rate_minor"),INSERT("default_hourly_rate_minor"),UPDATE("default_hourly_rate_minor") ON TABLE "public"."coach_venue_availability_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."coach_venues" TO "service_role";
GRANT SELECT ON TABLE "public"."coach_venues" TO "anon";
GRANT SELECT ON TABLE "public"."coach_venues" TO "authenticated";



GRANT INSERT("coach_id") ON TABLE "public"."coach_venues" TO "authenticated";



GRANT INSERT("venue_id") ON TABLE "public"."coach_venues" TO "authenticated";



GRANT INSERT("is_primary"),UPDATE("is_primary") ON TABLE "public"."coach_venues" TO "authenticated";



GRANT INSERT("status"),UPDATE("status") ON TABLE "public"."coach_venues" TO "authenticated";



GRANT INSERT("initiated_by") ON TABLE "public"."coach_venues" TO "authenticated";



GRANT ALL ON TABLE "public"."coaches" TO "service_role";
GRANT SELECT ON TABLE "public"."coaches" TO "anon";
GRANT SELECT ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("name"),UPDATE("name") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("role"),UPDATE("role") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("description"),UPDATE("description") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("image_url"),UPDATE("image_url") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("slug") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("level"),UPDATE("level") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("experience_years"),UPDATE("experience_years") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("travel_available"),UPDATE("travel_available") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("price_from"),UPDATE("price_from") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("email"),UPDATE("email") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("phone"),UPDATE("phone") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("source") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("is_approved") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("data_quality_status") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("reviewed_at") ON TABLE "public"."coaches" TO "authenticated";



GRANT INSERT("reviewed_by") ON TABLE "public"."coaches" TO "authenticated";



GRANT SELECT("is_claimed") ON TABLE "public"."coaches" TO "anon";
GRANT SELECT("is_claimed") ON TABLE "public"."coaches" TO "authenticated";



GRANT ALL ON TABLE "public"."enquiries" TO "service_role";



GRANT INSERT("coach_id") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("coach_id") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("venue_id") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("venue_id") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("full_name") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("full_name") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("email") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("email") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("phone") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("phone") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("age") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("age") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("nationality") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("nationality") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("playing_level") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("playing_level") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("playing_duration") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("playing_duration") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("main_goals") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("main_goals") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("goals_detail") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("goals_detail") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("preferred_destinations") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("preferred_destinations") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("preferred_duration") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("preferred_duration") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("preferred_start_date") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("preferred_start_date") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("training_type") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("training_type") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("budget_range") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("budget_range") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("accommodation") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("accommodation") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("trained_abroad") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("trained_abroad") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("injuries") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("injuries") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("anything_else") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("anything_else") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("current_location_country") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("current_location_country") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("current_location_city") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("current_location_city") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("wants_personalised_recommendation") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("wants_personalised_recommendation") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("status") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("status") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("subject_type") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("subject_type") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("subject_name") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("subject_name") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("subject_slug") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("subject_slug") ON TABLE "public"."enquiries" TO "authenticated";



GRANT INSERT("source_url") ON TABLE "public"."enquiries" TO "anon";
GRANT INSERT("source_url") ON TABLE "public"."enquiries" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("last_workspace_type"),UPDATE("last_workspace_type") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("last_workspace_entity_id"),UPDATE("last_workspace_entity_id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("avatar_path"),UPDATE("avatar_path") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("avatar_updated_at"),UPDATE("avatar_updated_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."venue_booking_blocks" TO "anon";
GRANT ALL ON TABLE "public"."venue_booking_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."venue_booking_blocks" TO "service_role";



GRANT SELECT("booking_request_id") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("coach_venue_id") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("coach_id") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("venue_id") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("starts_at") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("ends_at") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("timezone") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("price_amount_minor") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("currency") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("requested_at") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("responded_at") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("cancelled_at") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("completed_at") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."venue_booking_blocks" TO "authenticated";



GRANT ALL ON TABLE "public"."venue_images" TO "service_role";
GRANT SELECT ON TABLE "public"."venue_images" TO "anon";
GRANT SELECT,DELETE ON TABLE "public"."venue_images" TO "authenticated";



GRANT INSERT("venue_id") ON TABLE "public"."venue_images" TO "authenticated";



GRANT INSERT("url"),UPDATE("url") ON TABLE "public"."venue_images" TO "authenticated";



GRANT INSERT("is_primary"),UPDATE("is_primary") ON TABLE "public"."venue_images" TO "authenticated";



GRANT ALL ON TABLE "public"."venue_memberships" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."venue_memberships" TO "authenticated";



GRANT INSERT("venue_id") ON TABLE "public"."venue_memberships" TO "authenticated";



GRANT INSERT("user_id") ON TABLE "public"."venue_memberships" TO "authenticated";



GRANT INSERT("membership_role"),UPDATE("membership_role") ON TABLE "public"."venue_memberships" TO "authenticated";



GRANT ALL ON TABLE "public"."venue_profile_applications" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("user_id") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("status"),UPDATE("status") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("current_step"),UPDATE("current_step") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("application_mode"),UPDATE("application_mode") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("relationship_to_venue"),UPDATE("relationship_to_venue") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("target_venue_id"),UPDATE("target_venue_id") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("proposed_venue_name"),UPDATE("proposed_venue_name") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("proposed_country"),UPDATE("proposed_country") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("proposed_city"),UPDATE("proposed_city") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("proposed_address"),UPDATE("proposed_address") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("proposed_website"),UPDATE("proposed_website") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("phone"),UPDATE("phone") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("supporting_note"),UPDATE("supporting_note") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("terms_accepted_at"),UPDATE("terms_accepted_at") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT INSERT("privacy_accepted_at"),UPDATE("privacy_accepted_at") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT UPDATE("approved_venue_id") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT UPDATE("approved_membership_role") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT UPDATE("reviewed_at") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT UPDATE("reviewed_by_user_id") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT UPDATE("review_note") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT SELECT("applicant_email") ON TABLE "public"."venue_profile_applications" TO "authenticated";



GRANT ALL ON TABLE "public"."venue_socials" TO "service_role";
GRANT SELECT ON TABLE "public"."venue_socials" TO "anon";
GRANT SELECT,DELETE ON TABLE "public"."venue_socials" TO "authenticated";



GRANT INSERT("venue_id") ON TABLE "public"."venue_socials" TO "authenticated";



GRANT INSERT("platform"),UPDATE("platform") ON TABLE "public"."venue_socials" TO "authenticated";



GRANT INSERT("url"),UPDATE("url") ON TABLE "public"."venue_socials" TO "authenticated";



GRANT INSERT("is_primary"),UPDATE("is_primary") ON TABLE "public"."venue_socials" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."venue_socials_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."venue_socials_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."venue_socials_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "service_role";
GRANT SELECT ON TABLE "public"."venues" TO "anon";
GRANT SELECT ON TABLE "public"."venues" TO "authenticated";



GRANT INSERT("name"),UPDATE("name") ON TABLE "public"."venues" TO "authenticated";



GRANT INSERT("city"),UPDATE("city") ON TABLE "public"."venues" TO "authenticated";



GRANT INSERT("country"),UPDATE("country") ON TABLE "public"."venues" TO "authenticated";



GRANT INSERT("website"),UPDATE("website") ON TABLE "public"."venues" TO "authenticated";



GRANT UPDATE("image_url") ON TABLE "public"."venues" TO "authenticated";



GRANT UPDATE("courts") ON TABLE "public"."venues" TO "authenticated";



GRANT UPDATE("court_type") ON TABLE "public"."venues" TO "authenticated";



GRANT UPDATE("coaching_available") ON TABLE "public"."venues" TO "authenticated";



GRANT UPDATE("price") ON TABLE "public"."venues" TO "authenticated";



GRANT UPDATE("coaching_description") ON TABLE "public"."venues" TO "authenticated";



GRANT UPDATE("venue_type") ON TABLE "public"."venues" TO "authenticated";



GRANT INSERT("phone"),UPDATE("phone") ON TABLE "public"."venues" TO "authenticated";



GRANT UPDATE("opening_hours") ON TABLE "public"."venues" TO "authenticated";



GRANT INSERT("address"),UPDATE("address") ON TABLE "public"."venues" TO "authenticated";



GRANT INSERT("source"),UPDATE("source") ON TABLE "public"."venues" TO "authenticated";



GRANT INSERT("is_approved"),UPDATE("is_approved") ON TABLE "public"."venues" TO "authenticated";



GRANT INSERT("data_quality_status"),UPDATE("data_quality_status") ON TABLE "public"."venues" TO "authenticated";



GRANT INSERT("reviewed_at"),UPDATE("reviewed_at") ON TABLE "public"."venues" TO "authenticated";



GRANT INSERT("reviewed_by"),UPDATE("reviewed_by") ON TABLE "public"."venues" TO "authenticated";



GRANT UPDATE("opening_hours_structured") ON TABLE "public"."venues" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































