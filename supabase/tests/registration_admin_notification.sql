-- Requires 20260928090000_claim_registration_admin_notification.sql.
-- Rolls back after assertions.
do $test$
declare
  user_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  claimed boolean;
begin
  insert into auth.users (id, email) values
    (user_id, 'registration-claim@example.invalid'),
    (other_id, 'registration-other@example.invalid');

  insert into public.profiles (id, full_name)
  values (user_id, 'Juan Martin')
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name)
  values (other_id, 'Other Player')
  on conflict (id) do nothing;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', user_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  execute 'set local role authenticated';

  claimed := public.claim_registration_admin_notification();
  if claimed is not true then
    raise exception 'First claim should succeed';
  end if;

  claimed := public.claim_registration_admin_notification();
  if claimed is not false then
    raise exception 'Second claim should be a no-op';
  end if;

  begin
    update public.profiles
    set registration_admin_notified_at = null
    where id = user_id;
    raise exception 'Direct clear should have been rejected';
  exception
    when insufficient_privilege or check_violation or others then
      if sqlerrm ilike '%Direct clear%' then
        raise;
      end if;
      if sqlstate <> '42501' and sqlerrm not ilike '%cannot be changed directly%' then
        raise exception 'Unexpected direct-update error: % %', sqlstate, sqlerrm;
      end if;
  end;

  execute 'reset role';

  if (select registration_admin_notified_at is null from public.profiles where id = other_id) is not true then
    raise exception 'Unrelated profile was claimed';
  end if;
  if (select registration_admin_notified_at is null from public.profiles where id = user_id) then
    raise exception 'Claim did not stick';
  end if;

  raise exception 'registration_admin_notification: all checks passed'
    using errcode = 'P0001';
end;
$test$;
