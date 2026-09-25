begin;
do $test$
declare c uuid; u uuid; v uuid; n int;
begin
 select coach_id,user_id into c,u from public.coach_memberships limit 1;
 if c is null then raise exception 'Coach fixture required'; end if;
 insert into public.venues(name,publication_status) values('Catalogue regression fixture','private') returning id into v;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 select count(*) into n from public.search_coaching_venue_catalogue(c,'',v);
 if n<>1 then raise exception 'Private venue missing for member'; end if;
 select count(*) into n from public.venue_public_profiles where id=v;
 if n<>0 then raise exception 'Private venue exposed publicly'; end if;
 insert into public.coach_venues(coach_id,venue_id,initiated_by) values(c,v,'coach');
 if not exists(select 1 from public.coach_venues where coach_id=c and venue_id=v and status='pending') then raise exception 'Private venue request was not saved as pending'; end if;
 perform set_config('request.jwt.claims','{}',true);
 begin
  perform * from public.search_coaching_venue_catalogue(c,'',v);
  raise exception 'Unauthenticated access was allowed';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 begin
  perform * from public.search_coaching_venue_catalogue(c,'',v);
  raise exception 'Non-member access was allowed';
 exception when insufficient_privilege then null; end;
end;$test$;
rollback;
