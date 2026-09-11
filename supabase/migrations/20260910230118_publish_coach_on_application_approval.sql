-- Publish only on the transition to approved, in the existing approval transaction.
-- Existing private or suspended profiles are not retroactively published.
CREATE OR REPLACE FUNCTION private.finalize_approved_coach_application()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        publication_status = 'published',
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
$function$;
