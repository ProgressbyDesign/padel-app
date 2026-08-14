-- Sprint 6A — authenticated table-privilege alignment.
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
  admin_had_membership boolean := false;
  coach_owned uuid;
  coach_other uuid;
  venue_owned uuid;
  venue_other uuid;
  created_coach uuid;
  coach_app_id uuid;
  venue_app_id uuid;
  location_id uuid;
  relationship_id uuid;
  relationship_pending uuid;
  responded_after timestamptz;
  approved_after boolean;
  n int;
  pub_after text;
  launch_after text;
  selected_at_after timestamptz;
  selected_by_after uuid;
  published_at_after timestamptz;
  published_by_after uuid;
  name_after text;
  own_name text;
  other_name text;
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

  select u.id into member_user_id
  from auth.users u
  where u.id is distinct from admin_user_id
    and not exists (
      select 1
      from public.admin_memberships am
      where am.user_id = u.id
        and am.status = 'active'
    )
  order by u.created_at
  limit 1;

  if admin_user_id is null or member_user_id is null then
    raise exception
      'Sprint 6A permission tests require one admin-capable auth user and one non-admin auth user';
  end if;

  -- Privilege inventory: every authenticated RLS write used by a supported
  -- journey must have the matching GRANT. Column-level UPDATE does not make
  -- has_table_privilege(..., 'UPDATE') true.
  if not has_column_privilege('authenticated', 'public.profiles'::regclass, 'full_name', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles'::regclass, 'avatar_path', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles'::regclass, 'avatar_updated_at', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles'::regclass, 'last_workspace_type', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles'::regclass, 'last_workspace_entity_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles'::regclass, 'role', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles'::regclass, 'created_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles'::regclass, 'id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles'::regclass, 'updated_at', 'UPDATE')
  then
    raise exception 'FAIL grant: profiles column UPDATE allowlist';
  end if;
  if not has_table_privilege('authenticated', 'public.coaches', 'INSERT')
     or not has_table_privilege('authenticated', 'public.coaches', 'UPDATE') then
    raise exception 'FAIL grant: coaches INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.venues', 'INSERT')
     or not has_table_privilege('authenticated', 'public.venues', 'UPDATE') then
    raise exception 'FAIL grant: venues INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.coach_profile_applications', 'INSERT')
     or not has_table_privilege('authenticated', 'public.coach_profile_applications', 'UPDATE') then
    raise exception 'FAIL grant: coach_profile_applications INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.venue_profile_applications', 'INSERT')
     or not has_table_privilege('authenticated', 'public.venue_profile_applications', 'UPDATE') then
    raise exception 'FAIL grant: venue_profile_applications INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.coach_application_locations', 'INSERT')
     or not has_table_privilege('authenticated', 'public.coach_application_locations', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.coach_application_locations', 'DELETE') then
    raise exception 'FAIL grant: coach_application_locations INSERT/UPDATE/DELETE';
  end if;
  if not has_table_privilege('authenticated', 'public.coach_venues', 'INSERT') then
    raise exception 'FAIL grant: coach_venues INSERT';
  end if;
  if not has_column_privilege('authenticated', 'public.coach_venues'::regclass, 'status', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.coach_venues'::regclass, 'is_primary', 'UPDATE')
     or has_column_privilege('authenticated', 'public.coach_venues'::regclass, 'responded_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.coach_venues'::regclass, 'responded_by_user_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.coach_venues'::regclass, 'ended_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.coach_venues'::regclass, 'id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.coach_venues'::regclass, 'coach_id', 'UPDATE')
  then
    raise exception 'FAIL grant: coach_venues column UPDATE allowlist';
  end if;
  if not has_table_privilege('authenticated', 'public.coach_attributes', 'INSERT')
     or not has_table_privilege('authenticated', 'public.coach_attributes', 'UPDATE') then
    raise exception 'FAIL grant: coach_attributes INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.coach_outcomes', 'INSERT')
     or not has_table_privilege('authenticated', 'public.coach_outcomes', 'UPDATE') then
    raise exception 'FAIL grant: coach_outcomes INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.coach_achievements', 'INSERT')
     or not has_table_privilege('authenticated', 'public.coach_achievements', 'UPDATE') then
    raise exception 'FAIL grant: coach_achievements INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.coach_images', 'INSERT')
     or not has_table_privilege('authenticated', 'public.coach_images', 'UPDATE') then
    raise exception 'FAIL grant: coach_images INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.coach_socials', 'INSERT')
     or not has_table_privilege('authenticated', 'public.coach_socials', 'UPDATE') then
    raise exception 'FAIL grant: coach_socials INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.venue_images', 'INSERT')
     or not has_table_privilege('authenticated', 'public.venue_images', 'UPDATE') then
    raise exception 'FAIL grant: venue_images INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.venue_socials', 'INSERT')
     or not has_table_privilege('authenticated', 'public.venue_socials', 'UPDATE') then
    raise exception 'FAIL grant: venue_socials INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.coach_memberships', 'INSERT')
     or not has_table_privilege('authenticated', 'public.coach_memberships', 'UPDATE') then
    raise exception 'FAIL grant: coach_memberships INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.venue_memberships', 'INSERT')
     or not has_table_privilege('authenticated', 'public.venue_memberships', 'UPDATE') then
    raise exception 'FAIL grant: venue_memberships INSERT/UPDATE';
  end if;
  if not has_table_privilege('authenticated', 'public.enquiries', 'INSERT')
     or not has_table_privilege('anon', 'public.enquiries', 'INSERT') then
    raise exception 'FAIL grant: enquiries INSERT for authenticated/anon';
  end if;

  -- Negative grants: operations that must stay unreachable at the table level.
  if has_table_privilege('authenticated', 'public.coaches', 'DELETE')
     or has_table_privilege('authenticated', 'public.venues', 'DELETE')
     or has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     or has_table_privilege('authenticated', 'public.coach_applications', 'INSERT')
     or has_table_privilege('authenticated', 'public.coach_applications', 'UPDATE')
     or has_table_privilege('anon', 'public.coaches', 'INSERT')
     or has_table_privilege('anon', 'public.coaches', 'UPDATE')
     or has_table_privilege('anon', 'public.venues', 'UPDATE')
     or has_table_privilege('authenticated', 'public.enquiries', 'UPDATE')
  then
    raise exception 'FAIL grant: unexpected write privilege present';
  end if;

  select true into admin_had_membership
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

  insert into public.coaches (name, is_approved, source, launch_selection_status, publication_status)
  values ('Sprint6A Perm Owned Coach', true, 'import', 'unselected', 'private')
  returning id into coach_owned;

  insert into public.coaches (name, is_approved, source, launch_selection_status, publication_status)
  values ('Sprint6A Perm Other Coach', true, 'import', 'unselected', 'private')
  returning id into coach_other;

  insert into public.venues (name, launch_selection_status, publication_status)
  values ('Sprint6A Perm Owned Venue', 'unselected', 'private')
  returning id into venue_owned;

  insert into public.venues (name, launch_selection_status, publication_status)
  values ('Sprint6A Perm Other Venue', 'unselected', 'private')
  returning id into venue_other;

  insert into public.coach_memberships (coach_id, user_id, membership_role)
  values (coach_owned, member_user_id, 'owner')
  on conflict do nothing;

  insert into public.venue_memberships (venue_id, user_id, membership_role)
  values (venue_owned, member_user_id, 'owner')
  on conflict do nothing;

  insert into public.coach_venues (
    coach_id, venue_id, status, is_primary, initiated_by,
    requested_by_user_id, responded_at, responded_by_user_id
  )
  values (
    coach_owned, venue_owned, 'active', false, 'coach',
    member_user_id, now(), member_user_id
  )
  returning id into relationship_id;

  insert into public.coach_venues (
    coach_id, venue_id, status, is_primary, initiated_by,
    requested_by_user_id, responded_at, responded_by_user_id
  )
  values (
    coach_owned, venue_other, 'pending', false, 'coach',
    member_user_id, null, null
  )
  returning id into relationship_pending;

  -- One-active-application unique indexes: clear the member's existing rows
  -- inside this rolled-back transaction so the journey fixtures can insert.
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

  update public.coach_profile_applications
  set status = 'withdrawn'
  where user_id = member_user_id
    and status not in ('declined', 'withdrawn');
  update public.venue_profile_applications
  set status = 'withdrawn'
  where user_id = member_user_id
    and status in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved');

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

  insert into public.profiles (id, full_name)
  values (admin_user_id, 'Admin Fixture'), (member_user_id, 'Member Fixture')
  on conflict (id) do update set full_name = excluded.full_name;

  -- Player / non-member cannot update an arbitrary coach (RLS, 0 rows).
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', member_user_id::text,
      'role', 'authenticated',
      'email', 'member-fixture@example.com'
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', member_user_id::text, true);
  execute 'set local role authenticated';
  update public.coaches set name = 'Hijacked' where id = coach_other;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 0 then
    raise exception 'FAIL: non-member updated an arbitrary coach';
  end if;

  -- Coach member can update ordinary fields on their own coach.
  execute 'set local role authenticated';
  update public.coaches set name = 'Owned Coach Updated' where id = coach_owned;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: coach member could not update own coach (row_count=%)', n;
  end if;

  begin
    execute 'set local role authenticated';
    update public.coaches set is_approved = false where id = coach_owned;
    execute 'reset role';
    raise exception 'FAIL: coach member changed is_approved';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  begin
    execute 'set local role authenticated';
    update public.coaches set is_claimed = false where id = coach_owned;
    execute 'reset role';
    raise exception 'FAIL: coach member changed is_claimed';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  begin
    execute 'set local role authenticated';
    update public.coaches
    set source = 'forged', data_quality_status = 'approved'
    where id = coach_owned;
    execute 'reset role';
    raise exception 'FAIL: coach member changed source/data_quality_status';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  begin
    execute 'set local role authenticated';
    update public.coaches set rating = 5, review_count = 999 where id = coach_owned;
    execute 'reset role';
    raise exception 'FAIL: coach member forged rating/review_count';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  begin
    execute 'set local role authenticated';
    update public.coaches set created_at = now() - interval '10 years' where id = coach_owned;
    execute 'reset role';
    raise exception 'FAIL: coach member changed coaches.created_at';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  begin
    execute 'set local role authenticated';
    update public.coaches
    set normalized_name = 'forged', slug = 'forged-slug', level = 'forged'
    where id = coach_owned;
    execute 'reset role';
    raise exception 'FAIL: coach member changed search/slug/level metadata';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- Coach member cannot self-select or self-publish (lifecycle trigger 42501).
  begin
    execute 'set local role authenticated';
    update public.coaches
    set launch_selection_status = 'selected'
    where id = coach_owned;
    execute 'reset role';
    raise exception 'FAIL: coach member changed launch_selection_status';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  begin
    execute 'set local role authenticated';
    update public.coaches
    set publication_status = 'published'
    where id = coach_owned;
    execute 'reset role';
    raise exception 'FAIL: coach member changed publication_status';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- Venue member can update own venue; cannot update another.
  execute 'set local role authenticated';
  update public.venues set name = 'Owned Venue Updated' where id = venue_owned;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: venue member could not update own venue (row_count=%)', n;
  end if;

  execute 'set local role authenticated';
  update public.venues set name = 'Hijacked Venue' where id = venue_other;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 0 then
    raise exception 'FAIL: venue member updated an arbitrary venue';
  end if;

  begin
    execute 'set local role authenticated';
    update public.venues
    set is_approved = true, source = 'forged', data_quality_status = 'approved',
        rating = 5, review_count = 999, last_synced_at = now()
    where id = venue_owned;
    execute 'reset role';
    raise exception 'FAIL: venue member changed server-owned venue metadata';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- Own profile vs another user's profile.
  execute 'set local role authenticated';
  update public.profiles set full_name = 'Member Self' where id = member_user_id;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: user could not update own profiles row (row_count=%)', n;
  end if;

  execute 'set local role authenticated';
  update public.profiles set full_name = 'Hijacked Admin' where id = admin_user_id;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 0 then
    raise exception 'FAIL: user updated another profiles row';
  end if;

  select full_name into own_name from public.profiles where id = member_user_id;
  select full_name into other_name from public.profiles where id = admin_user_id;
  if own_name is distinct from 'Member Self' or other_name is distinct from 'Admin Fixture' then
    raise exception 'FAIL: profile isolation broken (own=%, other=%)', own_name, other_name;
  end if;

  execute 'set local role authenticated';
  update public.profiles
  set
    last_workspace_type = 'coach',
    last_workspace_entity_id = coach_owned,
    avatar_path = 'accounts/' || member_user_id::text || '/avatar',
    avatar_updated_at = now()
  where id = member_user_id;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: user could not update permitted profile fields (row_count=%)', n;
  end if;

  begin
    execute 'set local role authenticated';
    update public.profiles set role = 'admin' where id = member_user_id;
    execute 'reset role';
    raise exception 'FAIL: user set profiles.role = admin';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  begin
    execute 'set local role authenticated';
    update public.profiles set created_at = now() - interval '10 years' where id = member_user_id;
    execute 'reset role';
    raise exception 'FAIL: user modified profiles.created_at';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  execute 'set local role authenticated';
  update public.coach_venues set is_primary = true where id = relationship_id;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: coach member could not update is_primary (row_count=%)', n;
  end if;

  begin
    execute 'set local role authenticated';
    update public.coach_venues set responded_at = now() where id = relationship_id;
    execute 'reset role';
    raise exception 'FAIL: client updated coach_venues.responded_at';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  begin
    execute 'set local role authenticated';
    update public.coach_venues set id = gen_random_uuid() where id = relationship_id;
    execute 'reset role';
    raise exception 'FAIL: client changed coach_venues.id';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- Membership writes stay admin-gated by RLS after the table GRANT.
  begin
    execute 'set local role authenticated';
    insert into public.coach_memberships (coach_id, user_id, membership_role)
    values (coach_other, member_user_id, 'owner');
    execute 'reset role';
    raise exception 'FAIL: non-admin inserted coach_memberships';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- Coach application journey: create_new draft, edit, location CRUD, submit.
  execute 'set local role authenticated';
  insert into public.coach_profile_applications (
    user_id, status, current_step, application_mode, applicant_email, full_name,
    player_levels, audiences, outcomes
  )
  values (
    member_user_id, 'draft', 1, 'create_new', 'member-fixture@example.com',
    'Applicant Coach', '{}'::text[], '{}'::text[], '{}'::text[]
  )
  returning id into coach_app_id;
  execute 'reset role';

  if coach_app_id is null then
    raise exception 'FAIL: applicant could not create create_new coach draft';
  end if;

  begin
    execute 'set local role authenticated';
    insert into public.coach_profile_applications (
      user_id, status, current_step, application_mode, target_coach_id,
      applicant_email, full_name, player_levels, audiences, outcomes
    )
    values (
      member_user_id, 'draft', 1, 'claim_existing', coach_other,
      'member-fixture@example.com', 'Should Fail', '{}'::text[], '{}'::text[], '{}'::text[]
    );
    execute 'reset role';
    raise exception 'FAIL: applicant created a claim_existing coach application';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  execute 'set local role authenticated';
  update public.coach_profile_applications
  set
    full_name = 'Applicant Coach Updated',
    phone = '1234567890',
    coaching_role = 'padel_coach',
    experience_years = 3,
    player_levels = array['beginner']::text[],
    audiences = array['adults']::text[],
    outcomes = array['learn_fundamentals']::text[],
    terms_accepted_at = now(),
    privacy_accepted_at = now()
  where id = coach_app_id;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: applicant could not update create_new draft (row_count=%)', n;
  end if;

  execute 'set local role authenticated';
  insert into public.coach_application_locations (application_id, country, city)
  values (coach_app_id, 'Spain', 'Malaga')
  returning id into location_id;
  execute 'reset role';
  if location_id is null then
    raise exception 'FAIL: applicant could not add application location';
  end if;

  execute 'set local role authenticated';
  update public.coach_application_locations set city = 'Marbella' where id = location_id;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: applicant could not update application location';
  end if;

  execute 'set local role authenticated';
  insert into public.coach_application_locations (application_id, country, city)
  values (coach_app_id, 'Spain', 'To Delete')
  returning id into location_id;
  delete from public.coach_application_locations where id = location_id;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: applicant could not delete application location';
  end if;

  execute 'set local role authenticated';
  update public.coach_profile_applications
  set status = 'submitted'
  where id = coach_app_id;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: applicant could not submit create_new coach application';
  end if;

  -- Venue application: create_new, update, submit; claim_existing blocked.
  execute 'set local role authenticated';
  insert into public.venue_profile_applications (
    user_id, status, current_step, application_mode, applicant_email,
    relationship_to_venue, phone, proposed_venue_name, proposed_country, proposed_city
  )
  values (
    member_user_id, 'draft', 1, 'create_new', 'member-fixture@example.com',
    'owner', '1234567890', 'Applicant Venue', 'Spain', 'Malaga'
  )
  returning id into venue_app_id;
  execute 'reset role';
  if venue_app_id is null then
    raise exception 'FAIL: applicant could not create create_new venue draft';
  end if;

  begin
    execute 'set local role authenticated';
    insert into public.venue_profile_applications (
      user_id, status, current_step, application_mode, target_venue_id,
      applicant_email, relationship_to_venue, phone
    )
    values (
      member_user_id, 'draft', 1, 'claim_existing', venue_other,
      'member-fixture@example.com', 'owner', '1234567890'
    );
    execute 'reset role';
    raise exception 'FAIL: applicant created a claim_existing venue application';
  exception
    when insufficient_privilege then execute 'reset role';
    when others then
      execute 'reset role';
      if sqlstate = '42501' then null; else raise; end if;
  end;

  execute 'set local role authenticated';
  update public.venue_profile_applications
  set
    proposed_city = 'Marbella',
    terms_accepted_at = now(),
    privacy_accepted_at = now()
  where id = venue_app_id;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: applicant could not update create_new venue draft';
  end if;

  execute 'set local role authenticated';
  update public.venue_profile_applications
  set status = 'submitted'
  where id = venue_app_id;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: applicant could not submit create_new venue application';
  end if;

  -- Admin Top 10 publication through the authenticated client.
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

  insert into public.coaches (name, is_approved, source)
  values ('Sprint6A Admin Created Coach', true, 'application')
  returning id into created_coach;

  update public.coaches
  set launch_selection_status = 'selected'
  where id = created_coach;

  update public.coaches
  set publication_status = 'published'
  where id = created_coach;

  execute 'reset role';

  select name, publication_status, launch_selection_status,
         selected_at, selected_by_user_id, published_at, published_by_user_id
    into name_after, pub_after, launch_after,
         selected_at_after, selected_by_after, published_at_after, published_by_after
  from public.coaches
  where id = created_coach;

  if created_coach is null then
    raise exception 'FAIL: admin could not insert a coach';
  end if;
  if launch_after is distinct from 'selected' or pub_after is distinct from 'published' then
    raise exception 'FAIL: admin launch/publish did not land (launch=%, pub=%)', launch_after, pub_after;
  end if;
  if selected_at_after is null or selected_by_after is distinct from admin_user_id then
    raise exception 'FAIL: trigger must set selected_at/selected_by_user_id';
  end if;
  if published_at_after is null or published_by_after is distinct from admin_user_id then
    raise exception 'FAIL: trigger must set published_at/published_by_user_id';
  end if;

  execute 'set local role authenticated';
  update public.coaches set publication_status = 'private' where id = created_coach;
  update public.coaches set publication_status = 'suspended' where id = created_coach;
  execute 'reset role';

  select publication_status into pub_after from public.coaches where id = created_coach;
  if pub_after is distinct from 'suspended' then
    raise exception 'FAIL: admin could not suspend coach (got %)', pub_after;
  end if;

  execute 'set local role authenticated';
  update public.coaches
  set is_approved = true, data_quality_status = 'reviewed', reviewed_by = 'admin-test'
  where id = created_coach;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: profiles.manage admin could not update coach metadata (row_count=%)', n;
  end if;
  select is_approved into approved_after from public.coaches where id = created_coach;
  if approved_after is not true then
    raise exception 'FAIL: admin is_approved write did not land';
  end if;

  execute 'set local role authenticated';
  update public.coach_venues set status = 'active' where id = relationship_pending;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: admin could not activate coach_venues (row_count=%)', n;
  end if;
  select responded_at into responded_after from public.coach_venues where id = relationship_pending;
  if responded_after is null then
    raise exception 'FAIL: trigger must populate responded_at without a client column write';
  end if;

  -- Approval through authenticated admin RLS must not auto-publish.
  execute 'set local role authenticated';
  update public.coach_profile_applications
  set status = 'approved', coach_id = coach_other
  where id = coach_app_id;
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: admin could not approve coach application (row_count=%)', n;
  end if;

  select publication_status, launch_selection_status
    into pub_after, launch_after
  from public.coaches
  where id = coach_other;
  if pub_after is distinct from 'private' or launch_after is distinct from 'unselected' then
    raise exception
      'FAIL: approval auto-published or auto-selected (pub=%, launch=%)',
      pub_after, launch_after;
  end if;

  -- Public enquiry insert as anon (existing product journey).
  -- INSERT ... RETURNING would also require SELECT, which anon must not have.
  execute 'set local role anon';
  insert into public.enquiries (status, full_name, email)
  values ('new', 'Anon Enquirer', 'anon-enquirer@example.com');
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then
    raise exception 'FAIL: anon could not insert enquiry';
  end if;

  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'Sprint 6A permission alignment tests passed';
end $$;
