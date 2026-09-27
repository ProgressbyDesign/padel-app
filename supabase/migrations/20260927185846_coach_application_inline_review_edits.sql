-- Pass 2: narrow, invoker-only card edits. No coach/profile/approval changes.
-- Reviewer location writes were not supported by the existing owner-only RLS.
-- All saves lock the parent, compare its revision and audit in one transaction.

create function private.lock_coach_application_for_review_edit(p_application_id uuid, p_expected_updated_at timestamptz)
returns public.coach_profile_applications
language plpgsql security invoker set search_path = '' as $$
declare application public.coach_profile_applications;
begin
  if auth.uid() is null or not private.has_admin_permission('applications.review') then
    raise exception 'Application review permission required.' using errcode = '42501';
  end if;
  select * into application from public.coach_profile_applications
    where id = p_application_id for update;
  if not found or application.status not in ('submitted', 'under_review', 'changes_requested') then
    raise exception 'Application is not editable.' using errcode = '42501';
  end if;
  if application.updated_at is distinct from p_expected_updated_at then
    raise exception 'Application changed. Reload before editing.' using errcode = '40001';
  end if;
  return application;
end;
$$;

create function private.audit_coach_application_card_edit(p_application_id uuid, p_action text, p_changed_fields text[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.has_admin_permission('applications.review') or p_action not in (
    'coach_application.applicant_details_updated', 'coach_application.locations_updated',
    'coach_application.coaching_profile_updated'
  ) then
    raise exception 'Application review permission required.' using errcode = '42501';
  end if;
  insert into public.admin_audit_log(actor_user_id, actor_role, action, target_type, target_id, details)
    values(auth.uid(), private.current_admin_role(), p_action, 'coach_profile_application', p_application_id,
      jsonb_build_object('changedFields', to_jsonb(p_changed_fields)));
end;
$$;

create function public.admin_update_coach_application_applicant(
  p_application_id uuid, p_expected_updated_at timestamptz,
  p_full_name text, p_phone text, p_coaching_role text, p_coaching_role_other text, p_experience_years integer
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  previous public.coach_profile_applications;
  current_row public.coach_profile_applications;
  changed_fields text[];
begin
  previous := private.lock_coach_application_for_review_edit(p_application_id, p_expected_updated_at);
  if nullif(btrim(p_full_name), '') is null or nullif(btrim(p_phone), '') is null
    or p_coaching_role is null or p_experience_years is null then
    raise exception 'Required applicant details are missing.' using errcode = '23514';
  end if;
  -- Existing constraints enforce role choices, field lengths and experience range.
  update public.coach_profile_applications set
    full_name = btrim(p_full_name), phone = btrim(p_phone), coaching_role = p_coaching_role,
    coaching_role_other = case when p_coaching_role = 'other' then nullif(btrim(p_coaching_role_other), '') else null end,
    experience_years = p_experience_years
  where id = p_application_id returning * into current_row;
  select coalesce(array_agg(key order by key), array[]::text[]) into changed_fields
    from jsonb_each(to_jsonb(current_row))
    where key = any(array['full_name','phone','coaching_role','coaching_role_other','experience_years'])
      and value is distinct from to_jsonb(previous) -> key;
  perform private.audit_coach_application_card_edit(p_application_id,
    'coach_application.applicant_details_updated', changed_fields);
end;
$$;

create function public.admin_update_coach_application_profile(
  p_application_id uuid, p_expected_updated_at timestamptz,
  p_description text, p_player_levels text[], p_audiences text[], p_outcomes text[]
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  previous public.coach_profile_applications;
  current_row public.coach_profile_applications;
  changed_fields text[];
begin
  previous := private.lock_coach_application_for_review_edit(p_application_id, p_expected_updated_at);
  if coalesce(cardinality(p_player_levels),0) = 0 or coalesce(cardinality(p_audiences),0) = 0
    or coalesce(cardinality(p_outcomes),0) = 0 then
    raise exception 'Select levels, audiences and outcomes.' using errcode = '23514';
  end if;
  -- Existing constraints enforce controlled keys and optional introduction length.
  update public.coach_profile_applications set
    description = nullif(btrim(p_description), ''), player_levels = p_player_levels,
    audiences = p_audiences, outcomes = p_outcomes
  where id = p_application_id returning * into current_row;
  select coalesce(array_agg(key order by key), array[]::text[]) into changed_fields
    from jsonb_each(to_jsonb(current_row))
    where key = any(array['description','player_levels','audiences','outcomes'])
      and value is distinct from to_jsonb(previous) -> key;
  perform private.audit_coach_application_card_edit(p_application_id,
    'coach_application.coaching_profile_updated', changed_fields);
end;
$$;

-- Keep applicant policies; add only active reviewer location permissions.
create policy "Reviewers can insert active coach application locations"
on public.coach_application_locations for insert to authenticated with check (
  private.has_admin_permission('applications.review') and exists (
    select 1 from public.coach_profile_applications a where a.id = application_id
      and a.status in ('submitted','under_review','changes_requested')
  )
);
create policy "Reviewers can delete active coach application locations"
on public.coach_application_locations for delete to authenticated using (
  private.has_admin_permission('applications.review') and exists (
    select 1 from public.coach_profile_applications a where a.id = application_id
      and a.status in ('submitted','under_review','changes_requested')
  )
);

-- Serialize location writes (including applicant writes) with review decisions
-- and invalidate stale card revisions. Recheck status after acquiring the lock.
create function private.guard_coach_application_location_edit()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  application public.coach_profile_applications;
  application_id uuid;
begin
  application_id := case when tg_op = 'DELETE' then old.application_id else new.application_id end;
  if tg_op = 'UPDATE' and old.application_id is distinct from new.application_id then
    raise exception 'Location application cannot change.' using errcode = '42501';
  end if;
  select * into application from public.coach_profile_applications where id = application_id for update;
  -- Parent deletion cascades are not edits; preserve existing draft removal.
  if not found and tg_op = 'DELETE' then return old; end if;
  if not found or not (
    (private.has_admin_permission('applications.review') and application.status in ('submitted','under_review','changes_requested'))
    or (application.user_id = auth.uid() and application.application_mode = 'create_new'
      and application.status in ('draft','changes_requested'))
  ) then
    raise exception 'Application locations are not editable.' using errcode = '42501';
  end if;
  update public.coach_profile_applications set updated_at = now() where id = application_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_coach_application_location_edit
  before insert or update or delete on public.coach_application_locations
  for each row execute function private.guard_coach_application_location_edit();

create function public.admin_update_coach_application_locations(
  p_application_id uuid, p_expected_updated_at timestamptz, p_locations jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  previous_locations jsonb;
  normalized_locations jsonb;
  changed_fields text[];
begin
  perform private.lock_coach_application_for_review_edit(p_application_id, p_expected_updated_at);
  if p_locations is null or jsonb_typeof(p_locations) <> 'array' then
    raise exception 'Locations must be an array.' using errcode = '23514';
  end if;
  if jsonb_array_length(p_locations) not between 1 and 10 then
    raise exception 'Provide one to ten locations.' using errcode = '23514';
  end if;
  if exists(select 1 from jsonb_array_elements(p_locations) row where
    jsonb_typeof(row) <> 'object' or jsonb_typeof(row->'country') is distinct from 'string'
    or jsonb_typeof(row->'city') is distinct from 'string'
    or jsonb_typeof(row->'is_primary') is distinct from 'boolean'
    or (row - 'country' - 'city' - 'is_primary') <> '{}'::jsonb
  ) then
    raise exception 'Invalid location fields.' using errcode = '23514';
  end if;
  if (select count(*) from jsonb_array_elements(p_locations) row where (row->>'is_primary')::boolean) <> 1
    or exists(select 1 from jsonb_array_elements(p_locations) row
      group by lower(btrim(row->>'country')), lower(btrim(row->>'city')) having count(*) > 1) then
    raise exception 'Choose exactly one primary location and remove duplicates.' using errcode = '23514';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('country', country, 'city', city, 'is_primary', is_primary)
    order by country, city), '[]'::jsonb) into previous_locations
    from public.coach_application_locations where application_id = p_application_id;
  select jsonb_agg(jsonb_build_object('country', btrim(row->>'country'), 'city', btrim(row->>'city'),
    'is_primary', (row->>'is_primary')::boolean) order by btrim(row->>'country'), btrim(row->>'city'))
    into normalized_locations from jsonb_array_elements(p_locations) row;
  changed_fields := case when previous_locations is distinct from normalized_locations then array['locations'] else array[]::text[] end;
  if cardinality(changed_fields) > 0 then
    delete from public.coach_application_locations where application_id = p_application_id;
    insert into public.coach_application_locations(application_id, country, city, is_primary, created_at)
      select p_application_id, btrim(row->>'country'), btrim(row->>'city'), (row->>'is_primary')::boolean,
        now() + (ordinality - 1) * interval '1 microsecond'
      from jsonb_array_elements(p_locations) with ordinality as items(row, ordinality);
  end if;
  perform private.audit_coach_application_card_edit(p_application_id, 'coach_application.locations_updated', changed_fields);
end;
$$;

revoke all on function private.lock_coach_application_for_review_edit(uuid,timestamptz) from public, anon;
revoke all on function private.audit_coach_application_card_edit(uuid,text,text[]) from public, anon;
revoke all on function private.guard_coach_application_location_edit() from public, anon, authenticated;
revoke all on function public.admin_update_coach_application_applicant(uuid,timestamptz,text,text,text,text,integer) from public, anon;
revoke all on function public.admin_update_coach_application_profile(uuid,timestamptz,text,text[],text[],text[]) from public, anon;
revoke all on function public.admin_update_coach_application_locations(uuid,timestamptz,jsonb) from public, anon;
grant execute on function private.lock_coach_application_for_review_edit(uuid,timestamptz),
  private.audit_coach_application_card_edit(uuid,text,text[]) to authenticated;
grant execute on function public.admin_update_coach_application_applicant(uuid,timestamptz,text,text,text,text,integer),
  public.admin_update_coach_application_profile(uuid,timestamptz,text,text[],text[],text[]),
  public.admin_update_coach_application_locations(uuid,timestamptz,jsonb) to authenticated;
