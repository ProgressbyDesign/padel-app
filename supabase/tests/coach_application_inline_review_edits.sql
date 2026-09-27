-- Local/disposable database only. Requires the Pass 2 migration.
-- Exercises actual authenticated RLS, invoker RPCs and audit rollback.
begin;
create function pg_temp.expect_error(command text, expected_code text) returns void
language plpgsql as $$
begin
  begin
    execute command;
  exception when others then
    if sqlstate = expected_code then return; end if;
    raise;
  end;
  raise exception 'Expected error % for %', expected_code, command;
end;
$$;
create function pg_temp.assert_true(condition boolean, message text) returns void
language plpgsql as $$ begin if condition is distinct from true then raise exception '%', message; end if; end; $$;

insert into auth.users(id,email) values
 ('77000000-0000-4000-8000-000000000001','inline-owner@example.invalid'),
 ('77000000-0000-4000-8000-000000000002','inline-reviewer@example.invalid'),
 ('77000000-0000-4000-8000-000000000003','inline-operations@example.invalid'),
 ('77000000-0000-4000-8000-000000000004','inline-support@example.invalid'),
 ('77000000-0000-4000-8000-000000000005','inline-applicant@example.invalid');
insert into public.admin_memberships(user_id,role,status) values
 ('77000000-0000-4000-8000-000000000001','owner','active'),
 ('77000000-0000-4000-8000-000000000002','reviewer','active'),
 ('77000000-0000-4000-8000-000000000003','operations','active'),
 ('77000000-0000-4000-8000-000000000004','support','active');
select set_config('request.jwt.claim.sub','77000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"77000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.coaches(id,name,description) values
 ('77000000-0000-4000-8000-000000000009','Inline claim target','Original profile content');
insert into public.coach_profile_applications
 (id,user_id,applicant_email,status,full_name,phone,coaching_role,experience_years,player_levels,audiences,outcomes,updated_at)
values ('77000000-0000-4000-8000-000000000010','77000000-0000-4000-8000-000000000005',
 'inline-applicant@example.invalid','under_review','Original Applicant','123456789','padel_coach',3,
 array['beginner'],array['adults'],array['learn_fundamentals'],now()-interval '1 day');

set local role authenticated;
do $$
declare
 app_id uuid := '77000000-0000-4000-8000-000000000010';
 revision timestamptz;
 role_user uuid;
 command text;
begin
 -- Owner, reviewer and operations can make corrections; all RPCs remain under RLS.
 foreach role_user in array array[
  '77000000-0000-4000-8000-000000000001'::uuid,
  '77000000-0000-4000-8000-000000000002'::uuid,
  '77000000-0000-4000-8000-000000000003'::uuid] loop
   perform set_config('request.jwt.claim.sub',role_user::text,true);
   select updated_at into revision from public.coach_profile_applications where id=app_id;
   perform public.admin_update_coach_application_applicant(app_id,revision,'Reviewed Applicant','+34 123456789','head_coach',null,12);
 end loop;
 select updated_at into revision from public.coach_profile_applications where id=app_id;
 command := format('select public.admin_update_coach_application_applicant(%L,%L,''Rejected edit'',''123456789'',''head_coach'',null,12)',app_id,revision);
 -- Support and the ordinary applicant cannot call any card RPC.
 foreach role_user in array array['77000000-0000-4000-8000-000000000004'::uuid,'77000000-0000-4000-8000-000000000005'::uuid] loop
   perform set_config('request.jwt.claim.sub',role_user::text,true);
   perform pg_temp.expect_error(command,'42501');
   perform pg_temp.expect_error(format('select public.admin_update_coach_application_profile(%L,%L,null,array[''advanced''],array[''adults''],array[''improve_technique''])',app_id,revision),'42501');
   perform pg_temp.expect_error(format('select public.admin_update_coach_application_locations(%L,%L,''[{"country":"Spain","city":"Madrid","is_primary":true}]'')',app_id,revision),'42501');
 end loop;
 perform set_config('request.jwt.claim.sub','77000000-0000-4000-8000-000000000002',true);
 perform pg_temp.expect_error(format('select public.admin_update_coach_application_applicant(%L,%L,''Stale'',''123456789'',''head_coach'',null,12)',app_id,revision-interval '1 day'),'40001');
 perform pg_temp.expect_error(format('select public.admin_update_coach_application_applicant(%L,%L,''Valid Name'',''12'',''invalid'',null,61)',app_id,revision),'23514');
 perform pg_temp.expect_error(format('select public.admin_update_coach_application_profile(%L,%L,null,array[''invalid''],array[''adults''],array[''improve_technique''])',app_id,revision),'23514');
 perform public.admin_update_coach_application_profile(app_id,revision,'Reviewed coaching introduction with enough characters to be valid.',array['advanced'],array['juniors'],array['prepare_for_competition']);
 select updated_at into revision from public.coach_profile_applications where id=app_id;
 -- Add, change primary, remove, and validate the entire set atomically.
 perform public.admin_update_coach_application_locations(app_id,revision,'[{"country":"Spain","city":"Madrid","is_primary":true},{"country":"Spain","city":"Barcelona","is_primary":false}]');
 select updated_at into revision from public.coach_profile_applications where id=app_id;
 perform public.admin_update_coach_application_locations(app_id,revision,'[{"country":"Spain","city":"Barcelona","is_primary":true}]');
 perform pg_temp.assert_true((select count(*)=1 and bool_and(city='Barcelona' and is_primary) from public.coach_application_locations where application_id=app_id),'Location replacement failed');
 select updated_at into revision from public.coach_profile_applications where id=app_id;
 foreach command in array array[
   '[]',
   '[{"country":"Spain","city":"Madrid","is_primary":false}]',
   '[{"country":"Spain","city":"Madrid","is_primary":true},{"country":"Spain","city":" madrid ","is_primary":false}]',
   '[{"country":"Spain","city":"Madrid","is_primary":true},{"country":"Spain","city":"Barcelona","is_primary":true}]',
   '[{"country":"Invalid","city":"Madrid","is_primary":true}]',
   '[{"country":"Spain","city":"Madrid","is_primary":true,"application_id":"other"}]'
 ] loop
   perform pg_temp.expect_error(format('select public.admin_update_coach_application_locations(%L,%L,%L)',app_id,revision,command),'23514');
 end loop;
 perform pg_temp.assert_true((select count(*)=1 and bool_and(city='Barcelona') from public.coach_application_locations where application_id=app_id),'Invalid save lost original locations');
 -- Email, ownership and linked coach fields have not moved.
 perform pg_temp.assert_true((select applicant_email='inline-applicant@example.invalid'
   and user_id='77000000-0000-4000-8000-000000000005' and target_coach_id is null and coach_id is null
   from public.coach_profile_applications where id=app_id),'Identity changed during card edits');
end;
$$;
reset role;

-- All card types audited using field names only, with the verified actor.
select pg_temp.assert_true((select count(distinct action)=3 from public.admin_audit_log
 where target_id='77000000-0000-4000-8000-000000000010'),'Missing card audit events');
select pg_temp.assert_true(not exists(select 1 from public.admin_audit_log
 where target_id='77000000-0000-4000-8000-000000000010'
 and ((details-'changedFields') <> '{}'::jsonb or details::text like '%Reviewed Applicant%' or details::text like '%example.invalid%')),'Audit contains field values');

-- Audit insertion failure must roll back the edit.
create function pg_temp.reject_card_audit() returns trigger language plpgsql as $$ begin raise exception 'test audit failure' using errcode='23514'; end; $$;
create trigger test_reject_card_audit before insert on public.admin_audit_log for each row execute function pg_temp.reject_card_audit();
set local role authenticated;
do $$ declare revision timestamptz; begin
 select updated_at into revision from public.coach_profile_applications where id='77000000-0000-4000-8000-000000000010';
 perform pg_temp.expect_error(format('select public.admin_update_coach_application_applicant(''77000000-0000-4000-8000-000000000010'',%L,''Must Roll Back'',''123456789'',''head_coach'',null,1)',revision),'23514');
 perform pg_temp.assert_true((select full_name='Reviewed Applicant' from public.coach_profile_applications where id='77000000-0000-4000-8000-000000000010'),'Audit failure persisted an edit');
end; $$;
reset role;
drop trigger test_reject_card_audit on public.admin_audit_log;

-- Approval still consumes the corrected proposal without publishing it.
do $$ declare coach_id_value uuid; begin
 perform set_config('request.jwt.claim.sub','77000000-0000-4000-8000-000000000001',true);
 insert into public.coaches(name) values('Reviewed Applicant') returning id into coach_id_value;
 update public.coach_profile_applications set status='approved',coach_id=coach_id_value
  where id='77000000-0000-4000-8000-000000000010';
 perform pg_temp.assert_true((select is_approved and publication_status='private' and role='Head coach' and experience_years=12
  from public.coaches where id=coach_id_value),'Approval did not apply corrected details or published the coach');
 perform pg_temp.assert_true(exists(select 1 from public.coach_locations where coach_id=coach_id_value and city='Barcelona' and is_primary),'Approval did not seed corrected location');
 perform pg_temp.assert_true(exists(select 1 from public.coach_attributes where coach_id=coach_id_value and player_levels=array['advanced'] and audience_juniors),'Approval did not seed corrected coaching profile');
 perform pg_temp.assert_true(exists(select 1 from public.coach_memberships where coach_id=coach_id_value and user_id='77000000-0000-4000-8000-000000000005' and membership_role='owner'),'Approval lost owner membership');
end; $$;

-- Every status is checked on the locked parent; historical claims may be
-- corrected by reviewers, but their target and the existing coach stay intact.
do $$ declare state text; app_id uuid; begin
 foreach state in array array['submitted','under_review','changes_requested','draft','approved','declined','withdrawn'] loop
  app_id := gen_random_uuid();
  insert into public.coach_profile_applications(id,user_id,applicant_email,status,application_mode,target_coach_id,full_name,phone,coaching_role,experience_years)
   values(app_id,'77000000-0000-4000-8000-000000000005','inline-applicant@example.invalid',state,'claim_existing','77000000-0000-4000-8000-000000000009','Claim proposal','123456789','padel_coach',3);
  execute 'set local role authenticated';
  if state in ('submitted','under_review','changes_requested') then
   perform public.admin_update_coach_application_applicant(app_id,(select updated_at from public.coach_profile_applications where id=app_id),'Corrected claim','123456789','head_coach',null,7);
  else
   perform pg_temp.expect_error(format('select public.admin_update_coach_application_applicant(%L,%L,''Invalid edit'',''123456789'',''head_coach'',null,7)',app_id,(select updated_at from public.coach_profile_applications where id=app_id)),'42501');
   perform pg_temp.expect_error(format('select public.admin_update_coach_application_profile(%L,%L,null,array[''advanced''],array[''adults''],array[''improve_technique''])',app_id,(select updated_at from public.coach_profile_applications where id=app_id)),'42501');
   perform pg_temp.expect_error(format('select public.admin_update_coach_application_locations(%L,%L,''[{"country":"Spain","city":"Madrid","is_primary":true}]'')',app_id,(select updated_at from public.coach_profile_applications where id=app_id)),'42501');
  end if;
  execute 'reset role';
 end loop;
 perform pg_temp.assert_true((select name='Inline claim target' and description='Original profile content' and publication_status='private' from public.coaches where id='77000000-0000-4000-8000-000000000009'),'Editing claim modified target coach');
end; $$;
rollback;
