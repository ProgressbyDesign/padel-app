-- Coach application approval: bind membership, seed gaps, never publish.
--
-- Pass 1 of the admin review simplification introduces "Use existing profile"
-- for create_new applications that match an existing coach. Previously
-- private.finalize_approved_coach_application() replaced the linked coach's
-- name, role, description, experience, phone, locations, outcomes and
-- attributes with the application's values on every approval, and also set
-- the coach to published.
--
-- Now, for application_mode = 'create_new', approval only fills fields the
-- coach does not already have and only seeds locations / outcomes /
-- attributes when the coach has none. A coach freshly created from the
-- application is unchanged by this (its fields are empty or already carry the
-- application values). Historical claim_existing approvals keep their
-- existing behaviour of applying the proposed changes to the claimed profile.
--
-- Approval never writes publication_status. New and private coaches stay
-- private; a coach that is already published stays published. Dedicated
-- publication controls are unchanged.
--
-- Unchanged on purpose: owner membership creation, review metadata,
-- is_approved and the workspace default.
create or replace function private.coach_outcome_label(outcome_key text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case outcome_key
    when 'learn_fundamentals' then 'Learn padel fundamentals'
    when 'improve_technique' then 'Improve technique'
    when 'improve_match_tactics' then 'Improve match tactics'
    when 'prepare_for_competition' then 'Prepare for competition'
    when 'build_confidence' then 'Build confidence'
    when 'improve_fitness_movement' then 'Improve fitness and movement'
    when 'junior_development' then 'Junior player development'
    when 'high_performance_development' then 'High-performance development'
  end;
$function$;

revoke all on function private.coach_outcome_label(text) from public, anon, authenticated;

create or replace function private.finalize_approved_coach_application()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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

    if new.application_mode = 'claim_existing' then
      -- Historical claims: apply the reviewed "proposed" details to the
      -- claimed profile (unchanged behaviour).
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
      select new.coach_id, outcome_key, private.coach_outcome_label(outcome_key)
      from unnest(new.outcomes) as outcome_key;

      delete from public.coach_locations
      where coach_id = new.coach_id;

      insert into public.coach_locations (coach_id, country, city, is_primary)
      select new.coach_id, location.country, btrim(location.city), location.is_primary
      from public.coach_application_locations location
      where location.application_id = new.id;
    else
      -- New applications: fill gaps only. Existing profile content wins.
      update public.coaches
      set name = coalesce(nullif(btrim(name), ''), btrim(new.full_name)),
          role = coalesce(nullif(btrim(role), ''), role_label),
          description = coalesce(nullif(btrim(description), ''), nullif(btrim(new.description), '')),
          experience_years = coalesce(experience_years, new.experience_years),
          phone = coalesce(nullif(btrim(phone), ''), btrim(new.phone)),
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
      on conflict (coach_id) do nothing;

      if not exists (
        select 1 from public.coach_outcomes outcome
        where outcome.coach_id = new.coach_id
      ) then
        insert into public.coach_outcomes (coach_id, outcome_key, outcome)
        select new.coach_id, outcome_key, private.coach_outcome_label(outcome_key)
        from unnest(new.outcomes) as outcome_key;
      end if;

      if not exists (
        select 1 from public.coach_locations location
        where location.coach_id = new.coach_id
      ) then
        insert into public.coach_locations (coach_id, country, city, is_primary)
        select new.coach_id, location.country, btrim(location.city), location.is_primary
        from public.coach_application_locations location
        where location.application_id = new.id;
      end if;
    end if;

    update public.profiles
    set last_workspace_type = 'coach',
        last_workspace_entity_id = new.coach_id,
        updated_at = now()
    where id = new.user_id
      and last_workspace_type is null;
  end if;

  return new;
end;
$function$;

comment on function private.finalize_approved_coach_application() is
  'On approval: grant owner membership and seed the coach profile. create_new approvals fill gaps only (existing profile content is preserved); claim_existing approvals apply the proposed details. Does not change publication_status.';

-- Reviewers need to see where an applicant coaches. Until now only the
-- applicant could read coach_application_locations, so the admin review page
-- rendered an empty Locations card and duplicate detection could not use
-- location. Read-only, scoped to the same permission as the applications.
drop policy if exists "Reviewers and support can view coach application locations"
  on public.coach_application_locations;
create policy "Reviewers and support can view coach application locations"
  on public.coach_application_locations
  for select
  to authenticated
  using (private.has_admin_permission('applications.read'));
