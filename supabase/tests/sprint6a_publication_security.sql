-- Sprint 6A disposable-database security tests
-- Intended for local Supabase or a disposable DB AFTER applying
-- 20260803010000_sprint6a_launch_foundation_publication_security.sql
-- (or after sprint6a_disposable_harness.sql for pre-migration DBs).
--
-- Prefer: BEGIN; /* harness if needed */; /* this file */; ROLLBACK;
-- Do not commit against production.

do $$
declare
  owner_user_id uuid;
  other_user_id uuid;
  coach_a uuid;
  coach_b uuid;
  venue_a uuid;
  venue_b uuid;
  rel_a uuid;
  rel_b uuid;
  coach_claim_id uuid;
  venue_claim_id uuid;
  booking_id uuid;
  requester_id uuid;
  range_start timestamptz := timestamptz '2030-06-01 10:00:00+00';
  range_end timestamptz := timestamptz '2030-06-01 11:00:00+00';
  window_start timestamptz := timestamptz '2030-05-01 00:00:00+00';
  window_end timestamptz := timestamptz '2030-07-01 00:00:00+00';
  public_ranges int;
  other_ranges int;
  unpublished_ranges int;
  rpc_cols text;
  stored_email text;
  mode_after text;
  target_after uuid;
  status_after text;
begin
  select id into owner_user_id from auth.users order by created_at limit 1;
  select id into other_user_id
  from auth.users
  where id is distinct from owner_user_id
  order by created_at
  limit 1;

  if owner_user_id is null then
    raise exception 'Sprint 6A tests require at least one auth.users row';
  end if;
  if other_user_id is null then
    other_user_id := owner_user_id;
  end if;
  requester_id := owner_user_id;

  insert into public.coaches (name, publication_status)
  values ('Sprint6A Coach A', 'published')
  returning id into coach_a;

  insert into public.coaches (name, publication_status)
  values ('Sprint6A Coach B', 'published')
  returning id into coach_b;

  insert into public.venues (name, publication_status)
  values ('Sprint6A Venue A', 'published')
  returning id into venue_a;

  insert into public.venues (name, publication_status)
  values ('Sprint6A Venue B', 'private')
  returning id into venue_b;

  insert into public.coach_venues (
    coach_id, venue_id, status, is_primary, responded_at, responded_by_user_id
  )
  values (coach_a, venue_a, 'active', true, now(), owner_user_id)
  returning id into rel_a;

  insert into public.coach_venues (
    coach_id, venue_id, status, is_primary, responded_at, responded_by_user_id
  )
  values (coach_b, venue_b, 'active', true, now(), owner_user_id)
  returning id into rel_b;

  insert into public.coach_venue_availability_settings (
    coach_venue_id, timezone, is_public, default_slot_duration_minutes
  )
  values (rel_a, 'UTC', true, 60)
  on conflict (coach_venue_id) do update
    set is_public = true, timezone = 'UTC';

  alter table public.coach_booking_requests
    disable trigger prepare_coach_booking_request;
  alter table public.coach_booking_requests
    disable trigger sync_venue_booking_block;

  insert into public.coach_booking_requests (
    coach_venue_id,
    coach_id,
    venue_id,
    requester_user_id,
    status,
    starts_at,
    ends_at,
    timezone,
    requester_name,
    requester_email,
    message,
    price_amount_minor,
    currency,
    responded_at,
    responded_by_user_id
  )
  values (
    rel_a,
    coach_a,
    venue_a,
    requester_id,
    'accepted',
    range_start,
    range_end,
    'UTC',
    'Secret Requester',
    'secret-requester@example.com',
    'private message must not leak',
    5000,
    'EUR',
    now(),
    requester_id
  )
  returning id into booking_id;

  alter table public.coach_booking_requests
    enable trigger prepare_coach_booking_request;
  alter table public.coach_booking_requests
    enable trigger sync_venue_booking_block;

  select string_agg(p.parameter_name, ',' order by p.ordinal_position)
    into rpc_cols
  from information_schema.parameters p
  where p.specific_schema = 'public'
    and p.specific_name in (
      select specific_name
      from information_schema.routines
      where routine_schema = 'public'
        and routine_name = 'get_public_accepted_booking_ranges'
    )
    and p.parameter_mode = 'OUT';

  if rpc_cols is distinct from 'starts_at,ends_at' then
    raise exception
      'Sprint 6A test failed: RPC OUT columns must be starts_at,ends_at (got %)',
      coalesce(rpc_cols, '<null>');
  end if;

  execute 'set local role anon';
  select count(*) into public_ranges
  from public.get_public_accepted_booking_ranges(
    window_start, window_end, coach_a, null
  );
  execute 'reset role';
  if public_ranges is distinct from 1 then
    raise exception
      'Sprint 6A test failed: anon should see accepted range (got %)',
      public_ranges;
  end if;

  execute 'set local role anon';
  select count(*) into other_ranges
  from public.get_public_accepted_booking_ranges(
    window_start, window_end, coach_b, null
  );
  execute 'reset role';
  if other_ranges is distinct from 0 then
    raise exception
      'Sprint 6A test failed: another coach ranges leaked (got %)',
      other_ranges;
  end if;

  execute 'set local role anon';
  select count(*) into unpublished_ranges
  from public.get_public_accepted_booking_ranges(
    window_start, window_end, null, rel_b
  );
  execute 'reset role';
  if unpublished_ranges is distinct from 0 then
    raise exception
      'Sprint 6A test failed: unpublished relationship returned ranges (got %)',
      unpublished_ranges;
  end if;

  begin
    execute $q$
      select requester_email
      from public.get_public_accepted_booking_ranges($1, $2, $3, null)
    $q$ using window_start, window_end, coach_a;
    raise exception 'Sprint 6A test failed: requester_email readable via RPC';
  exception
    when undefined_column then null;
    when others then
      if sqlstate = '42703' then null;
      else raise;
      end if;
  end;

  alter table public.coach_profile_applications
    disable trigger coach_application_notification_email;
  alter table public.coach_profile_applications
    disable trigger coach_profile_applications_prepare_update;
  alter table public.coach_profile_applications
    disable trigger finalize_approved_coach_application_trigger;
  alter table public.coach_profile_applications
    disable trigger guard_coach_profile_application_mutations;
  alter table public.venue_profile_applications
    disable trigger venue_application_notification_email;
  alter table public.venue_profile_applications
    disable trigger prepare_venue_profile_application_update_trigger;
  alter table public.venue_profile_applications
    disable trigger finalize_approved_venue_application_trigger;
  alter table public.venue_profile_applications
    disable trigger guard_venue_profile_application_mutations;

  insert into public.coach_profile_applications (
    user_id,
    status,
    current_step,
    application_mode,
    target_coach_id,
    applicant_email,
    full_name,
    player_levels,
    audiences,
    outcomes
  )
  values (
    owner_user_id,
    'draft',
    1,
    'claim_existing',
    coach_a,
    'historical-coach-claim@example.com',
    'Claim Fixture Coach',
    '{}'::text[],
    '{}'::text[],
    '{}'::text[]
  )
  returning id into coach_claim_id;

  insert into public.venue_profile_applications (
    user_id,
    status,
    current_step,
    application_mode,
    target_venue_id,
    applicant_email,
    relationship_to_venue,
    phone
  )
  values (
    owner_user_id,
    'draft',
    1,
    'claim_existing',
    venue_a,
    'historical-venue-claim@example.com',
    'owner',
    '1234567890'
  )
  returning id into venue_claim_id;

  alter table public.coach_profile_applications
    enable trigger coach_application_notification_email;
  alter table public.coach_profile_applications
    enable trigger coach_profile_applications_prepare_update;
  alter table public.coach_profile_applications
    enable trigger finalize_approved_coach_application_trigger;
  alter table public.coach_profile_applications
    enable trigger guard_coach_profile_application_mutations;
  alter table public.venue_profile_applications
    enable trigger venue_application_notification_email;
  alter table public.venue_profile_applications
    enable trigger prepare_venue_profile_application_update_trigger;
  alter table public.venue_profile_applications
    enable trigger finalize_approved_venue_application_trigger;
  alter table public.venue_profile_applications
    enable trigger guard_venue_profile_application_mutations;

  -- Field editing fails (authenticated owner, mismatched JWT email)
  begin
    perform set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', owner_user_id::text,
        'role', 'authenticated',
        'email', 'jwt-mismatch@example.com'
      )::text,
      true
    );
    perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
    execute 'set local role authenticated';
    update public.coach_profile_applications
    set full_name = 'Should Fail'
    where id = coach_claim_id;
    execute 'reset role';
    raise exception 'Sprint 6A test failed: coach claim field edit allowed';
  exception
    when insufficient_privilege then
      execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  begin
    perform set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', owner_user_id::text,
        'role', 'authenticated',
        'email', 'jwt-mismatch@example.com'
      )::text,
      true
    );
    perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
    execute 'set local role authenticated';
    update public.venue_profile_applications
    set phone = '9999999999'
    where id = venue_claim_id;
    execute 'reset role';
    raise exception 'Sprint 6A test failed: venue claim field edit allowed';
  exception
    when insufficient_privilege then
      execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- Submission fails
  begin
    perform set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', owner_user_id::text,
        'role', 'authenticated',
        'email', 'jwt-mismatch@example.com'
      )::text,
      true
    );
    perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
    execute 'set local role authenticated';
    update public.coach_profile_applications
    set status = 'submitted'
    where id = coach_claim_id;
    execute 'reset role';
    raise exception 'Sprint 6A test failed: coach claim submission allowed';
  exception
    when insufficient_privilege then
      execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate in ('42501', '23514') then null; else raise; end if;
  end;

  begin
    perform set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', owner_user_id::text,
        'role', 'authenticated',
        'email', 'jwt-mismatch@example.com'
      )::text,
      true
    );
    perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
    execute 'set local role authenticated';
    update public.venue_profile_applications
    set status = 'submitted'
    where id = venue_claim_id;
    execute 'reset role';
    raise exception 'Sprint 6A test failed: venue claim submission allowed';
  exception
    when insufficient_privilege then
      execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate in ('42501', '23514') then null; else raise; end if;
  end;

  -- Authenticated withdrawal succeeds; email/mode/target preserved
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', owner_user_id::text,
      'role', 'authenticated',
      'email', 'jwt-mismatch@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
  execute 'set local role authenticated';

  update public.coach_profile_applications
  set status = 'withdrawn'
  where id = coach_claim_id;

  update public.venue_profile_applications
  set status = 'withdrawn'
  where id = venue_claim_id;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  select applicant_email, application_mode, target_coach_id, status
    into stored_email, mode_after, target_after, status_after
  from public.coach_profile_applications
  where id = coach_claim_id;

  if status_after is distinct from 'withdrawn' then
    raise exception 'Sprint 6A test failed: coach claim withdrawal must succeed';
  end if;
  if stored_email is distinct from 'historical-coach-claim@example.com' then
    raise exception
      'Sprint 6A test failed: coach claim withdrawal must preserve applicant_email';
  end if;
  if mode_after is distinct from 'claim_existing' or target_after is distinct from coach_a then
    raise exception
      'Sprint 6A test failed: coach claim mode and target must remain unchanged';
  end if;

  select applicant_email, application_mode, target_venue_id, status
    into stored_email, mode_after, target_after, status_after
  from public.venue_profile_applications
  where id = venue_claim_id;

  if status_after is distinct from 'withdrawn' then
    raise exception 'Sprint 6A test failed: venue claim withdrawal must succeed';
  end if;
  if stored_email is distinct from 'historical-venue-claim@example.com' then
    raise exception
      'Sprint 6A test failed: venue claim withdrawal must preserve applicant_email';
  end if;
  if mode_after is distinct from 'claim_existing' or target_after is distinct from venue_a then
    raise exception
      'Sprint 6A test failed: venue claim mode and target must remain unchanged';
  end if;

  raise notice 'Sprint 6A disposable tests passed';
end $$;
