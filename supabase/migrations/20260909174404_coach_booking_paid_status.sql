alter table public.coach_booking_requests
  add column paid_at timestamptz,
  add column paid_by_user_id uuid;

create function private.guard_booking_payment()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.paid_at is not null or new.paid_by_user_id is not null then
      raise exception 'New requests cannot be marked paid.' using errcode = '42501';
    end if;
  elsif new.paid_at is distinct from old.paid_at or new.paid_by_user_id is distinct from old.paid_by_user_id then
    if auth.uid() is null or not exists (
      select 1 from public.coach_memberships m where m.coach_id = old.coach_id and m.user_id = auth.uid()
    ) then raise exception 'Only the coach can confirm payment.' using errcode = '42501'; end if;
    if old.status not in ('accepted', 'completed') or new.status is distinct from old.status then
      raise exception 'Only accepted or completed sessions can be marked paid.' using errcode = '23514';
    end if;
    if old.paid_at is not null or new.paid_at is null then
      raise exception 'Payment has already been recorded.' using errcode = '23514';
    end if;
    new.paid_at := now();
    new.paid_by_user_id := auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_payment() from public, anon, authenticated;
create trigger guard_booking_payment before insert or update on public.coach_booking_requests
for each row execute function private.guard_booking_payment();
notify pgrst, 'reload schema';
