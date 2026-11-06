-- Disposable database only, after the harness and three Phase B migrations.
-- Real PostgreSQL roles, grants, RLS, triggers and transactions; no production data.
begin;
create function pg_temp.test_id(n integer) returns uuid language sql as $$
 select ('d0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.actor(n integer) returns void language sql as $$
 select set_config('request.jwt.claim.sub',pg_temp.test_id(n)::text,true);
$$;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end;
$$;
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then if sqlstate=expected then return; end if; raise; end;
  raise exception 'Expected SQLSTATE %: %',expected,command;
end; $$;
create function pg_temp.cmd(command text,payload jsonb) returns jsonb language sql as $$
 select public.passport_command(command,payload,gen_random_uuid());
$$;
create function pg_temp.remember(key text,value jsonb) returns void language sql as $$
 select set_config('passport.test.'||key,value->>'id',true);
$$;
create function pg_temp.ref(key text) returns uuid language sql as $$ select current_setting('passport.test.'||key)::uuid; $$;
create function pg_temp.pay(key text,event text) returns jsonb language sql as $$
 select public.passport_provider_event('payment',event,jsonb_build_object('order_id',pg_temp.ref(key),'amount_minor',3500,'currency','GBP','payment_reference','mock:payment:'||key));
$$;
create function pg_temp.media(order_key text,attempt_key text,stage text,event text) returns jsonb language sql as $$
 select public.passport_provider_event('media',event,jsonb_build_object('order_id',pg_temp.ref(order_key),'attempt_id',pg_temp.ref(attempt_key),
   'stage',stage,'provider','mock','provider_reference','mock:video:'||attempt_key,'duration_seconds',80,'bytes',12000,'mime_type','video/mp4'));
$$;
insert into auth.users(id) select pg_temp.test_id(i) from generate_series(1,8) i;
insert into public.coaches(id,name,is_approved) values(pg_temp.test_id(9),'Test approved coach',true),(pg_temp.test_id(10),'Other approved coach',true);
insert into public.coach_memberships values(pg_temp.test_id(9),pg_temp.test_id(4)),(pg_temp.test_id(9),pg_temp.test_id(8)),(pg_temp.test_id(10),pg_temp.test_id(5));
insert into public.admin_memberships values(pg_temp.test_id(1),'owner','active'),(pg_temp.test_id(6),'operations','active'),(pg_temp.test_id(7),'support','active');
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.assert_true((select count(*)=0 from public.pp_standards),'draft rubrics are not player content');
select pg_temp.expect_error($q$select pg_temp.cmd('create_order','{}')$q$,'42501');
select pg_temp.expect_error($q$select public.passport_provider_event('payment','forged','{}')$q$,'42501');
select pg_temp.expect_error($q$update public.pp_orders set payment_state='paid'$q$,'42501');
select pg_temp.expect_error($q$insert into public.pp_skill_verifications(id) values(gen_random_uuid())$q$,'42501');
reset role;
-- The release switch is DBA-only and remains false in the actual migration.
update private.pp_runtime set enabled=true;
set local role authenticated;
select pg_temp.actor(7);
select pg_temp.expect_error($q$select pg_temp.cmd('set_assessor','{"status":"approved","reason":"Support cannot grant scope"}')$q$,'42501');
select pg_temp.actor(6);
select pg_temp.expect_error($q$select pg_temp.cmd('publish_policy','{"id":"c0000000-0000-4000-8000-000000000001","reason":"Not authorised for commercial terms"}')$q$,'42501');
select pg_temp.actor(1);
select pg_temp.cmd('publish_standard','{"id":"a0000000-0000-4000-8000-000000000002","reason":"Disposable test approves draft rubric"}');
select pg_temp.cmd('publish_policy','{"id":"c0000000-0000-4000-8000-000000000001","reason":"Disposable test approves commercial proposal"}');
select pg_temp.remember('grant',pg_temp.cmd('set_assessor',jsonb_build_object('coach_id',pg_temp.test_id(9),'assessor_user_id',pg_temp.test_id(4),
 'skill_id','improver-bandeja','credential_reference','mock:private-credential','status','approved','credentials_verified',true,'reason','Credentials checked in disposable test')));
select pg_temp.remember('grant2',pg_temp.cmd('set_assessor',jsonb_build_object('coach_id',pg_temp.test_id(9),'assessor_user_id',pg_temp.test_id(8),
 'pathway_id','improver','credential_reference','mock:private-credential-2','status','approved','credentials_verified',true,'reason','Second scoped assessor for reassignment')));
select pg_temp.actor(4);
select pg_temp.remember('offer',pg_temp.cmd('create_offer',jsonb_build_object('grant_id',pg_temp.ref('grant'),
 'standard_id','a0000000-0000-4000-8000-000000000002','price_minor',3500,'currency','GBP')));
select pg_temp.actor(2);
select pg_temp.remember('order',public.passport_command('create_order',jsonb_build_object('offer_id',pg_temp.ref('offer'),'policy_id','c0000000-0000-4000-8000-000000000001','price_minor',1,'payment_state','paid'),pg_temp.test_id(20)));
select pg_temp.assert_true((select price_minor=3500 and commission_minor=700 and coach_earnings_minor=2800 and payment_state='pending' from public.pp_orders where id=pg_temp.ref('order')),'player cannot set purchase price or payment state');
select pg_temp.assert_true((public.passport_command('create_order',jsonb_build_object('offer_id',pg_temp.ref('offer'),'policy_id','c0000000-0000-4000-8000-000000000001','price_minor',1,'payment_state','paid'),pg_temp.test_id(20))->>'id')::uuid=pg_temp.ref('order'),'idempotent order');
select pg_temp.expect_error($q$select public.passport_command('create_order','{}',pg_temp.test_id(20))$q$,'23505');
select pg_temp.expect_error($q$select pg_temp.cmd('begin_attempt',jsonb_build_object('order_id',pg_temp.ref('order')))$q$,'23514');
select pg_temp.cmd('complete_lesson','{"lesson_id":"b0000000-0000-4000-8000-000000000002"}');
select pg_temp.assert_true((select count(*)=0 from public.pp_skill_verifications),'lesson completion never verifies');
select pg_temp.actor(3);
select pg_temp.assert_true((select count(*)=0 from public.pp_orders),'other player cannot read order');
select pg_temp.expect_error($q$select pg_temp.cmd('begin_attempt',jsonb_build_object('order_id',pg_temp.ref('order')))$q$,'42501');
reset role;
set local role service_role;
select pg_temp.expect_error($q$update public.pp_orders set payment_state='paid'$q$,'42501');
select pg_temp.expect_error($q$update private.pp_runtime set enabled=true$q$,'42501');
select pg_temp.pay('order','payment-1');
select pg_temp.pay('order','payment-1');
select pg_temp.pay('order','payment-repeat-reference');
select pg_temp.expect_error($q$select public.passport_provider_event('payment','payment-1',jsonb_build_object('order_id',pg_temp.ref('order'),'amount_minor',1,'currency','GBP'))$q$,'23505');
select pg_temp.assert_true((select review_due_at is null from public.pp_orders where id=pg_temp.ref('order')),'payment does not start clock');
reset role;
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.remember('attempt1',pg_temp.cmd('begin_attempt',jsonb_build_object('order_id',pg_temp.ref('order'))));
select pg_temp.expect_error($q$select pg_temp.cmd('begin_attempt',jsonb_build_object('order_id',pg_temp.ref('order')))$q$,'23514');
select pg_temp.actor(3);
select pg_temp.assert_true((select count(*)=0 from public.pp_submission_attempts),'other player cannot read submission');
select pg_temp.actor(5);
select pg_temp.assert_true((select count(*)=0 from public.pp_submission_attempts),'unassigned coach cannot read submission');
select pg_temp.expect_error($q$select pg_temp.cmd('submit_review',jsonb_build_object('order_id',pg_temp.ref('order'),'outcome','verified'))$q$,'42501');
reset role;
set local role service_role;
select public.passport_provider_event('media','technical-failure',jsonb_build_object('order_id',pg_temp.ref('order'),'attempt_id',pg_temp.ref('attempt1'),'stage','failed','reason','Connection interrupted during upload'));
select public.passport_provider_event('media','technical-failure',jsonb_build_object('order_id',pg_temp.ref('order'),'attempt_id',pg_temp.ref('attempt1'),'stage','failed','reason','Connection interrupted during upload'));
reset role;
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.remember('attempt2',pg_temp.cmd('begin_attempt',jsonb_build_object('order_id',pg_temp.ref('order'))));
select pg_temp.assert_true((select count(*)=2 from public.pp_submission_attempts),'technical retry preserves both attempts');
select pg_temp.assert_true((select payment_state='paid' and price_minor=3500 from public.pp_orders where id=pg_temp.ref('order')),'technical retry keeps original payment');
reset role;
set local role service_role;
select pg_temp.media('order','attempt2','uploaded','uploaded-2');
select pg_temp.media('order','attempt2','processing','processing-2');
select pg_temp.assert_true((select review_due_at is null from public.pp_orders where id=pg_temp.ref('order')),'upload/processing do not start clock');
select pg_temp.expect_error($q$select public.passport_provider_event('media','too-long',jsonb_build_object('order_id',pg_temp.ref('order'),'attempt_id',pg_temp.ref('attempt2'),'stage','ready','provider','mock','provider_reference','mock:video:attempt2','duration_seconds',91,'bytes',12000,'mime_type','video/mp4'))$q$,'23514');
select pg_temp.media('order','attempt2','ready','ready-2');
select pg_temp.media('order','attempt2','ready','ready-2');
select pg_temp.assert_true((select review_due_at=clock_started_at+interval '72 hours' and clock_started_at>=now() from public.pp_orders where id=pg_temp.ref('order')),'playable availability starts 72 hour clock');
reset role;
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.cmd('set_assessor',jsonb_build_object('id',pg_temp.ref('grant'),'status','suspended','reason','Temporary eligibility suspension for test'));
select pg_temp.actor(4);
select pg_temp.assert_true((select count(*)=0 from public.pp_submission_attempts),'suspended assessor loses private evidence access');
select pg_temp.expect_error($q$select pg_temp.cmd('submit_review',jsonb_build_object('order_id',pg_temp.ref('order'),'outcome','verified'))$q$,'42501');
select pg_temp.actor(1);
select pg_temp.cmd('set_assessor',jsonb_build_object('id',pg_temp.ref('grant'),'status','approved','credentials_verified',true,'reason','Credentials rechecked for disposable test'));
reset role;
update public.pp_orders set review_due_at=now()+interval '1 hour' where id=pg_temp.ref('order');
set local role authenticated;
select pg_temp.actor(4);
select pg_temp.cmd('start_review',jsonb_build_object('order_id',pg_temp.ref('order')));
select pg_temp.expect_error($q$select pg_temp.cmd('submit_review',jsonb_build_object('order_id',pg_temp.ref('order'),'outcome','replacement_requested','observations','The evidence is not clear enough.'))$q$,'23514');
select pg_temp.cmd('submit_review',jsonb_build_object('order_id',pg_temp.ref('order'),'outcome','replacement_requested','observations','The contact and player are out of view.',
 'replacement_reason','Player not visible at contact.','recording_guidance','Record from the side with full body and ball in frame.'));
select pg_temp.assert_true((select state='replacement_requested' and completed_at is null and review_due_at is null from public.pp_orders where id=pg_temp.ref('order')),'unassessable is not delivered and clock pauses');
select pg_temp.actor(2);
select pg_temp.remember('attempt3',pg_temp.cmd('begin_attempt',jsonb_build_object('order_id',pg_temp.ref('order'))));
select pg_temp.assert_true((select max(attempt_number)=3 from public.pp_submission_attempts),'free replacement has next attempt number');
select pg_temp.assert_true((select count(*)=1 from public.pp_orders),'replacement has not created another order or charge');
reset role;
set local role service_role;
select pg_temp.media('order','attempt3','uploaded','uploaded-3');
select pg_temp.media('order','attempt3','ready','ready-3');
select pg_temp.assert_true((select review_due_at=clock_started_at+interval '72 hours' from public.pp_orders where id=pg_temp.ref('order')),'reset policy starts full clock after replacement');
select pg_temp.expect_error($q$select pg_temp.media('order','attempt2','ready','stale-attempt')$q$,'23514');
reset role;
set local role authenticated;
select pg_temp.actor(4);
select pg_temp.cmd('submit_review',jsonb_build_object('order_id',pg_temp.ref('order'),'outcome','developing','observations','Balanced preparation is improving but contact varies.',
 'positive_feedback','Early preparation gives good time.','areas_for_improvement','Keep the contact point more consistent.','practice_tasks',jsonb_build_array('Practise gentle feeds with a stable contact point.'),
 'next_step','Repeat controlled contact drills on court.','criteria_results','{"position":true,"contact":false}'::jsonb));
select pg_temp.assert_true((select state='completed' and payment_state='paid' and completed_at is not null from public.pp_orders where id=pg_temp.ref('order')),'Developing delivers the paid service');
select pg_temp.assert_true((select count(*)=0 from public.pp_skill_verifications),'Developing never creates a verification');
select pg_temp.actor(2);
select pg_temp.expect_error($q$select pg_temp.cmd('begin_attempt',jsonb_build_object('order_id',pg_temp.ref('order')))$q$,'23514');
select pg_temp.remember('reassessment',pg_temp.cmd('create_order',jsonb_build_object('offer_id',pg_temp.ref('offer'),'policy_id','c0000000-0000-4000-8000-000000000001','parent_order_id',pg_temp.ref('order'))));
select pg_temp.assert_true((select id<>parent_order_id and payment_state='pending' from public.pp_orders where id=pg_temp.ref('reassessment')),'reassessment is a separate unpaid order');
select pg_temp.expect_error($q$select pg_temp.cmd('begin_attempt',jsonb_build_object('order_id',pg_temp.ref('reassessment')))$q$,'23514');
reset role;
set local role service_role;
select pg_temp.pay('reassessment','payment-2');
reset role;
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.remember('reassessment1',pg_temp.cmd('begin_attempt',jsonb_build_object('order_id',pg_temp.ref('reassessment'))));
reset role;
set local role service_role;
select pg_temp.media('reassessment','reassessment1','uploaded','reassessment-upload');
select pg_temp.media('reassessment','reassessment1','ready','reassessment-ready');
reset role;
-- Simulate overdue time only in the disposable fixture; no automatic refund.
update public.pp_orders set review_due_at=now()-interval '1 hour' where id=pg_temp.ref('reassessment');
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.cmd('escalate',jsonb_build_object('order_id',pg_temp.ref('reassessment'),'reason','Review target is overdue and needs admin action.'));
select pg_temp.assert_true((select payment_state='paid' and refund_state='none' from public.pp_orders where id=pg_temp.ref('reassessment')),'overdue does not auto refund');
select pg_temp.cmd('reassign',jsonb_build_object('order_id',pg_temp.ref('reassessment'),'grant_id',pg_temp.ref('grant2'),'reason','Assign eligible colleague within purchased coach.'));
select pg_temp.actor(4);
select pg_temp.assert_true((select count(*)=1 from public.pp_orders),'previous assessor only sees their historical first order');
select pg_temp.actor(8);
select pg_temp.expect_error($q$select pg_temp.cmd('submit_review',jsonb_build_object('order_id',pg_temp.ref('reassessment'),'outcome','verified','observations','All criteria appear met but no checklist recorded.'))$q$,'23514');
select set_config('passport.test.final_payload',jsonb_build_object('order_id',pg_temp.ref('reassessment'),'outcome','verified','observations','Preparation and contact meet both criteria in the submitted evidence.',
 'positive_feedback','Balanced movement and consistent control.','areas_for_improvement','Continue improving control under match pressure.','practice_tasks',jsonb_build_array('Repeat controlled bandejas in a cooperative rally.'),
 'next_step','Apply the bandeja in a conditioned practice rally.','criteria_results','{"position":true,"contact":true}'::jsonb)::text,true);
select public.passport_command('submit_review',current_setting('passport.test.final_payload')::jsonb,pg_temp.test_id(21));
select public.passport_command('submit_review',current_setting('passport.test.final_payload')::jsonb,pg_temp.test_id(21));
select pg_temp.assert_true((select count(*)=1 from public.pp_skill_verifications),'authorised verified assessment creates exactly one achievement');
select pg_temp.expect_error($q$select pg_temp.cmd('submit_review',current_setting('passport.test.final_payload')::jsonb)$q$,'23514');
select pg_temp.actor(1);
select pg_temp.cmd('set_assessor',jsonb_build_object('id',pg_temp.ref('grant2'),'status','revoked','reason','Test revocation after completed verification.'));
select pg_temp.cmd('resolve_escalation',jsonb_build_object('order_id',pg_temp.ref('reassessment'),'reason','Assessment delivered by authorised replacement assessor.'));
select pg_temp.actor(2);
select pg_temp.assert_true((select count(*)=1 from public.pp_passport_achievements),'historical verification survives assessor revocation');
select pg_temp.assert_true((select count(*)=3 from public.pp_reviews),'replacement reason, Developing and Verified all remain in player history');
select pg_temp.assert_true((select latest_outcome='verified' and active_verification_count=1 and length(next_step)>10 from public.pp_passport_skill_records),'Passport latest outcome and next step are backed by recorded review');
select pg_temp.assert_true((select terms_snapshot->>'standard_version'='1' from public.pp_orders where id=pg_temp.ref('order')),'original curriculum version is retained');
reset role;
select pg_temp.expect_error($q$update public.pp_standards set criteria='[]' where id='a0000000-0000-4000-8000-000000000002'$q$,'23514');
select pg_temp.expect_error($q$update public.pp_orders set price_minor=1 where id=pg_temp.ref('order')$q$,'23514');
select pg_temp.expect_error($q$update public.pp_reviews set next_step='Rewrite history'$q$,'23514');
select pg_temp.assert_true((select count(*)=0 from public.pp_reviews r join public.pp_orders o on o.id=r.order_id where r.outcome<>'replacement_requested' and o.state<>'completed'),'final reviews and orders agree');
select pg_temp.assert_true((select count(*)=0 from public.pp_skill_verifications v join public.pp_reviews r on r.id=v.review_id where r.outcome<>'verified'),'all achievements have verified provenance');
select pg_temp.assert_true((select count(*)>=3 from public.pp_audit where action='set_assessor' and details ? 'grant_status'),'assessor state history is audited');
-- Exercise the alternative, configurable replacement clock.
insert into public.pp_policies(id,version,terms,commission_bps,replacement_clock) values
 ('c0000000-0000-4000-8000-000000000002',2,'Disposable policy with explicit resume-remaining clock.',2000,'resume_remaining');
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.cmd('publish_policy','{"id":"c0000000-0000-4000-8000-000000000002","reason":"Disposable test of alternative clock policy"}');
select pg_temp.actor(2);
select pg_temp.remember('resume',pg_temp.cmd('create_order',jsonb_build_object('offer_id',pg_temp.ref('offer'),'policy_id','c0000000-0000-4000-8000-000000000002')));
reset role;
set local role service_role;
select pg_temp.pay('resume','payment-resume');
reset role;
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.remember('resume1',pg_temp.cmd('begin_attempt',jsonb_build_object('order_id',pg_temp.ref('resume'))));
reset role;
set local role service_role;
select pg_temp.media('resume','resume1','uploaded','resume-upload-1');
select pg_temp.media('resume','resume1','ready','resume-ready-1');
reset role;
update public.pp_orders set review_due_at=now()+interval '1 hour' where id=pg_temp.ref('resume');
set local role authenticated;
select pg_temp.actor(4);
select pg_temp.cmd('submit_review',jsonb_build_object('order_id',pg_temp.ref('resume'),'outcome','replacement_requested',
 'observations','The recording angle obscures the contact point.','replacement_reason','Contact is not clearly visible.','recording_guidance','Reposition the camera to show the full swing.'));
select pg_temp.actor(2);
select pg_temp.remember('resume2',pg_temp.cmd('begin_attempt',jsonb_build_object('order_id',pg_temp.ref('resume'))));
reset role;
set local role service_role;
select pg_temp.media('resume','resume2','uploaded','resume-upload-2');
select pg_temp.media('resume','resume2','ready','resume-ready-2');
select pg_temp.assert_true((select review_due_at=clock_started_at+make_interval(secs=>remaining_review_seconds) and remaining_review_seconds between 3590 and 3600 from public.pp_orders where id=pg_temp.ref('resume')),'resume policy preserves remaining review time');
reset role;
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.expect_error($q$select pg_temp.cmd('cancel_order',jsonb_build_object('order_id',pg_temp.ref('resume'),'reason','Player cannot self cancel after payment.'))$q$,'23514');
select pg_temp.actor(1);
select pg_temp.cmd('cancel_order',jsonb_build_object('order_id',pg_temp.ref('resume'),'reason','Admin agrees paid cancellation pending refund.'));
select pg_temp.assert_true((select state='cancelled' and refund_state='requested' and review_due_at is null from public.pp_orders where id=pg_temp.ref('resume')),'paid cancellation requests resolution without issuing money');
select pg_temp.cmd('request_refund',jsonb_build_object('order_id',pg_temp.ref('reassessment'),'reason','Admin approves refund after commercial resolution.'));
reset role;
set local role service_role;
select public.passport_provider_event('refund','refund-1',jsonb_build_object('order_id',pg_temp.ref('reassessment'),'amount_minor',3500,'currency','GBP'));
select public.passport_provider_event('refund','refund-1',jsonb_build_object('order_id',pg_temp.ref('reassessment'),'amount_minor',3500,'currency','GBP'));
select pg_temp.assert_true((select state='completed' and payment_state='refunded' and completed_at is not null from public.pp_orders where id=pg_temp.ref('reassessment')),'recorded refund preserves assessment history');
reset role;
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.cmd('revoke_verification',jsonb_build_object('order_id',pg_temp.ref('reassessment'),'reason','Explicit audited correction of this verification.'));
select pg_temp.actor(2);
select pg_temp.assert_true((select status='revoked' and revoked_at is not null from public.pp_skill_verifications),'revocation keeps provenance');
reset role;
insert into public.pp_standards(id,skill_id,version,criteria,evidence_requirements) values
 ('a0000000-0000-4000-8000-000000000003','improver-bandeja',2,'[{"id":"new-control","expectation":"A new draft control criterion for the next standard."}]',
  '{"camera":"New draft angle","repetitions":"New draft sample","max_seconds":60}');
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.cmd('publish_standard','{"id":"a0000000-0000-4000-8000-000000000003","reason":"Publish separate version for disposable history test"}');
select pg_temp.cmd('retire_standard','{"id":"a0000000-0000-4000-8000-000000000002","reason":"Retire original standard only for new purchases"}');
select pg_temp.actor(2);
select pg_temp.assert_true((select terms_snapshot->>'standard_version'='1' and standard_id='a0000000-0000-4000-8000-000000000002' from public.pp_orders where id=pg_temp.ref('order')),'new curriculum never rewrites prior assessment version');
select pg_temp.expect_error($q$select pg_temp.cmd('create_order',jsonb_build_object('offer_id',pg_temp.ref('offer'),'policy_id','c0000000-0000-4000-8000-000000000001'))$q$,'23514');
reset role;
select pg_temp.assert_true(not exists(
 select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
 and n.nspname in ('public','private') and c.relname like 'pp\_%' escape '\' and not c.relrowsecurity),'all Passport tables have RLS');
select pg_temp.assert_true(not exists(
 select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated','service_role')
 and table_name like 'pp\_%' escape '\' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')),'no direct client or worker table mutation grants');
set local role anon;
select pg_temp.expect_error($q$select * from public.pp_assessor_grants$q$,'42501');
select pg_temp.expect_error($q$select public.passport_command('create_order','{}',gen_random_uuid())$q$,'42501');
reset role;
rollback;
