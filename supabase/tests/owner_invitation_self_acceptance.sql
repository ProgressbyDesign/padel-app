-- Owner invitation self-acceptance must succeed even after the RPC grants
-- team.manage in the same transaction. Requires
-- 20260926230638_fix_owner_invitation_self_acceptance.sql and
-- 20260926231158_preserve_last_owner_on_invitation_accept.sql.
-- The block raises after assertions so fixture rows never commit.
do $test$
declare
  owner_id uuid;
  invitee_id uuid := gen_random_uuid();
  wrong_id uuid := gen_random_uuid();
  expired_id uuid := gen_random_uuid();
  cancelled_id uuid := gen_random_uuid();
  support_id uuid := gen_random_uuid();
  owner_digest text := encode(gen_random_bytes(32), 'hex');
  stolen_digest text := encode(gen_random_bytes(32), 'hex');
  expired_digest text := encode(gen_random_bytes(32), 'hex');
  cancelled_digest text := encode(gen_random_bytes(32), 'hex');
  upgrade_digest text := encode(gen_random_bytes(32), 'hex');
  owner_invite uuid;
  stolen_invite uuid;
  expired_invite uuid;
  cancelled_invite uuid;
  accepted_role text;
begin
  select user_id into owner_id
  from public.admin_memberships
  where status = 'active' and role = 'owner'
  limit 1;
  if owner_id is null then
    raise exception 'Test requires an active owner';
  end if;

  insert into auth.users (id, email) values
    (invitee_id, 'owner-invitee@example.invalid'),
    (wrong_id, 'owner-wrong@example.invalid'),
    (expired_id, 'owner-expired@example.invalid'),
    (cancelled_id, 'owner-cancelled@example.invalid'),
    (support_id, 'support-upgrade@example.invalid');

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  insert into public.admin_invitations (
    email, role, token_digest, status, invited_by_user_id, expires_at, last_email_status
  ) values (
    'owner-invitee@example.invalid', 'owner', owner_digest, 'pending', owner_id, now() + interval '2 days', 'pending'
  ) returning id into owner_invite;

  insert into public.admin_invitations (
    email, role, token_digest, status, invited_by_user_id, expires_at, last_email_status
  ) values (
    'owner-wrong@example.invalid', 'owner', stolen_digest, 'pending', owner_id, now() + interval '2 days', 'pending'
  ) returning id into stolen_invite;

  insert into public.admin_invitations (
    email, role, token_digest, status, invited_by_user_id, expires_at, last_email_status
  ) values (
    'owner-expired@example.invalid', 'owner', expired_digest, 'pending', owner_id, now() + interval '2 days', 'pending'
  ) returning id into expired_invite;

  insert into public.admin_invitations (
    email, role, token_digest, status, invited_by_user_id, expires_at, last_email_status
  ) values (
    'owner-cancelled@example.invalid', 'owner', cancelled_digest, 'pending', owner_id, now() + interval '2 days', 'pending'
  ) returning id into cancelled_invite;

  insert into public.admin_invitations (
    email, role, token_digest, status, invited_by_user_id, expires_at, last_email_status
  ) values (
    'support-upgrade@example.invalid', 'owner', upgrade_digest, 'pending', owner_id, now() + interval '2 days', 'pending'
  );

  update public.admin_invitations set status = 'expired' where id = expired_invite;
  update public.admin_invitations set status = 'cancelled' where id = cancelled_invite;
  insert into public.admin_memberships (user_id, role, status, invited_by_user_id)
  values (support_id, 'support', 'active', owner_id);

  -- 1. Standard user accepts Owner invitation (production 23514 bug).
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', invitee_id, 'role', 'authenticated', 'email', 'owner-invitee@example.invalid')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', invitee_id::text, true);
  execute 'set local role authenticated';
  accepted_role := public.accept_admin_invitation(owner_digest);
  execute 'reset role';

  if accepted_role <> 'owner' then
    raise exception 'Owner accept returned %', accepted_role;
  end if;
  if not exists (
    select 1 from public.admin_invitations
    where id = owner_invite and status = 'accepted' and accepted_by_user_id = invitee_id
  ) then
    raise exception 'Owner invitation was not marked accepted';
  end if;
  if not exists (
    select 1 from public.admin_memberships
    where user_id = invitee_id and role = 'owner' and status = 'active'
  ) then
    raise exception 'Owner membership missing after accept';
  end if;

  -- 2. Wrong account uses the invitee's token.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', wrong_id, 'role', 'authenticated', 'email', 'owner-wrong@example.invalid')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', wrong_id::text, true);
  execute 'set local role authenticated';
  begin
    perform public.accept_admin_invitation(owner_digest);
    accepted_role := 'unexpected-success';
  exception
    when others then
      accepted_role := sqlerrm;
  end;
  if accepted_role = 'unexpected-success' then
    raise exception 'Wrong account unexpectedly accepted the invitee token';
  end if;
  if accepted_role not ilike '%another account%' and accepted_role not ilike '%invalid%' then
    raise exception 'Wrong-account error was unexpected: %', accepted_role;
  end if;
  execute 'reset role';
  if exists (select 1 from public.admin_memberships where user_id = wrong_id) then
    raise exception 'Wrong account gained a membership';
  end if;
  if (select status from public.admin_invitations where id = stolen_invite) <> 'pending' then
    raise exception 'Unrelated invitation was mutated by the wrong-account attempt';
  end if;

  -- 3. Expired invitation.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', expired_id, 'role', 'authenticated', 'email', 'owner-expired@example.invalid')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', expired_id::text, true);
  execute 'set local role authenticated';
  begin
    perform public.accept_admin_invitation(expired_digest);
    accepted_role := 'unexpected-success';
  exception
    when others then
      accepted_role := sqlerrm;
  end;
  if accepted_role = 'unexpected-success' then
    raise exception 'Expired invitation was accepted';
  end if;
  if accepted_role not ilike '%expired%' then
    raise exception 'Expired invitation error was unexpected: %', accepted_role;
  end if;
  execute 'reset role';
  if exists (select 1 from public.admin_memberships where user_id = expired_id) then
    raise exception 'Expired invitation created a membership';
  end if;

  -- 4. Cancelled invitation.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', cancelled_id, 'role', 'authenticated', 'email', 'owner-cancelled@example.invalid')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', cancelled_id::text, true);
  execute 'set local role authenticated';
  begin
    perform public.accept_admin_invitation(cancelled_digest);
    accepted_role := 'unexpected-success';
  exception
    when others then
      accepted_role := sqlerrm;
  end;
  if accepted_role = 'unexpected-success' then
    raise exception 'Cancelled invitation was accepted';
  end if;
  if accepted_role not ilike '%cancelled%' and accepted_role not ilike '%invalid%' then
    raise exception 'Cancelled invitation error was unexpected: %', accepted_role;
  end if;
  execute 'reset role';
  if exists (select 1 from public.admin_memberships where user_id = cancelled_id) then
    raise exception 'Cancelled invitation created a membership';
  end if;

  -- 5. Existing support admin upgraded via Owner invitation.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', support_id, 'role', 'authenticated', 'email', 'support-upgrade@example.invalid')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', support_id::text, true);
  execute 'set local role authenticated';
  accepted_role := public.accept_admin_invitation(upgrade_digest);
  execute 'reset role';
  if accepted_role <> 'owner' then
    raise exception 'Support upgrade returned %', accepted_role;
  end if;
  if not exists (
    select 1 from public.admin_memberships
    where user_id = support_id and role = 'owner' and status = 'active'
  ) then
    raise exception 'Support admin was not upgraded to owner';
  end if;

  -- 6. Failed accepts did not mark invitations accepted or create memberships.
  if exists (
    select 1
    from public.admin_invitations invitation
    where invitation.id in (stolen_invite, expired_invite, cancelled_invite)
      and invitation.status = 'accepted'
  ) then
    raise exception 'Failed accept marked an invitation accepted';
  end if;

  raise exception 'owner_invitation_self_acceptance: all checks passed'
    using errcode = 'P0001';
end;
$test$;
