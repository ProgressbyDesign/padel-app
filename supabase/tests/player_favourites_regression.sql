-- Run against a database with two test accounts. All changes roll back.
begin;
do $test$
declare first_user uuid; other_user uuid; coach uuid; venue uuid; seen integer;
begin
select id into first_user from auth.users order by id limit 1;
select id into other_user from auth.users where id<>first_user order by id limit 1;
select id into coach from public.coach_public_profiles limit 1;
select id into venue from public.venue_public_profiles limit 1;
if first_user is null or other_user is null then raise exception 'Two test accounts required'; end if;
perform set_config('request.jwt.claims',json_build_object('sub',first_user,'role','authenticated')::text,true);
set local role authenticated;
insert into public.player_favourites(user_id,coach_id,venue_id) values(first_user,coach,venue)
on conflict(user_id) do update set coach_id=excluded.coach_id,venue_id=excluded.venue_id;
select count(*) into seen from public.player_favourites where user_id=first_user;
if seen<>1 then raise exception 'Owner cannot read saved favourites'; end if;
reset role;
perform set_config('request.jwt.claims',json_build_object('sub',other_user,'role','authenticated')::text,true);
set local role authenticated;
select count(*) into seen from public.player_favourites where user_id=first_user;
if seen<>0 then raise exception 'Other user can read favourites'; end if;
update public.player_favourites set coach_id=null where user_id=first_user;
get diagnostics seen = row_count;
if seen<>0 then raise exception 'Other user can change favourites'; end if;
reset role;
set local role anon;
begin
perform 1 from public.player_favourites;
raise exception 'Anonymous read allowed';
exception when insufficient_privilege then null; end;
reset role;
end $test$;
rollback;
