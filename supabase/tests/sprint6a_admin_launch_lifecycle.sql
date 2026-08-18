-- Sprint 6A amendment — admin launch curation and publication lifecycle tests.
-- Intended for local Supabase or a disposable DB AFTER applying
-- 20260803010000_sprint6a_launch_foundation_publication_security.sql
-- (or after sprint6a_disposable_harness.sql for pre-migration DBs).
--
-- Prefer: BEGIN; /* harness if needed */; /* this file */; ROLLBACK;
-- Do not commit against production.

do $$
declare
  admin_user_id uuid;
  member_user_id uuid;
  imported_coach uuid;
  published_coach uuid;
  admin_had_membership boolean := false;
  admin_prior_role text;
  admin_prior_status text;
  anon_sees_private int;
  anon_sees_published int;
  launch_after text;
  publication_after text;
  selected_at_after timestamptz;
  selected_by_after uuid;
  published_at_after timestamptz;
  published_by_after uuid;
begin
  select id into admin_user_id from auth.users order by created_at limit 1;
  select id into member_user_id
  from auth.users
  where id is distinct from admin_user_id
  order by created_at
  limit 1;

  if admin_user_id is null then
    raise exception 'Sprint 6A admin lifecycle tests require at least one auth.users row';
  end if;
  if member_user_id is null then
    member_user_id := admin_user_id;
  end if;

  -- Transaction-scoped admin membership with profiles.manage. The team-change
  -- guard is bypassed for fixture setup only; everything rolls back.
  select true, role::text, status::text
    into admin_had_membership, admin_prior_role, admin_prior_status
  from public.admin_memberships
  where user_id = admin_user_id;

  alter table public.admin_memberships
    disable trigger validate_admin_membership_change;

  if admin_had_membership then
    update public.admin_memberships
    set role = 'owner', status = 'active'
    where user_id = admin_user_id;
  else
    insert into public.admin_memberships (user_id, role, status)
    values (admin_user_id, 'owner', 'active');
  end if;

  alter table public.admin_memberships
    enable trigger validate_admin_membership_change;

  -- Imported coach: approved by data quality, but not selected and not public.
  insert into public.coaches (
    name, is_approved, source, launch_selection_status, publication_status
  )
  values (
    'Sprint6A Imported Coach', true, 'import', 'unselected', 'private'
  )
  returning id into imported_coach;

  -- Already-published coach with no membership/claim at all.
  insert into public.coaches (
    name, is_approved, source, launch_selection_status, publication_status
  )
  values (
    'Sprint6A Published Unclaimed Coach', false, 'import', 'selected', 'published'
  )
  returning id into published_coach;

  -- A. Approved but private is invisible anonymously.
  execute 'set local role anon';
  select count(*) into anon_sees_private
  from public.coaches where id = imported_coach;
  execute 'reset role';
  if anon_sees_private is distinct from 0 then
    raise exception
      'Sprint 6A test failed: approved-but-private coach visible to anon (got %)',
      anon_sees_private;
  end if;

  -- B. Published and unclaimed is visible anonymously.
  execute 'set local role anon';
  select count(*) into anon_sees_published
  from public.coaches where id = published_coach;
  execute 'reset role';
  if anon_sees_published is distinct from 1 then
    raise exception
      'Sprint 6A test failed: published unclaimed coach must be anon-visible (got %)',
      anon_sees_published;
  end if;
  if exists (
    select 1 from public.coach_memberships where coach_id = published_coach
  ) then
    raise exception
      'Sprint 6A test failed: published fixture must have no membership';
  end if;

  -- C. A coach member without profiles.manage cannot self-select or self-publish.
  insert into public.coach_memberships (coach_id, user_id, membership_role)
  values (imported_coach, member_user_id, 'owner')
  on conflict do nothing;

  begin
    perform set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', member_user_id::text,
        'role', 'authenticated',
        'email', 'coach-member@example.com'
      )::text,
      true
    );
    perform set_config('request.jwt.claim.sub', member_user_id::text, true);
    execute 'set local role authenticated';
    update public.coaches
    set launch_selection_status = 'selected'
    where id = imported_coach;
    execute 'reset role';
    raise exception
      'Sprint 6A test failed: coach member changed launch_selection_status';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  begin
    perform set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', member_user_id::text,
        'role', 'authenticated',
        'email', 'coach-member@example.com'
      )::text,
      true
    );
    perform set_config('request.jwt.claim.sub', member_user_id::text, true);
    execute 'set local role authenticated';
    update public.coaches
    set publication_status = 'published'
    where id = imported_coach;
    execute 'reset role';
    raise exception
      'Sprint 6A test failed: coach member changed publication_status';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- D. Authenticated admin with profiles.manage drives the lifecycle and the
  -- trigger owns the audit fields.
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', admin_user_id::text,
      'role', 'authenticated',
      'email', 'launch-admin@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
  execute 'set local role authenticated';

  -- unselected → selected
  update public.coaches
  set launch_selection_status = 'selected'
  where id = imported_coach;

  -- private → published
  update public.coaches
  set publication_status = 'published'
  where id = imported_coach;

  execute 'reset role';

  select launch_selection_status,
         publication_status,
         selected_at,
         selected_by_user_id,
         published_at,
         published_by_user_id
    into launch_after,
         publication_after,
         selected_at_after,
         selected_by_after,
         published_at_after,
         published_by_after
  from public.coaches
  where id = imported_coach;

  if launch_after is distinct from 'selected' then
    raise exception
      'Sprint 6A test failed: admin could not select coach for launch (got %)',
      launch_after;
  end if;
  if publication_after is distinct from 'published' then
    raise exception
      'Sprint 6A test failed: admin could not publish coach (got %)',
      publication_after;
  end if;
  if selected_at_after is null or selected_by_after is distinct from admin_user_id then
    raise exception
      'Sprint 6A test failed: trigger must set selected_at/selected_by_user_id';
  end if;
  if published_at_after is null or published_by_after is distinct from admin_user_id then
    raise exception
      'Sprint 6A test failed: trigger must set published_at/published_by_user_id';
  end if;

  -- Publishing must not have been a side effect of selection alone.
  execute 'set local role anon';
  select count(*) into anon_sees_published
  from public.coaches where id = imported_coach;
  execute 'reset role';
  if anon_sees_published is distinct from 1 then
    raise exception
      'Sprint 6A test failed: published coach must be anon-visible (got %)',
      anon_sees_published;
  end if;

  -- published → private
  execute 'set local role authenticated';
  update public.coaches
  set publication_status = 'private'
  where id = imported_coach;
  execute 'reset role';

  execute 'set local role anon';
  select count(*) into anon_sees_private
  from public.coaches where id = imported_coach;
  execute 'reset role';
  if anon_sees_private is distinct from 0 then
    raise exception
      'Sprint 6A test failed: private coach must disappear from anon reads (got %)',
      anon_sees_private;
  end if;

  -- private → suspended
  execute 'set local role authenticated';
  update public.coaches
  set publication_status = 'suspended'
  where id = imported_coach;
  execute 'reset role';

  select publication_status, launch_selection_status
    into publication_after, launch_after
  from public.coaches
  where id = imported_coach;

  if publication_after is distinct from 'suspended' then
    raise exception
      'Sprint 6A test failed: admin could not suspend coach (got %)',
      publication_after;
  end if;
  if launch_after is distinct from 'selected' then
    raise exception
      'Sprint 6A test failed: visibility changes must not alter launch selection (got %)',
      launch_after;
  end if;

  execute 'set local role anon';
  select count(*) into anon_sees_private
  from public.coaches where id = imported_coach;
  execute 'reset role';
  if anon_sees_private is distinct from 0 then
    raise exception
      'Sprint 6A test failed: suspended coach must not be anon-visible (got %)',
      anon_sees_private;
  end if;

  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'Sprint 6A admin launch lifecycle tests passed';
end $$;
