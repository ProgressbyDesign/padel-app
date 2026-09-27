-- Pass 2.1 coach directory bulk verification and unclaim.
-- Requires 20260927224957_admin_coach_directory_bulk_ops.sql.
-- Raises after assertions so fixture rows never commit.
do $test$
declare
  owner_id uuid;
  support_id uuid := gen_random_uuid();
  player_id uuid := gen_random_uuid();
  manager_id uuid := gen_random_uuid();
  coach_a uuid;
  coach_b uuid;
  coach_c uuid;
  missing_id uuid := gen_random_uuid();
  publication_before text;
  onboarding_before text;
  result jsonb;
  err text;
  membership_count integer;
  application_status text;
begin
  select user_id into owner_id
  from public.admin_memberships
  where status = 'active' and role = 'owner'
  limit 1;
  if owner_id is null then
    raise exception 'Test requires an active owner';
  end if;

  insert into auth.users (id, email) values
    (support_id, 'support-bulk@example.invalid'),
    (player_id, 'player-bulk@example.invalid'),
    (manager_id, 'manager-bulk@example.invalid');

  insert into public.admin_memberships (user_id, role, status, invited_by_user_id)
  values (support_id, 'support', 'active', owner_id);

  insert into public.coaches (name, source, is_approved, data_quality_status, publication_status, onboarding_status)
  values
    ('Bulk Verify Coach', 'import', false, 'needs_review', 'private', 'not_started'),
    ('Bulk Unclaim Coach', 'application', true, 'reviewed', 'published', 'not_started'),
    ('Bulk Already Coach', 'import', true, 'reviewed', 'private', 'not_started')
  returning id into coach_a;

  select id into coach_a from public.coaches where name = 'Bulk Verify Coach' order by created_at desc limit 1;
  select id into coach_b from public.coaches where name = 'Bulk Unclaim Coach' order by created_at desc limit 1;
  select id into coach_c from public.coaches where name = 'Bulk Already Coach' order by created_at desc limit 1;

  insert into public.coach_memberships (coach_id, user_id, membership_role)
  values
    (coach_b, player_id, 'owner'),
    (coach_b, manager_id, 'manager');

  insert into public.coach_profile_applications (
    user_id, status, full_name, coaching_role, phone, coach_id, applicant_email
  )
  values (
    player_id, 'approved', 'Bulk Unclaim Coach', 'padel_coach', '0000000000', coach_b, 'player-bulk@example.invalid'
  );

  select publication_status, onboarding_status
  into publication_before, onboarding_before
  from public.coaches
  where id = coach_b;

  -- Support admin cannot verify.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', support_id, 'role', 'authenticated', 'email', 'support-bulk@example.invalid')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', support_id::text, true);
  execute 'set local role authenticated';
  begin
    perform public.admin_set_coach_verification(array[coach_a], true);
    err := 'unexpected-success';
  exception
    when others then
      err := sqlerrm;
  end;
  execute 'reset role';
  if err = 'unexpected-success' or err not ilike '%profiles.manage%' then
    raise exception 'Support admin was not rejected: %', err;
  end if;

  -- Ordinary user cannot unclaim.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', player_id, 'role', 'authenticated', 'email', 'player-bulk@example.invalid')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', player_id::text, true);
  execute 'set local role authenticated';
  begin
    perform public.admin_unclaim_coaches(array[coach_b]);
    err := 'unexpected-success';
  exception
    when others then
      err := sqlerrm;
  end;
  execute 'reset role';
  if err = 'unexpected-success' or err not ilike '%profiles.manage%' then
    raise exception 'Ordinary user was not rejected: %', err;
  end if;

  -- Owner verifies one coach, then a bulk including an already-approved and missing id.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  execute 'set local role authenticated';

  result := public.admin_set_coach_verification(array[coach_a], true);
  if result -> 'updatedIds' <> to_jsonb(array[coach_a]) then
    raise exception 'Single verify updatedIds were %', result;
  end if;
  if exists (
    select 1 from public.coaches
    where id = coach_a
      and (
        is_approved is not true
        or data_quality_status <> 'reviewed'
        or publication_status <> 'private'
      )
  ) then
    raise exception 'Verified coach mapping or publication changed unexpectedly';
  end if;

  result := public.admin_set_coach_verification(array[coach_a, coach_c, missing_id], true);
  if result -> 'alreadyIds' <> to_jsonb(array[coach_a, coach_c])
     and jsonb_array_length(result -> 'alreadyIds') <> 2 then
    raise exception 'Bulk verify alreadyIds were %', result;
  end if;
  if result -> 'missingIds' <> to_jsonb(array[missing_id]) then
    raise exception 'Bulk verify missingIds were %', result;
  end if;

  result := public.admin_set_coach_verification(array[coach_a], false);
  if result -> 'updatedIds' <> to_jsonb(array[coach_a]) then
    raise exception 'Unverify failed: %', result;
  end if;
  if exists (
    select 1 from public.coaches
    where id = coach_a
      and (
        is_approved is not false
        or data_quality_status <> 'needs_review'
        or publication_status <> 'private'
      )
  ) then
    raise exception 'Unverified coach mapping or publication changed unexpectedly';
  end if;

  result := public.admin_unclaim_coaches(array[coach_b, coach_c, missing_id]);
  execute 'reset role';

  if not (result -> 'updatedIds' @> to_jsonb(array[coach_b]))
     or jsonb_array_length(result -> 'updatedIds') <> 1 then
    raise exception 'Unclaim updatedIds were %', result;
  end if;
  if not (result -> 'alreadyIds' @> to_jsonb(array[coach_c])) then
    raise exception 'Already-unclaimed coach was not reported: %', result;
  end if;
  if not (result -> 'missingIds' @> to_jsonb(array[missing_id])) then
    raise exception 'Missing unclaim id was not reported: %', result;
  end if;

  select count(*) into membership_count
  from public.coach_memberships
  where coach_id = coach_b;
  if membership_count <> 0 then
    raise exception 'Unclaim left % memberships', membership_count;
  end if;

  if exists (select 1 from public.coaches where id = coach_b and is_claimed) then
    raise exception 'Unclaimed coach is still marked claimed';
  end if;
  if exists (
    select 1 from public.coaches
    where id = coach_b
      and (
        publication_status is distinct from publication_before
        or onboarding_status is distinct from onboarding_before
        or is_approved is not true
      )
  ) then
    raise exception 'Unclaim changed publication, onboarding or verification';
  end if;
  if not exists (select 1 from auth.users where id = player_id) then
    raise exception 'Unclaim deleted the user account';
  end if;
  if not exists (
    select 1 from public.coach_profile_applications
    where coach_id = coach_b and status = 'approved'
  ) then
    raise exception 'Unclaim rewrote application history';
  end if;
  if exists (
    select 1 from public.admin_memberships
    where user_id = support_id and role = 'support'
  ) is not true then
    raise exception 'Unclaim removed an unrelated admin membership';
  end if;

  raise exception 'admin_coach_directory_bulk_ops: all checks passed'
    using errcode = 'P0001';
end;
$test$;
