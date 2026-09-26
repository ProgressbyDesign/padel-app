-- Keep last-owner protection when an existing admin accepts an invitation
-- that would change their own membership row. The invitee UPDATE path added
-- in 20260926230638 must not skip this guard.

create or replace function private.validate_admin_membership_change()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_email text := lower(nullif(btrim((select auth.jwt() ->> 'email')), ''));
  caller_is_owner boolean := private.has_admin_permission('team.manage');
  active_owner_count integer;
  matching_invitation boolean := false;
begin
  if caller_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if caller_is_owner then
      new.updated_at := now();
      return new;
    end if;

    select exists (
      select 1
      from public.admin_invitations invitation
      where invitation.email = caller_email
        and invitation.role = new.role
        and invitation.status = 'pending'
        and invitation.expires_at > now()
        and new.user_id = caller_id
        and new.status = 'active'
    ) into matching_invitation;

    if not matching_invitation then
      raise exception 'A valid admin invitation is required.' using errcode = '42501';
    end if;

    new.invited_by_user_id := (
      select invitation.invited_by_user_id
      from public.admin_invitations invitation
      where invitation.email = caller_email
        and invitation.role = new.role
        and invitation.status = 'pending'
        and invitation.expires_at > now()
      order by invitation.created_at desc
      limit 1
    );
    new.joined_at := now();
    new.updated_at := now();
    return new;
  end if;

  select exists (
    select 1
    from public.admin_invitations invitation
    where invitation.email = caller_email
      and invitation.role = new.role
      and invitation.status = 'pending'
      and invitation.expires_at > now()
      and old.user_id = caller_id
      and new.user_id = caller_id
      and new.status = 'active'
      and new.joined_at is not distinct from old.joined_at
  ) into matching_invitation;

  if matching_invitation then
    if old.role = 'owner'
       and old.status = 'active'
       and (new.role <> 'owner' or new.status <> 'active') then
      select count(*)
      into active_owner_count
      from public.admin_memberships membership
      where membership.role = 'owner'
        and membership.status = 'active';

      if active_owner_count <= 1 then
        raise exception 'The final active owner cannot be removed or demoted.' using errcode = '23514';
      end if;
    end if;

    new.invited_by_user_id := (
      select invitation.invited_by_user_id
      from public.admin_invitations invitation
      where invitation.email = caller_email
        and invitation.role = new.role
        and invitation.status = 'pending'
        and invitation.expires_at > now()
      order by invitation.created_at desc
      limit 1
    );
    new.updated_at := now();
    return new;
  end if;

  if not caller_is_owner then
    raise exception 'Only an owner can change admin team membership.' using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id
     or new.invited_by_user_id is distinct from old.invited_by_user_id
     or new.joined_at is distinct from old.joined_at then
    raise exception 'Admin membership identity fields cannot be changed.' using errcode = '42501';
  end if;

  if old.role = 'owner'
     and old.status = 'active'
     and (new.role <> 'owner' or new.status <> 'active') then
    select count(*)
    into active_owner_count
    from public.admin_memberships membership
    where membership.role = 'owner'
      and membership.status = 'active';

    if active_owner_count <= 1 then
      raise exception 'The final active owner cannot be removed or demoted.' using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

comment on function private.validate_admin_membership_change() is
  'Guards admin membership writes. Invitees may insert or update their own row when a matching pending invitation exists; the final active owner still cannot be demoted.';
