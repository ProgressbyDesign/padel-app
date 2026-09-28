-- Claim the admin "new account" email once per profile.
-- Direct updates of the timestamp are rejected. Only the definer function may set it.

alter table public.profiles
  add column if not exists registration_admin_notified_at timestamptz;

comment on column public.profiles.registration_admin_notified_at is
  'Set once when the admin new-account email is claimed after email confirmation. Null means not yet claimed.';

create or replace function private.guard_registration_admin_notification()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.registration_admin_notified_at is distinct from old.registration_admin_notified_at
     and current_setting('private.allow_registration_notification_claim', true) is distinct from '1' then
    raise exception 'Registration notification state cannot be changed directly.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_registration_admin_notification on public.profiles;
create trigger guard_registration_admin_notification
  before update of registration_admin_notified_at on public.profiles
  for each row
  execute function private.guard_registration_admin_notification();

create or replace function public.claim_registration_admin_notification()
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  claimed_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  perform set_config('private.allow_registration_notification_claim', '1', true);

  update public.profiles
  set registration_admin_notified_at = now()
  where id = caller_id
    and registration_admin_notified_at is null
  returning id into claimed_id;

  return claimed_id is not null;
end;
$function$;

comment on function public.claim_registration_admin_notification() is
  'Atomically claims the one-time admin notification for the signed-in user. Returns false when already claimed or the profile is missing.';

revoke all on function public.claim_registration_admin_notification() from public, anon;
grant execute on function public.claim_registration_admin_notification() to authenticated;
