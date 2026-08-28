-- Sprint 6A.4 public profile data-boundary tests.
-- Run AFTER sprint6a4_disposable_harness.sql (Migration A + B).
-- Prefer: BEGIN; /* 6A harness if needed */; /* 6A.4 harness */; /* this file */; ROLLBACK;

do $$
declare
  admin_user_id uuid;
  manager_user_id uuid;
  player_user_id uuid;
  published_coach uuid;
  draft_coach uuid;
  suspended_coach uuid;
  published_venue uuid;
  draft_venue uuid;
  suspended_venue uuid;
  n int;
  view_count int;
  email_val text;
  phone_val text;
  website_val text;
  col_list text;
  forbidden text;
begin
  select am.user_id into admin_user_id
  from public.admin_memberships am
  where am.status = 'active'
    and am.role in ('owner', 'operations')
  order by am.joined_at
  limit 1;

  if admin_user_id is null then
    select id into admin_user_id from auth.users order by created_at limit 1;
  end if;

  select u.id into manager_user_id
  from auth.users u
  where u.id is distinct from admin_user_id
  order by u.created_at
  limit 1;

  select u.id into player_user_id
  from auth.users u
  where u.id is distinct from admin_user_id
    and u.id is distinct from manager_user_id
    and not exists (
      select 1 from public.admin_memberships am
      where am.user_id = u.id and am.status = 'active'
    )
  order by u.created_at
  limit 1;

  if admin_user_id is null or manager_user_id is null then
    raise exception
      'Sprint 6A.4 tests require an admin-capable user and a second auth user';
  end if;

  if player_user_id is null then
    player_user_id := manager_user_id;
  end if;

  insert into public.coaches (name, email, phone, publication_status)
  values ('6A4 Published Coach', 'hidden-coach@example.com', '+34111000', 'published')
  returning id into published_coach;

  insert into public.coaches (name, email, phone, publication_status)
  values ('6A4 Draft Coach', 'draft-coach@example.com', '+34111001', 'private')
  returning id into draft_coach;

  insert into public.coaches (name, email, phone, publication_status)
  values ('6A4 Suspended Coach', 'suspended-coach@example.com', '+34111002', 'suspended')
  returning id into suspended_coach;

  insert into public.venues (name, phone, website, publication_status, address, city, country)
  values (
    '6A4 Published Venue',
    '+34999000',
    'https://hidden-venue.example',
    'published',
    '1 Test Street',
    'Valencia',
    'Spain'
  )
  returning id into published_venue;

  insert into public.venues (name, phone, website, publication_status)
  values ('6A4 Draft Venue', '+34999001', 'https://draft-venue.example', 'private')
  returning id into draft_venue;

  insert into public.venues (name, phone, website, publication_status)
  values ('6A4 Suspended Venue', '+34999002', 'https://suspended-venue.example', 'suspended')
  returning id into suspended_venue;

  insert into public.coach_memberships (coach_id, user_id, membership_role)
  values (published_coach, manager_user_id, 'owner')
  on conflict (coach_id, user_id) do nothing;

  insert into public.venue_memberships (venue_id, user_id, membership_role)
  values (published_venue, manager_user_id, 'owner')
  on conflict (venue_id, user_id) do nothing;

  insert into public.coach_socials (coach_id, platform, url)
  values (published_coach, 'instagram', 'https://instagram.com/hidden-coach');

  insert into public.venue_socials (venue_id, platform, url)
  values (published_venue, 'instagram', 'https://instagram.com/hidden-venue');

  -- View grants: SELECT only.
  if not has_table_privilege('anon', 'public.coach_public_profiles', 'SELECT')
     or not has_table_privilege('authenticated', 'public.coach_public_profiles', 'SELECT')
     or not has_table_privilege('anon', 'public.venue_public_profiles', 'SELECT')
     or not has_table_privilege('authenticated', 'public.venue_public_profiles', 'SELECT')
     or has_table_privilege('anon', 'public.coach_public_profiles', 'INSERT')
     or has_table_privilege('anon', 'public.coach_public_profiles', 'UPDATE')
     or has_table_privilege('anon', 'public.coach_public_profiles', 'DELETE')
     or has_table_privilege('authenticated', 'public.venue_public_profiles', 'INSERT')
     or has_table_privilege('authenticated', 'public.venue_public_profiles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.venue_public_profiles', 'DELETE')
  then
    raise exception 'FAIL: public views must be SELECT-only for anon/authenticated';
  end if;

  select string_agg(attname, ',' order by attnum) into col_list
  from pg_attribute
  where attrelid = 'public.coach_public_profiles'::regclass
    and attnum > 0
    and not attisdropped;

  foreach forbidden in array array[
    'email','phone','created_at','normalized_name','source','data_quality_status',
    'reviewed_at','reviewed_by','is_claimed','launch_selection_status',
    'onboarding_status','selected_at','selected_by_user_id',
    'onboarding_started_at','onboarding_completed_at','published_at',
    'published_by_user_id'
  ]
  loop
    if ',' || col_list || ',' ilike '%,' || forbidden || ',%' then
      raise exception 'FAIL: coach_public_profiles exposes %', forbidden;
    end if;
  end loop;

  select string_agg(attname, ',' order by attnum) into col_list
  from pg_attribute
  where attrelid = 'public.venue_public_profiles'::regclass
    and attnum > 0
    and not attisdropped;

  foreach forbidden in array array[
    'phone','website','created_at','google_place_id','ai_confidence',
    'last_synced_at','last_crawled_at','crawl_version','source',
    'data_quality_status','reviewed_at','reviewed_by',
    'launch_selection_status','onboarding_status','selected_at',
    'selected_by_user_id','onboarding_started_at','onboarding_completed_at',
    'published_at','published_by_user_id'
  ]
  loop
    if ',' || col_list || ',' ilike '%,' || forbidden || ',%' then
      raise exception 'FAIL: venue_public_profiles exposes %', forbidden;
    end if;
  end loop;

  -- Anon cannot read published base rows.
  n := -1;
  begin
    execute 'set local role anon';
    select count(*) into n from public.coaches where id = published_coach;
    execute 'reset role';
  exception
    when insufficient_privilege then
      execute 'reset role';
      n := 0;
  end;
  if n <> 0 then
    raise exception 'FAIL: anon read published coaches base row (count=%)', n;
  end if;

  n := -1;
  begin
    execute 'set local role anon';
    select count(*) into n from public.venues where id = published_venue;
    execute 'reset role';
  exception
    when insufficient_privilege then
      execute 'reset role';
      n := 0;
  end;
  if n <> 0 then
    raise exception 'FAIL: anon read published venues base row (count=%)', n;
  end if;

  -- Anon can read published public views only.
  execute 'set local role anon';
  select count(*) into view_count
  from public.coach_public_profiles
  where id in (published_coach, draft_coach, suspended_coach);
  execute 'reset role';
  if view_count is distinct from 1 then
    raise exception 'FAIL: anon coach view should be published-only (got %)', view_count;
  end if;

  execute 'set local role anon';
  select count(*) into view_count
  from public.venue_public_profiles
  where id in (published_venue, draft_venue, suspended_venue);
  execute 'reset role';
  if view_count is distinct from 1 then
    raise exception 'FAIL: anon venue view should be published-only (got %)', view_count;
  end if;

  -- Anon cannot read socials.
  n := -1;
  begin
    execute 'set local role anon';
    select count(*) into n from public.coach_socials where coach_id = published_coach;
    execute 'reset role';
  exception
    when insufficient_privilege then
      execute 'reset role';
      n := 0;
  end;
  if n <> 0 then
    raise exception 'FAIL: anon read coach_socials (count=%)', n;
  end if;

  n := -1;
  begin
    execute 'set local role anon';
    select count(*) into n from public.venue_socials where venue_id = published_venue;
    execute 'reset role';
  exception
    when insufficient_privilege then
      execute 'reset role';
      n := 0;
  end;
  if n <> 0 then
    raise exception 'FAIL: anon read venue_socials (count=%)', n;
  end if;

  -- Authenticated player: views yes, unrelated published base no.
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', player_user_id::text,
      'role', 'authenticated',
      'email', 'player-fixture@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', player_user_id::text, true);
  execute 'set local role authenticated';
  select count(*) into view_count
  from public.coach_public_profiles where id = published_coach;
  execute 'reset role';
  if view_count is distinct from 1 then
    raise exception 'FAIL: authenticated player cannot read coach public view';
  end if;

  if player_user_id is distinct from manager_user_id then
    n := -1;
    begin
      execute 'set local role authenticated';
      select count(*) into n from public.coaches where id = published_coach;
      execute 'reset role';
    exception
      when insufficient_privilege then
        execute 'reset role';
        n := 0;
    end;
    if n <> 0 then
      raise exception
        'FAIL: player read published coach base row without membership (count=%)',
        n;
    end if;

    n := -1;
    begin
      execute 'set local role authenticated';
      select count(*) into n from public.venues where id = published_venue;
      execute 'reset role';
    exception
      when insufficient_privilege then
        execute 'reset role';
        n := 0;
    end;
    if n <> 0 then
      raise exception
        'FAIL: player read published venue base row without membership (count=%)',
        n;
    end if;

    n := -1;
    begin
      execute 'set local role authenticated';
      select count(*) into n from public.coach_socials where coach_id = published_coach;
      execute 'reset role';
    exception
      when insufficient_privilege then
        execute 'reset role';
        n := 0;
    end;
    if n <> 0 then
      raise exception 'FAIL: player read coach_socials (count=%)', n;
    end if;
  else
    -- Same user is the manager: still cannot read a published coach they do not manage.
    n := -1;
    begin
      execute 'set local role authenticated';
      select count(*) into n from public.coaches where id = draft_coach;
      execute 'reset role';
    exception
      when insufficient_privilege then
        execute 'reset role';
        n := 0;
    end;
    if n <> 0 then
      raise exception 'FAIL: manager read unrelated draft coach base row';
    end if;
  end if;

  -- Manager retains private contact + socials.
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', manager_user_id::text,
      'role', 'authenticated',
      'email', 'manager-fixture@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', manager_user_id::text, true);
  execute 'set local role authenticated';
  select email, phone into email_val, phone_val
  from public.coaches where id = published_coach;
  execute 'reset role';
  if email_val is distinct from 'hidden-coach@example.com'
     or phone_val is distinct from '+34111000' then
    raise exception 'FAIL: manager lost coach contact fields';
  end if;

  execute 'set local role authenticated';
  select phone, website into phone_val, website_val
  from public.venues where id = published_venue;
  execute 'reset role';
  if phone_val is distinct from '+34999000'
     or website_val is distinct from 'https://hidden-venue.example' then
    raise exception 'FAIL: manager lost venue contact fields';
  end if;

  execute 'set local role authenticated';
  select count(*) into n from public.coach_socials where coach_id = published_coach;
  execute 'reset role';
  if n is distinct from 1 then
    raise exception 'FAIL: manager cannot read own coach_socials (count=%)', n;
  end if;

  execute 'set local role authenticated';
  select count(*) into n from public.venue_socials where venue_id = published_venue;
  execute 'reset role';
  if n is distinct from 1 then
    raise exception 'FAIL: manager cannot read own venue_socials (count=%)', n;
  end if;

  -- Admin profiles.read retains full base-table read.
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', admin_user_id::text,
      'role', 'authenticated',
      'email', 'admin-fixture@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
  execute 'set local role authenticated';
  select email into email_val from public.coaches where id = published_coach;
  select website into website_val from public.venues where id = published_venue;
  execute 'reset role';
  if email_val is distinct from 'hidden-coach@example.com'
     or website_val is distinct from 'https://hidden-venue.example' then
    raise exception 'FAIL: admin profiles.read lost base contact fields';
  end if;

  -- Unpublish removes the view row without deleting the base record.
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', admin_user_id::text,
      'role', 'authenticated',
      'email', 'admin-fixture@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
  execute 'set local role authenticated';
  update public.coaches
    set publication_status = 'private'
    where id = published_coach;
  execute 'reset role';

  execute 'set local role anon';
  select count(*) into view_count
  from public.coach_public_profiles where id = published_coach;
  execute 'reset role';
  if view_count <> 0 then
    raise exception 'FAIL: unpublished coach remained in public view';
  end if;

  select count(*) into n from public.coaches where id = published_coach;
  if n is distinct from 1 then
    raise exception 'FAIL: unpublish deleted the underlying coach row';
  end if;

  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'Sprint 6A.4 public profile boundary tests passed';
end;
$$;
