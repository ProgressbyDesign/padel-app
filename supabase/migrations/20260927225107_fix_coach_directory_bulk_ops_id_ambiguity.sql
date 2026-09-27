-- Rename PL/pgSQL loop variables so they do not shadow coach_memberships.coach_id.

create or replace function public.admin_set_coach_verification(
  p_coach_ids uuid[],
  p_verified boolean
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  actor_label text;
  requested uuid[];
  target_coach_id uuid;
  current_approved boolean;
  updated_ids uuid[] := '{}';
  already_ids uuid[] := '{}';
  missing_ids uuid[] := '{}';
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not private.has_admin_permission('profiles.manage') then
    raise exception 'Only administrators with profiles.manage may change coach verification.'
      using errcode = '42501';
  end if;

  select array_agg(distinct requested_id)
  into requested
  from unnest(coalesce(p_coach_ids, '{}')) as requested_id
  where requested_id is not null;

  if requested is null or cardinality(requested) = 0 then
    raise exception 'Select at least one coach.' using errcode = '22023';
  end if;

  if cardinality(requested) > 100 then
    raise exception 'Too many coaches selected. Choose up to 100 at a time.'
      using errcode = '22023';
  end if;

  actor_label := caller_id::text;

  foreach target_coach_id in array requested loop
    select coach.is_approved
    into current_approved
    from public.coaches coach
    where coach.id = target_coach_id
    for update;

    if not found then
      missing_ids := array_append(missing_ids, target_coach_id);
      continue;
    end if;

    if current_approved is not distinct from p_verified then
      already_ids := array_append(already_ids, target_coach_id);
      continue;
    end if;

    if p_verified then
      update public.coaches
      set is_approved = true,
          data_quality_status = 'reviewed',
          reviewed_at = now(),
          reviewed_by = actor_label
      where id = target_coach_id;
    else
      update public.coaches
      set is_approved = false,
          data_quality_status = 'needs_review',
          reviewed_at = now(),
          reviewed_by = actor_label
      where id = target_coach_id;
    end if;

    updated_ids := array_append(updated_ids, target_coach_id);
  end loop;

  return jsonb_build_object(
    'updatedIds', to_jsonb(updated_ids),
    'alreadyIds', to_jsonb(already_ids),
    'missingIds', to_jsonb(missing_ids)
  );
end;
$function$;

create or replace function public.admin_unclaim_coaches(p_coach_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  requested uuid[];
  target_coach_id uuid;
  membership_count integer;
  updated_ids uuid[] := '{}';
  already_ids uuid[] := '{}';
  missing_ids uuid[] := '{}';
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not private.has_admin_permission('profiles.manage') then
    raise exception 'Only administrators with profiles.manage may unclaim coach profiles.'
      using errcode = '42501';
  end if;

  select array_agg(distinct requested_id)
  into requested
  from unnest(coalesce(p_coach_ids, '{}')) as requested_id
  where requested_id is not null;

  if requested is null or cardinality(requested) = 0 then
    raise exception 'Select at least one coach.' using errcode = '22023';
  end if;

  if cardinality(requested) > 100 then
    raise exception 'Too many coaches selected. Choose up to 100 at a time.'
      using errcode = '22023';
  end if;

  foreach target_coach_id in array requested loop
    perform 1
    from public.coaches coach
    where coach.id = target_coach_id
    for update;

    if not found then
      missing_ids := array_append(missing_ids, target_coach_id);
      continue;
    end if;

    select count(*)
    into membership_count
    from public.coach_memberships membership
    where membership.coach_id = target_coach_id;

    if membership_count = 0 then
      already_ids := array_append(already_ids, target_coach_id);
      continue;
    end if;

    delete from public.coach_memberships membership
    where membership.coach_id = target_coach_id;

    updated_ids := array_append(updated_ids, target_coach_id);
  end loop;

  return jsonb_build_object(
    'updatedIds', to_jsonb(updated_ids),
    'alreadyIds', to_jsonb(already_ids),
    'missingIds', to_jsonb(missing_ids)
  );
end;
$function$;
