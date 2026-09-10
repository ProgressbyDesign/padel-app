-- Run against a test database with a completed unpaid booking and distinct coach/player accounts.
-- All changes roll back; no application email actions are invoked.
begin;
do $test$
declare booking uuid; coach_user uuid; player uuid; result_at timestamptz; result_user uuid;
begin
select b.id,m.user_id,b.requester_user_id into booking,coach_user,player
from public.coach_booking_requests b join public.coach_memberships m on m.coach_id=b.coach_id
where b.status='completed' and b.paid_at is null and m.user_id<>b.requester_user_id limit 1;
if booking is null then raise exception 'Requires a completed unpaid booking'; end if;
perform set_config('request.jwt.claims',json_build_object('sub',player,'role','authenticated')::text,true);
set local role authenticated;
begin
update public.coach_booking_requests set paid_at=now() where id=booking;
raise exception 'Player unexpectedly marked booking paid';
exception when insufficient_privilege then null; end;
reset role;
perform set_config('request.jwt.claims',json_build_object('sub',coach_user,'role','authenticated')::text,true);
set local role authenticated;
update public.coach_booking_requests set paid_at='2000-01-01',paid_by_user_id=player where id=booking returning paid_at,paid_by_user_id into result_at,result_user;
if result_at is distinct from now() or result_user is distinct from coach_user then raise exception 'Payment attribution failed'; end if;
begin
update public.coach_booking_requests set paid_at=null where id=booking;
raise exception 'Payment unexpectedly erased';
exception when check_violation then null; end;
reset role;
end $test$;
rollback;
