-- Owner invitation acceptance was rejected with 23514
-- "Owners may only resend, cancel or expire a pending invitation."
--
-- accept_admin_invitation() upserts admin_memberships before marking the
-- invitation accepted. Membership insert/update must happen first because
-- invitee RLS and validate_admin_membership_change() require a still-pending
-- invitation. After an Owner-role upsert, has_admin_permission('team.manage')
-- becomes true in the same transaction, so the invitation trigger treated the
-- invitee as an Owner operating on a pending invite and blocked status=accepted.
--
-- Fix: recognise a matching self-acceptance before the Owner operational branch.
-- Owner resend/cancel/expire rules for other people's invitations are unchanged.
-- Membership upsert still happens first; both writes stay in one transaction.

create or replace function private.validate_admin_invitation_change()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_email text := lower(nullif(btrim((select auth.jwt() ->> 'email')), ''));
  caller_is_owner boolean := private.has_admin_permission('team.manage');
  token_rotated boolean := false;
  expiry_changed boolean := false;
  delivery_changed boolean := false;
  self_acceptance boolean := false;
begin
  if tg_op = 'INSERT' then
    if caller_id is null or not caller_is_owner then
      raise exception 'Only an owner can create admin invitations.' using errcode = '42501';
    end if;

    new.email := lower(btrim(new.email));
    new.invited_by_user_id := caller_id;
    new.status := 'pending';
    new.accepted_by_user_id := null;
    new.accepted_at := null;
    new.cancelled_at := null;
    new.last_email_status := 'pending';
    new.last_send_attempt_at := null;
    new.last_sent_at := null;
    new.send_count := 0;
    new.last_email_provider_id := null;
    new.last_email_error_code := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.invited_by_user_id is distinct from old.invited_by_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Admin invitation identity fields cannot be changed.' using errcode = '42501';
  end if;

  token_rotated := new.token_digest is distinct from old.token_digest;
  expiry_changed := new.expires_at is distinct from old.expires_at;
  delivery_changed :=
    new.last_email_status is distinct from old.last_email_status
    or new.last_send_attempt_at is distinct from old.last_send_attempt_at
    or new.last_sent_at is distinct from old.last_sent_at
    or new.send_count is distinct from old.send_count
    or new.last_email_provider_id is distinct from old.last_email_provider_id
    or new.last_email_error_code is distinct from old.last_email_error_code;

  if old.status <> 'pending' then
    if new.status is distinct from old.status
       or token_rotated
       or expiry_changed
       or new.accepted_by_user_id is distinct from old.accepted_by_user_id
       or new.accepted_at is distinct from old.accepted_at
       or new.cancelled_at is distinct from old.cancelled_at
       or delivery_changed then
      raise exception 'Historical admin invitations cannot be changed.' using errcode = '23514';
    end if;

    new.updated_at := now();
    return new;
  end if;

  self_acceptance :=
    caller_id is not null
    and caller_email is not null
    and caller_email = old.email
    and old.expires_at > now()
    and new.status = 'accepted'
    and new.accepted_by_user_id is not distinct from caller_id
    and not token_rotated
    and not expiry_changed
    and not delivery_changed
    and new.cancelled_at is not distinct from old.cancelled_at;

  -- Invitee accepting their own invitation, including when this transaction
  -- already granted them Owner / team.manage.
  if self_acceptance then
    new.accepted_at := now();
    new.cancelled_at := null;
    new.updated_at := now();
    return new;
  end if;

  if caller_is_owner then
    if new.status not in ('pending', 'cancelled', 'expired') then
      raise exception 'Owners may only resend, cancel or expire a pending invitation.' using errcode = '23514';
    end if;

    if new.status = 'pending' then
      if token_rotated is distinct from expiry_changed then
        raise exception 'Resending must rotate the token and expiry together.' using errcode = '23514';
      end if;

      if token_rotated then
        if new.expires_at <= now() then
          raise exception 'The refreshed invitation expiry must be in the future.' using errcode = '23514';
        end if;

        if new.accepted_by_user_id is distinct from old.accepted_by_user_id
           or new.accepted_at is distinct from old.accepted_at
           or new.cancelled_at is distinct from old.cancelled_at then
          raise exception 'Pending invitation workflow fields cannot be changed during resend.' using errcode = '42501';
        end if;

        new.last_email_status := 'pending';
        new.last_send_attempt_at := null;
        new.last_email_provider_id := null;
        new.last_email_error_code := null;
        new.send_count := old.send_count;
        new.last_sent_at := old.last_sent_at;
      elsif delivery_changed then
        if old.last_email_status <> 'pending'
           or new.last_email_status not in ('sent', 'failed') then
          raise exception 'Email delivery status may only complete a pending send attempt.' using errcode = '23514';
        end if;

        new.last_send_attempt_at := coalesce(new.last_send_attempt_at, now());
        new.send_count := old.send_count + 1;

        if new.last_email_status = 'sent' then
          new.last_sent_at := new.last_send_attempt_at;
          new.last_email_error_code := null;
        else
          new.last_sent_at := old.last_sent_at;
          new.last_email_provider_id := null;
        end if;
      end if;
    elsif new.status = 'cancelled' then
      if token_rotated or expiry_changed or delivery_changed then
        raise exception 'Cancelling an invitation cannot rotate or alter its email delivery record.' using errcode = '23514';
      end if;

      new.cancelled_at := now();
      new.accepted_by_user_id := null;
      new.accepted_at := null;
    elsif new.status = 'expired' then
      if token_rotated or expiry_changed or delivery_changed then
        raise exception 'Expiring an invitation cannot rotate or alter its email delivery record.' using errcode = '23514';
      end if;

      new.cancelled_at := null;
      new.accepted_by_user_id := null;
      new.accepted_at := null;
    end if;
  else
    raise exception 'This invitation cannot be accepted by the current account.' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

comment on function private.validate_admin_invitation_change() is
  'Guards admin invitation writes. Self-acceptance of a matching pending invitation is allowed even if the caller already has team.manage; owners may otherwise only resend, cancel or expire other invitations.';

-- Existing lower-role admins accepting a new invitation must be able to
-- update their own membership row. The previous trigger only allowed INSERT
-- for invitees; UPDATE was owner-only, so support → owner upgrades failed.
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

-- Distinguish expired / cancelled / wrong-account at lookup time so the app
-- can map those cases without treating workflow errors as an email mismatch.
create or replace function public.accept_admin_invitation(invitation_token_digest text)
returns text
language plpgsql
set search_path to ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_email text := lower(nullif(btrim((select auth.jwt() ->> 'email')), ''));
  invitation_record public.admin_invitations%rowtype;
begin
  if caller_id is null or caller_email is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select invitation.*
  into invitation_record
  from public.admin_invitations invitation
  where invitation.token_digest = lower(invitation_token_digest)
  for update;

  if invitation_record.id is null then
    raise exception 'This invitation is invalid, expired, or belongs to another account.'
      using errcode = '42501';
  end if;

  if invitation_record.email is distinct from caller_email then
    raise exception 'This invitation belongs to another account.' using errcode = '42501';
  end if;

  if invitation_record.status = 'cancelled' then
    raise exception 'This invitation was cancelled.' using errcode = '42501';
  end if;

  if invitation_record.status = 'expired'
     or (invitation_record.status = 'pending' and invitation_record.expires_at <= now()) then
    raise exception 'This invitation has expired.' using errcode = '42501';
  end if;

  if invitation_record.status <> 'pending' then
    raise exception 'This invitation is invalid, expired, or belongs to another account.'
      using errcode = '42501';
  end if;

  insert into public.admin_memberships (
    user_id,
    role,
    status,
    invited_by_user_id,
    joined_at,
    updated_at
  )
  values (
    caller_id,
    invitation_record.role,
    'active',
    invitation_record.invited_by_user_id,
    now(),
    now()
  )
  on conflict (user_id)
  do update set
    role = excluded.role,
    status = 'active',
    invited_by_user_id = excluded.invited_by_user_id,
    updated_at = now();

  update public.admin_invitations
  set status = 'accepted',
      accepted_by_user_id = caller_id,
      accepted_at = now(),
      updated_at = now()
  where id = invitation_record.id;

  return invitation_record.role;
end;
$function$;

revoke all on function public.accept_admin_invitation(text) from public, anon;
grant execute on function public.accept_admin_invitation(text) to authenticated;
grant execute on function public.accept_admin_invitation(text) to service_role;
