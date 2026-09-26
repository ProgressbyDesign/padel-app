-- Regression: approving a create_new application against an EXISTING coach
-- ("Use existing profile") must grant membership without overwriting the
-- coach's content, while a coach created from the application is still seeded.
-- Requires 20260926120000_separate_coach_approval_from_publication.sql.
-- Run on a local/disposable database: BEGIN; <this file>; ROLLBACK;
begin;
do $test$
declare
  admin_id uuid;
  applicant_id uuid := gen_random_uuid();
  applicant2_id uuid := gen_random_uuid();
  applicant3_id uuid := gen_random_uuid();
  existing_coach_id uuid;
  fresh_coach_id uuid;
  published_coach_id uuid;
  existing_app_id uuid;
  fresh_app_id uuid;
  published_app_id uuid;
  coach record;
  visible_locations int;
begin
  select user_id into admin_id
  from public.admin_memberships where status = 'active' and role = 'owner' limit 1;
  if admin_id is null then raise exception 'Test requires an active owner'; end if;

  insert into auth.users (id, email) values (applicant_id, 'existing-preserve@example.invalid');
  insert into auth.users (id, email) values (applicant2_id, 'fresh-seed@example.invalid');
  insert into auth.users (id, email) values (applicant3_id, 'already-published@example.invalid');

  -- An imported coach with real content.
  insert into public.coaches (name, role, description, experience_years, phone, source)
  values ('Juan Martín', 'Professional Coach', 'Existing description', 12, '+34 600 000 000', 'crawler')
  returning id into existing_coach_id;
  insert into public.coach_locations (coach_id, country, city, is_primary)
  values (existing_coach_id, 'Spain', 'Marbella', true);
  insert into public.coach_outcomes (coach_id, outcome_key, outcome)
  values (existing_coach_id, 'improve_technique', 'Improve technique');
  insert into public.coach_attributes (coach_id, audience_adults, audience_juniors, player_levels)
  values (existing_coach_id, true, false, array['advanced']);

  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);

  insert into public.coach_profile_applications
    (user_id, applicant_email, status, application_mode, full_name, phone, coaching_role,
     experience_years, description, player_levels, audiences, outcomes)
  values
    (applicant_id, 'existing-preserve@example.invalid', 'submitted', 'create_new', 'Juan Martin',
     '123456789', 'padel_coach', 2, 'Application description that is long enough to satisfy validation.',
     array['beginner'], array['juniors'], array['learn_fundamentals'])
  returning id into existing_app_id;
  insert into public.coach_application_locations (application_id, country, city, is_primary)
  values (existing_app_id, 'Spain', 'Madrid', true);

  -- 1. "Use existing profile": approve against the imported coach.
  update public.coach_profile_applications
  set status = 'approved', coach_id = existing_coach_id
  where id = existing_app_id;

  select * into coach from public.coaches where id = existing_coach_id;
  if coach.name <> 'Juan Martín' or coach.role <> 'Professional Coach'
     or coach.description <> 'Existing description' or coach.experience_years <> 12
     or coach.phone <> '+34 600 000 000' then
    raise exception 'Existing coach content was overwritten: % / % / % / % / %',
      coach.name, coach.role, coach.description, coach.experience_years, coach.phone;
  end if;
  if not coach.is_approved then raise exception 'Existing coach not marked approved'; end if;
  if coach.publication_status <> 'private' then
    raise exception 'Approval published a previously private existing coach';
  end if;
  if (select count(*) from public.coach_locations where coach_id = existing_coach_id) <> 1
     or not exists (select 1 from public.coach_locations where coach_id = existing_coach_id and city = 'Marbella') then
    raise exception 'Existing coach locations were replaced';
  end if;
  if (select count(*) from public.coach_outcomes where coach_id = existing_coach_id) <> 1
     or not exists (select 1 from public.coach_outcomes where coach_id = existing_coach_id and outcome_key = 'improve_technique') then
    raise exception 'Existing coach outcomes were replaced';
  end if;
  if (select player_levels from public.coach_attributes where coach_id = existing_coach_id) <> array['advanced'] then
    raise exception 'Existing coach attributes were replaced';
  end if;
  if not exists (
    select 1 from public.coach_memberships
    where coach_id = existing_coach_id and user_id = applicant_id and membership_role = 'owner'
  ) then
    raise exception 'Membership missing for existing coach';
  end if;
  if (select status from public.coach_profile_applications where id = existing_app_id) <> 'approved' then
    raise exception 'Application was not approved';
  end if;

  -- 2. A coach created from the application is still seeded with its data.
  insert into public.coaches (name, role, source, is_approved, data_quality_status)
  values ('Fresh Seed Coach', 'Padel coach', 'application', true, 'approved')
  returning id into fresh_coach_id;
  insert into public.coach_profile_applications
    (user_id, applicant_email, status, application_mode, full_name, phone, coaching_role,
     experience_years, description, player_levels, audiences, outcomes)
  values
    (applicant2_id, 'fresh-seed@example.invalid', 'submitted', 'create_new', 'Fresh Seed Coach',
     '987654321', 'padel_coach', 5, 'Fresh description that is long enough to satisfy validation rules.',
     array['intermediate'], array['adults'], array['build_confidence'])
  returning id into fresh_app_id;
  insert into public.coach_application_locations (application_id, country, city, is_primary)
  values (fresh_app_id, 'Portugal', 'Lisbon', true);

  update public.coach_profile_applications
  set status = 'approved', coach_id = fresh_coach_id
  where id = fresh_app_id;

  select * into coach from public.coaches where id = fresh_coach_id;
  if coach.description <> 'Fresh description that is long enough to satisfy validation rules.' or coach.experience_years <> 5 or coach.phone <> '987654321' then
    raise exception 'Fresh coach was not seeded from the application';
  end if;
  if not exists (select 1 from public.coach_locations where coach_id = fresh_coach_id and city = 'Lisbon') then
    raise exception 'Fresh coach locations were not seeded';
  end if;
  if not exists (select 1 from public.coach_outcomes where coach_id = fresh_coach_id and outcome_key = 'build_confidence') then
    raise exception 'Fresh coach outcomes were not seeded';
  end if;
  if (select audience_adults from public.coach_attributes where coach_id = fresh_coach_id) is not true then
    raise exception 'Fresh coach attributes were not seeded';
  end if;
  if not exists (select 1 from public.coach_memberships where coach_id = fresh_coach_id and user_id = applicant2_id) then
    raise exception 'Fresh coach membership missing';
  end if;
  if (select publication_status from public.coaches where id = fresh_coach_id) <> 'private' then
    raise exception 'Approval published a newly created coach';
  end if;

  -- 3. An already-published coach stays published.
  insert into public.coaches (name, source)
  values ('Already Published Coach', 'crawler')
  returning id into published_coach_id;
  update public.coaches set publication_status = 'published' where id = published_coach_id;
  insert into public.coach_profile_applications
    (user_id, applicant_email, status, application_mode, full_name, phone, coaching_role,
     experience_years, description, player_levels, audiences, outcomes)
  values
    (applicant3_id, 'already-published@example.invalid', 'submitted', 'create_new', 'Already Published Coach',
     '123123123', 'padel_coach', 3, 'Published coach application description that is long enough.',
     array['beginner'], array['adults'], array['learn_fundamentals'])
  returning id into published_app_id;
  update public.coach_profile_applications
  set status = 'approved', coach_id = published_coach_id
  where id = published_app_id;
  if (select publication_status from public.coaches where id = published_coach_id) <> 'published' then
    raise exception 'Approval unpublished an already published coach';
  end if;
  if not exists (
    select 1 from public.coach_memberships
    where coach_id = published_coach_id and user_id = applicant3_id and membership_role = 'owner'
  ) then
    raise exception 'Membership missing for already published coach';
  end if;

  -- 4. Reviewers can read application locations (review page, duplicate check).
  execute 'set local role authenticated';
  select count(*) into visible_locations
  from public.coach_application_locations location
  where location.application_id in (existing_app_id, fresh_app_id);
  execute 'reset role';
  if visible_locations <> 2 then
    raise exception 'Admin session cannot read application locations (saw %)', visible_locations;
  end if;

  raise notice 'approve_with_existing_coach_preserves_profile: all checks passed';
end;
$test$;
rollback;
