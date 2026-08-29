-- Sprint 6A.4 public profile data-boundary tests.
-- Run AFTER sprint6a4_disposable_harness.sql (Migration A + B).
-- Prefer: BEGIN; /* 6A harness if needed */; /* 6A.4 harness */; /* this file */; ROLLBACK;

do $$
declare
  admin_user_id uuid;
  coach_manager_id uuid;
  venue_manager_id uuid;
  player_user_id uuid;
  published_coach uuid;
  draft_coach uuid;
  suspended_coach uuid;
  published_venue uuid;
  draft_venue uuid;
  suspended_venue uuid;
  unrelated_draft_coach uuid;
  unrelated_draft_venue uuid;
  pending_identity_coach uuid;
  pending_identity_venue uuid;
  unverified_identity_venue uuid;
  declined_identity_coach uuid;
  ended_identity_venue uuid;
  n int;
  view_count int;
  email_val text;
  phone_val text;
  website_val text;
  name_val text;
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

  select u.id into coach_manager_id
  from auth.users u
  where u.id is distinct from admin_user_id
  order by u.created_at
  limit 1;

  select u.id into venue_manager_id
  from auth.users u
  where u.id is distinct from admin_user_id
    and u.id is distinct from coach_manager_id
    and not exists (
      select 1 from public.admin_memberships am
      where am.user_id = u.id and am.status = 'active'
    )
  order by u.created_at
  limit 1;

  select u.id into player_user_id
  from auth.users u
  where u.id is distinct from admin_user_id
    and u.id is distinct from coach_manager_id
    and u.id is distinct from venue_manager_id
    and not exists (
      select 1 from public.admin_memberships am
      where am.user_id = u.id and am.status = 'active'
    )
    and not exists (
      select 1 from public.coach_memberships cm
      where cm.user_id = u.id
    )
    and not exists (
      select 1 from public.venue_memberships vm
      where vm.user_id = u.id
    )
  order by u.created_at
  limit 1;

  if admin_user_id is null or coach_manager_id is null then
    raise exception
      'Sprint 6A.4 tests require an admin-capable user and a second auth user';
  end if;

  if venue_manager_id is null then
    raise exception
      'Sprint 6A.4 linked-partner tests require a third auth user as a venue-only manager';
  end if;

  if player_user_id is null then
    raise exception
      'Sprint 6A.4 identity tests require a fourth auth user with no coach or venue memberships';
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

  insert into public.venues (name, phone, website, publication_status, city, country)
  values (
    '6A4 Draft Venue',
    '+34999001',
    'https://draft-venue.example',
    'private',
    'Alicante',
    'Spain'
  )
  returning id into draft_venue;

  insert into public.venues (name, phone, website, publication_status)
  values ('6A4 Suspended Venue', '+34999002', 'https://suspended-venue.example', 'suspended')
  returning id into suspended_venue;

  insert into public.coaches (name, email, phone, publication_status)
  values (
    '6A4 Unrelated Draft Coach',
    'unrelated-coach@example.com',
    '+34111009',
    'private'
  )
  returning id into unrelated_draft_coach;

  insert into public.venues (name, phone, website, publication_status, city, country)
  values (
    '6A4 Unrelated Draft Venue',
    '+34999009',
    'https://unrelated-venue.example',
    'private',
    'Madrid',
    'Spain'
  )
  returning id into unrelated_draft_venue;

  insert into public.coaches (name, email, phone, publication_status)
  values (
    '6A4 Pending Identity Coach',
    'pending-identity-coach@example.com',
    '+34111011',
    'private'
  )
  returning id into pending_identity_coach;

  insert into public.coaches (name, email, phone, publication_status)
  values (
    '6A4 Declined Identity Coach',
    'declined-identity-coach@example.com',
    '+34111012',
    'private'
  )
  returning id into declined_identity_coach;

  insert into public.venues (name, phone, website, publication_status, city, country)
  values (
    '6A4 Pending Identity Venue',
    '+34999011',
    'https://pending-identity-venue.example',
    'private',
    'Seville',
    'Spain'
  )
  returning id into pending_identity_venue;

  insert into public.venues (name, phone, website, publication_status, city, country)
  values (
    '6A4 Unverified Identity Venue',
    '+34999012',
    'https://unverified-identity-venue.example',
    'private',
    'Bilbao',
    'Spain'
  )
  returning id into unverified_identity_venue;

  insert into public.venues (name, phone, website, publication_status, city, country)
  values (
    '6A4 Ended Identity Venue',
    '+34999013',
    'https://ended-identity-venue.example',
    'private',
    'Malaga',
    'Spain'
  )
  returning id into ended_identity_venue;

  -- Split memberships: coach-only vs venue-only. Neither is a member of the other.
  insert into public.coach_memberships (coach_id, user_id, membership_role)
  values (published_coach, coach_manager_id, 'owner')
  on conflict (coach_id, user_id) do nothing;

  insert into public.venue_memberships (venue_id, user_id, membership_role)
  values (published_venue, venue_manager_id, 'owner')
  on conflict (venue_id, user_id) do nothing;

  insert into public.coach_venues (
    coach_id, venue_id, status, is_primary, initiated_by,
    requested_by_user_id, responded_at, responded_by_user_id
  )
  values
    (
      published_coach, published_venue, 'active', true, 'coach',
      coach_manager_id, now(), venue_manager_id
    ),
    (
      published_coach, draft_venue, 'active', false, 'coach',
      coach_manager_id, now(), coach_manager_id
    );

  -- Unrelated pair: must not become visible to the fixture managers.
  insert into public.coach_venues (
    coach_id, venue_id, status, is_primary, initiated_by,
    requested_by_user_id, responded_at, responded_by_user_id
  )
  values (
    unrelated_draft_coach, unrelated_draft_venue, 'active', true, 'coach',
    coach_manager_id, now(), coach_manager_id
  );

  -- Pending/unverified remain workspace-visible. Terminal statuses must not.
  insert into public.coach_venues (
    coach_id, venue_id, status, is_primary, initiated_by,
    requested_by_user_id, responded_at, responded_by_user_id
  )
  values
    (
      published_coach, pending_identity_venue, 'pending', false, 'venue',
      venue_manager_id, null, null
    ),
    (
      published_coach, unverified_identity_venue, 'unverified', false, 'import',
      coach_manager_id, null, null
    ),
    (
      pending_identity_coach, published_venue, 'pending', false, 'coach',
      coach_manager_id, null, null
    ),
    (
      declined_identity_coach, published_venue, 'declined', false, 'coach',
      coach_manager_id, now(), venue_manager_id
    );

  insert into public.coach_venues (
    coach_id, venue_id, status, is_primary, initiated_by,
    requested_by_user_id, responded_at, responded_by_user_id, ended_at
  )
  values (
    published_coach, ended_identity_venue, 'ended', false, 'coach',
    coach_manager_id, now(), coach_manager_id, now()
  );

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

  if has_table_privilege('anon', 'public.coach_relationship_identities', 'SELECT')
     or has_table_privilege('anon', 'public.venue_relationship_identities', 'SELECT')
     or not has_table_privilege('authenticated', 'public.coach_relationship_identities', 'SELECT')
     or not has_table_privilege('authenticated', 'public.venue_relationship_identities', 'SELECT')
     or has_table_privilege('authenticated', 'public.coach_relationship_identities', 'INSERT')
     or has_table_privilege('authenticated', 'public.coach_relationship_identities', 'UPDATE')
     or has_table_privilege('authenticated', 'public.coach_relationship_identities', 'DELETE')
     or has_table_privilege('authenticated', 'public.venue_relationship_identities', 'INSERT')
     or has_table_privilege('authenticated', 'public.venue_relationship_identities', 'UPDATE')
     or has_table_privilege('authenticated', 'public.venue_relationship_identities', 'DELETE')
  then
    raise exception
      'FAIL: relationship identities must be authenticated SELECT-only, not anon';
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

  select string_agg(attname, ',' order by attnum) into col_list
  from pg_attribute
  where attrelid = 'public.coach_relationship_identities'::regclass
    and attnum > 0
    and not attisdropped;

  foreach forbidden in array array[
    'email','phone','slug','description','created_at','source',
    'data_quality_status','is_claimed','launch_selection_status',
    'onboarding_status','published_at'
  ]
  loop
    if ',' || col_list || ',' ilike '%,' || forbidden || ',%' then
      raise exception 'FAIL: coach_relationship_identities exposes %', forbidden;
    end if;
  end loop;

  select string_agg(attname, ',' order by attnum) into col_list
  from pg_attribute
  where attrelid = 'public.venue_relationship_identities'::regclass
    and attnum > 0
    and not attisdropped;

  foreach forbidden in array array[
    'phone','website','address','lat','lng','created_at','google_place_id',
    'last_crawled_at','source','data_quality_status','launch_selection_status',
    'onboarding_status','published_at'
  ]
  loop
    if ',' || col_list || ',' ilike '%,' || forbidden || ',%' then
      raise exception 'FAIL: venue_relationship_identities exposes %', forbidden;
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
  -- Identity views must be empty for a user with no memberships.
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

  execute 'set local role authenticated';
  select count(*) into n from public.coach_relationship_identities;
  execute 'reset role';
  if n <> 0 then
    raise exception
      'FAIL: player with no memberships read coach_relationship_identities (count=%)',
      n;
  end if;

  execute 'set local role authenticated';
  select count(*) into n from public.venue_relationship_identities;
  execute 'reset role';
  if n <> 0 then
    raise exception
      'FAIL: player with no memberships read venue_relationship_identities (count=%)',
      n;
  end if;

  -- Coach member: complete own coach row; not the linked venue base row.
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', coach_manager_id::text,
      'role', 'authenticated',
      'email', 'coach-manager-fixture@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', coach_manager_id::text, true);

  execute 'set local role authenticated';
  select email, phone into email_val, phone_val
  from public.coaches where id = published_coach;
  execute 'reset role';
  if email_val is distinct from 'hidden-coach@example.com'
     or phone_val is distinct from '+34111000' then
    raise exception 'FAIL: coach member lost own complete coach row';
  end if;

  execute 'set local role authenticated';
  select count(*) into n from public.coach_socials where coach_id = published_coach;
  execute 'reset role';
  if n is distinct from 1 then
    raise exception 'FAIL: coach member cannot read own coach_socials (count=%)', n;
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
      'FAIL: coach member read linked venue base row (count=%)', n;
  end if;

  phone_val := null;
  website_val := null;
  begin
    execute 'set local role authenticated';
    select phone, website into phone_val, website_val
    from public.venues where id = published_venue;
    execute 'reset role';
  exception
    when insufficient_privilege then
      execute 'reset role';
      phone_val := null;
      website_val := null;
  end;
  if phone_val is not null or website_val is not null then
    raise exception
      'FAIL: coach member retrieved linked venue private base fields';
  end if;

  n := -1;
  begin
    execute 'set local role authenticated';
    select count(*) into n from public.venues where id = draft_venue;
    execute 'reset role';
  exception
    when insufficient_privilege then
      execute 'reset role';
      n := 0;
  end;
  if n <> 0 then
    raise exception 'FAIL: coach member read linked draft venue base row';
  end if;

  execute 'set local role authenticated';
  select count(*) into view_count
  from public.venue_public_profiles where id = published_venue;
  execute 'reset role';
  if view_count is distinct from 1 then
    raise exception
      'FAIL: coach member cannot read linked published venue public profile';
  end if;

  execute 'set local role authenticated';
  select name into name_val
  from public.venue_relationship_identities where id = published_venue;
  execute 'reset role';
  if name_val is distinct from '6A4 Published Venue' then
    raise exception
      'FAIL: coach member cannot read linked venue relationship identity';
  end if;

  execute 'set local role authenticated';
  select name into name_val
  from public.venue_relationship_identities where id = draft_venue;
  execute 'reset role';
  if name_val is distinct from '6A4 Draft Venue' then
    raise exception
      'FAIL: coach member cannot read draft linked venue relationship identity';
  end if;

  execute 'set local role authenticated';
  select name into name_val
  from public.venue_relationship_identities where id = pending_identity_venue;
  execute 'reset role';
  if name_val is distinct from '6A4 Pending Identity Venue' then
    raise exception
      'FAIL: coach member cannot read pending linked venue identity';
  end if;

  execute 'set local role authenticated';
  select name into name_val
  from public.venue_relationship_identities
  where id = unverified_identity_venue;
  execute 'reset role';
  if name_val is distinct from '6A4 Unverified Identity Venue' then
    raise exception
      'FAIL: coach member cannot read unverified linked venue identity';
  end if;

  execute 'set local role authenticated';
  select count(*) into n
  from public.venue_relationship_identities where id = ended_identity_venue;
  execute 'reset role';
  if n <> 0 then
    raise exception
      'FAIL: coach member saw ended venue identity (count=%)', n;
  end if;

  execute 'set local role authenticated';
  select count(*) into n
  from public.venue_relationship_identities
  where id = unrelated_draft_venue;
  execute 'reset role';
  if n <> 0 then
    raise exception
      'FAIL: coach member saw unrelated Draft venue identity (count=%)', n;
  end if;

  execute 'set local role authenticated';
  select count(*) into view_count
  from public.venue_public_profiles where id = draft_venue;
  execute 'reset role';
  if view_count <> 0 then
    raise exception 'FAIL: draft venue leaked into the public view';
  end if;

  -- Venue member: complete own venue row; not the linked coach base row.
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', venue_manager_id::text,
      'role', 'authenticated',
      'email', 'venue-manager-fixture@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', venue_manager_id::text, true);

  execute 'set local role authenticated';
  select phone, website into phone_val, website_val
  from public.venues where id = published_venue;
  execute 'reset role';
  if phone_val is distinct from '+34999000'
     or website_val is distinct from 'https://hidden-venue.example' then
    raise exception 'FAIL: venue member lost own complete venue row';
  end if;

  execute 'set local role authenticated';
  select count(*) into n from public.venue_socials where venue_id = published_venue;
  execute 'reset role';
  if n is distinct from 1 then
    raise exception 'FAIL: venue member cannot read own venue_socials (count=%)', n;
  end if;

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
      'FAIL: venue member read linked coach base row (count=%)', n;
  end if;

  email_val := null;
  phone_val := null;
  begin
    execute 'set local role authenticated';
    select email, phone into email_val, phone_val
    from public.coaches where id = published_coach;
    execute 'reset role';
  exception
    when insufficient_privilege then
      execute 'reset role';
      email_val := null;
      phone_val := null;
  end;
  if email_val is not null or phone_val is not null then
    raise exception
      'FAIL: venue member retrieved linked coach private base fields';
  end if;

  execute 'set local role authenticated';
  select count(*) into view_count
  from public.coach_public_profiles where id = published_coach;
  execute 'reset role';
  if view_count is distinct from 1 then
    raise exception
      'FAIL: venue member cannot read linked published coach public profile';
  end if;

  execute 'set local role authenticated';
  select name into name_val
  from public.coach_relationship_identities where id = published_coach;
  execute 'reset role';
  if name_val is distinct from '6A4 Published Coach' then
    raise exception
      'FAIL: venue member cannot read linked coach relationship identity';
  end if;

  execute 'set local role authenticated';
  select name into name_val
  from public.coach_relationship_identities where id = pending_identity_coach;
  execute 'reset role';
  if name_val is distinct from '6A4 Pending Identity Coach' then
    raise exception
      'FAIL: venue member cannot read pending linked coach identity';
  end if;

  execute 'set local role authenticated';
  select count(*) into n
  from public.coach_relationship_identities
  where id = declined_identity_coach;
  execute 'reset role';
  if n <> 0 then
    raise exception
      'FAIL: venue member saw declined coach identity (count=%)', n;
  end if;

  execute 'set local role authenticated';
  select count(*) into n
  from public.coach_relationship_identities
  where id = unrelated_draft_coach;
  execute 'reset role';
  if n <> 0 then
    raise exception
      'FAIL: venue member saw unrelated Draft coach identity (count=%)', n;
  end if;

  execute 'set local role authenticated';
  select count(*) into n
  from public.coach_relationship_identities
  where id = draft_coach;
  execute 'reset role';
  if n <> 0 then
    raise exception
      'FAIL: venue member saw unlinked Draft coach identity (count=%)', n;
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

  -- Unpublished coach stays in the relationship identity, still not the base row.
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', venue_manager_id::text,
      'role', 'authenticated',
      'email', 'venue-manager-fixture@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', venue_manager_id::text, true);
  execute 'set local role authenticated';
  select name into name_val
  from public.coach_relationship_identities where id = published_coach;
  execute 'reset role';
  if name_val is distinct from '6A4 Published Coach' then
    raise exception
      'FAIL: unpublished linked coach disappeared from relationship identity';
  end if;

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
      'FAIL: venue member read unpublished linked coach base row';
  end if;

  -- Relationship removal drops the identity; remaining links stay visible.
  delete from public.coach_venues
  where coach_id = published_coach
    and venue_id = published_venue;

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', venue_manager_id::text,
      'role', 'authenticated',
      'email', 'venue-manager-fixture@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', venue_manager_id::text, true);
  execute 'set local role authenticated';
  select count(*) into n
  from public.coach_relationship_identities where id = published_coach;
  execute 'reset role';
  if n <> 0 then
    raise exception
      'FAIL: venue member still saw coach identity after relationship removal';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', coach_manager_id::text,
      'role', 'authenticated',
      'email', 'coach-manager-fixture@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', coach_manager_id::text, true);
  execute 'set local role authenticated';
  select count(*) into n
  from public.venue_relationship_identities where id = published_venue;
  execute 'reset role';
  if n <> 0 then
    raise exception
      'FAIL: coach member still saw venue identity after relationship removal';
  end if;

  execute 'set local role authenticated';
  select name into name_val
  from public.venue_relationship_identities where id = draft_venue;
  execute 'reset role';
  if name_val is distinct from '6A4 Draft Venue' then
    raise exception
      'FAIL: remaining linked draft venue identity disappeared after unrelated unlink';
  end if;

  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'Sprint 6A.4 public profile boundary tests passed';
end;
$$;
