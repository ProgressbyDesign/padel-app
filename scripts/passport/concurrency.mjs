import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

/** Separate TCP connections and observed PostgreSQL lock waits, not a JS mock. */
export async function exerciseConcurrentOperations(connect) {
  const clients = new Set(); const checks = [];
  async function client() { const db = await connect(); clients.add(db); return db; }
  const root = await client();
  const owner = randomUUID(), player = randomUUID(), stranger = randomUUID(), assessor = randomUUID(), otherCoach = randomUUID();
  const coach = randomUUID(); const support = randomUUID();
  const standard = 'a0000000-0000-4000-8000-000000000002';
  const policy = 'c0000000-0000-4000-8000-000000000001';
  let grant, offer;
  const check = (label) => { checks.push(label); console.log('PASS', label); };
  async function session(actor, role = 'authenticated') {
    assert.ok(['authenticated','service_role','anon'].includes(role));
    const db = await client();
    await db.query(`set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [actor ?? '', JSON.stringify({sub:actor,role,email:'fixture@example.invalid'})]);
    return db;
  }
  const command = (db, name, payload, request = randomUUID()) => db.query('select public.passport_command($1,$2,$3) result', [name,payload,request]).then(r => r.rows[0].result);
  const event = (db, source, payload, key = randomUUID()) => db.query('select public.passport_provider_event($1,$2,$3) result', [source,key,payload]).then(r => r.rows[0].result);
  const value = async (sql, params = []) => (await root.query(sql, params)).rows[0];
  async function denies(promise, code = '42501') {
    await assert.rejects(promise, error => error.code === code);
  }
  async function blocked(db) {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const row = await value('select wait_event_type from pg_stat_activity where pid=$1', [db.processID]);
      if (row?.wait_event_type === 'Lock') return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error(`Connection ${db.processID} did not reach the intended lock barrier`);
  }
  async function race(calls) {
    const barrier = await client(); await barrier.query('begin; select pg_advisory_xact_lock(812417032)');
    const pending = calls.map(([db, invoke]) => ({ db, result: invoke().then(result => ({ok:true,result}), error => ({ok:false,code:error.code})) }));
    try { await Promise.all(pending.map(p => blocked(p.db))); }
    finally { await barrier.query('commit'); }
    return Promise.all(pending.map(p => p.result));
  }
  function finalPayload(order, outcome = 'verified') {
    return {order_id:order,outcome,observations:'Preparation and controlled contact are clearly visible in this synthetic evidence.',
      positive_feedback:'Preparation is balanced and consistent.',areas_for_improvement:'Continue developing consistency under pressure.',
      practice_tasks:['Practise controlled bandejas with cooperative feeds.'],next_step:'Repeat the drill before your next match.',
      criteria_results:{position:true,contact:outcome==='verified'}};
  }
  try {
    // Privileged synthetic fixture setup only. No existing production identities/data.
    await root.query('begin');
    for (const id of [owner,player,stranger,assessor,otherCoach,support]) {
      await root.query('insert into auth.users(id,email) values($1,$2)', [id,`${id}@example.invalid`]);
      // A full Supabase replay attaches the real Auth -> profile trigger.
      await root.query('insert into public.profiles(id,full_name) values($1,$2) on conflict(id) do nothing', [id,'B1 synthetic account']);
    }
    await root.query('insert into public.coaches(id,name,is_approved) values($1,$2,true)', [coach,'B1 synthetic assessor coach']);
    await root.query("insert into public.coach_memberships(coach_id,user_id,membership_role) values($1,$2,'manager')", [coach,assessor]);
    await root.query("insert into public.admin_memberships(user_id,role,status) values($1,'owner','active'),($2,'support','active')", [owner,support]);
    await root.query('commit');
    const p1 = await session(player), p2 = await session(player), a1 = await session(assessor), a2 = await session(assessor);
    const admin = await session(owner), unassigned = await session(otherCoach), outsider = await session(stranger), help = await session(support);
    const worker1 = await session(null,'service_role'), worker2 = await session(null,'service_role'), anon = await session(null,'anon');
    await denies(command(p1,'create_order',{}));
    await denies(event(worker1,'payment',{}));
    check('Release switch blocks player and worker operations before fixture activation');
    await root.query('update private.pp_runtime set enabled=true');
    await command(admin,'publish_standard',{id:standard,reason:'Synthetic full-schema test rubric approval'});
    await command(admin,'publish_policy',{id:policy,reason:'Synthetic full-schema test commercial approval'});
    grant = (await command(admin,'set_assessor',{coach_id:coach,assessor_user_id:assessor,skill_id:'improver-bandeja',credential_reference:'mock:credential',status:'approved',credentials_verified:true,reason:'Synthetic credentials checked by owner'})).id;
    offer = (await command(a1,'create_offer',{grant_id:grant,standard_id:standard,price_minor:3500,currency:'GBP'})).id;
    const orderPayload = {offer_id:offer,policy_id:policy};
    const newOrder = async (extra = {}) => (await command(p1,'create_order',{...orderPayload,...extra})).id;
    const payPayload = (id, reference = `mock:payment:${id}`) => ({order_id:id,amount_minor:3500,currency:'GBP',payment_reference:reference});
    const pay = (id) => event(worker1,'payment',payPayload(id));
    const begin = async (id) => (await command(p1,'begin_attempt',{order_id:id})).id;
    const mediaPayload = (id, attempt, stage) => ({order_id:id,attempt_id:attempt,stage,provider:'mock',provider_reference:`mock:video:${attempt}`,duration_seconds:80,bytes:12000,mime_type:'video/mp4'});
    async function ready(id) {
      const attempt = await begin(id);
      await event(worker1,'media',mediaPayload(id,attempt,'uploaded'));
      await event(worker1,'media',mediaPayload(id,attempt,'ready'));
      return attempt;
    }
    async function paidReady() { const id = await newOrder(); await pay(id); await ready(id); return id; }

    const key = randomUUID();
    let results = await race([[p1,()=>command(p1,'create_order',orderPayload,key)],[p2,()=>command(p2,'create_order',orderPayload,key)]]);
    assert.ok(results.every(r=>r.ok)); assert.equal(results[0].result.id,results[1].result.id);
    const order = results[0].result.id;
    assert.equal((await value('select count(*)::int n from public.pp_orders where player_id=$1',[player])).n,1);
    assert.equal((await value('select count(*)::int n from public.pp_delivered_earnings')).n,0);
    await denies(command(p1,'create_order',{...orderPayload,policy_id:randomUUID()},key),'23505');
    check('Concurrent duplicate creation returns one order; changed idempotency payload rejected; no pending earnings');

    const paymentKey = randomUUID();
    results = await race([[worker1,()=>event(worker1,'payment',payPayload(order),paymentKey)],[worker2,()=>event(worker2,'payment',payPayload(order),paymentKey)]]);
    assert.ok(results.every(r=>r.ok));
    assert.equal((await value("select count(*)::int n from private.pp_provider_events where source='payment' and event_id=$1",[paymentKey])).n,1);
    assert.equal((await value('select count(*)::int n from public.pp_delivered_earnings')).n,0);
    await denies(event(worker1,'payment',{...payPayload(order),amount_minor:1}),'23514');
    const other = await newOrder(); await denies(event(worker1,'payment',payPayload(other,`mock:payment:${order}`)),'23505');
    check('Concurrent payment confirmation records once; amount tampering and payment-reference reuse denied; no undelivered earnings');

    const failed = await begin(order);
    await event(worker1,'media',{order_id:order,attempt_id:failed,stage:'failed',reason:'Synthetic interrupted upload connection'});
    results = await race([[p1,()=>command(p1,'begin_attempt',{order_id:order})],[p2,()=>command(p2,'begin_attempt',{order_id:order})]]);
    assert.equal(results.filter(r=>r.ok).length,1); assert.equal(results.find(r=>!r.ok).code,'23514');
    const attempt = results.find(r=>r.ok).result.id;
    assert.equal((await value('select count(*)::int n from public.pp_submission_attempts where order_id=$1',[order])).n,2);
    check('Concurrent technical retry allocates exactly one new attempt on the same paid order');
    const malformed = mediaPayload(order,attempt,'uploaded'); delete malformed.provider;
    await denies(event(worker1,'media',malformed),'23514');
    await event(worker1,'media',mediaPayload(order,attempt,'uploaded'));
    const readyKey = randomUUID(); const readyEvent = mediaPayload(order,attempt,'ready');
    // Deliberately start before a lock wait. Acceptance must use wall time after the wait.
    const barrier = await client(); await barrier.query('begin; select pg_advisory_xact_lock(812417032)');
    const queued = event(worker1,'media',readyEvent,readyKey);
    await blocked(worker1);
    const releaseAt = Date.now(); await barrier.query('commit'); await queued;
    const clock = await value('select clock_started_at,review_due_at from public.pp_orders where id=$1',[order]);
    assert.ok(clock.clock_started_at.getTime() >= releaseAt-5);
    assert.equal(clock.review_due_at-clock.clock_started_at,72*3600*1000);
    const originalDeadline = clock.review_due_at.getTime();
    results = await race([[worker1,()=>event(worker1,'media',readyEvent,readyKey)],[worker2,()=>event(worker2,'media',readyEvent,readyKey)]]);
    assert.ok(results.every(r=>r.ok));
    await denies(event(worker1,'media',readyEvent),'23514');
    assert.equal((await value('select review_due_at from public.pp_orders where id=$1',[order])).review_due_at.getTime(),originalDeadline);
    check('Queued readiness starts clock after lock acquisition; duplicate webhooks do not reset deadline');

    const replacement = {order_id:order,outcome:'replacement_requested',observations:'Synthetic recording obscures the contact point.',replacement_reason:'Contact is obscured in the supplied recording.',recording_guidance:'Record from the side with the full swing in frame.'};
    await command(a1,'submit_review',replacement);
    const retryKey = randomUUID();
    results = await race([[p1,()=>command(p1,'begin_attempt',{order_id:order},retryKey)],[p2,()=>command(p2,'begin_attempt',{order_id:order},retryKey)]]);
    assert.ok(results.every(r=>r.ok)); assert.equal(results[0].result.id,results[1].result.id);
    const replacementAttempt = results[0].result.id;
    await event(worker1,'media',mediaPayload(order,replacementAttempt,'uploaded'));
    await event(worker1,'media',mediaPayload(order,replacementAttempt,'ready'));
    await denies(event(worker1,'media',mediaPayload(order,attempt,'ready')),'23514');
    check('Concurrent unusable-footage replacement is free and unique; old media cannot revive');

    await denies(event(p1,'payment',payPayload(order)));
    await denies(p1.query("update public.pp_orders set payment_state='paid'"));
    await denies(command(p1,'submit_review',finalPayload(order)));
    await denies(command(unassigned,'submit_review',finalPayload(order)));
    await denies(command(help,'set_assessor',{id:grant,status:'approved',reason:'Support must never grant credentials'}));
    await denies(command(help,'request_refund',{order_id:order,reason:'Support must never approve refunding'}));
    await denies(command(p1,'complete_lesson',{lesson_id:randomUUID()}),'23514');
    for (const table of ['pp_orders','pp_submission_attempts','pp_reviews','pp_skill_verifications','pp_delivered_earnings']) {
      assert.equal((await outsider.query(`select count(*)::int n from public.${table}`)).rows[0].n,0);
      assert.equal((await unassigned.query(`select count(*)::int n from public.${table}`)).rows[0].n,0);
    }
    await denies(anon.query('select * from public.pp_orders'));
    await denies(p1.query('select private.pp_lock_eligible($1,$2)',[grant,'improver-bandeja']));
    await denies(worker1.query('update private.pp_runtime set enabled=false'));
    check('Player isolation, assigned-only evidence, admin matrix, anonymous denial and worker/client write restrictions');

    const reviewKey = randomUUID(); const payload = finalPayload(order,'developing');
    results = await race([[a1,()=>command(a1,'submit_review',payload,reviewKey)],[a2,()=>command(a2,'submit_review',payload,reviewKey)]]);
    assert.ok(results.every(r=>r.ok)); assert.equal(results[0].result.id,results[1].result.id);
    assert.equal((await value('select count(*)::int n from public.pp_reviews where order_id=$1 and outcome<>\'replacement_requested\'',[order])).n,1);
    assert.equal((await value('select count(*)::int n from public.pp_skill_verifications where order_id=$1',[order])).n,0);
    assert.deepEqual(await value('select commission_minor,coach_earnings_minor from public.pp_delivered_earnings where order_id=$1',[order]),{commission_minor:700,coach_earnings_minor:2800});
    await denies(command(p1,'begin_attempt',{order_id:order}),'23514');
    const reassessment = await newOrder({parent_order_id:order});
    await denies(command(p1,'begin_attempt',{order_id:reassessment}),'23514');
    assert.equal((await value('select payment_state from public.pp_orders where id=$1',[reassessment])).payment_state,'pending');
    check('Developing completes exactly once and recognises quoted earnings only after payment/delivery; reassessment needs new payment');

    const verified = await paidReady();
    results = await race([[a1,()=>command(a1,'submit_review',finalPayload(verified))],[a2,()=>command(a2,'submit_review',finalPayload(verified))]]);
    assert.equal(results.filter(r=>r.ok).length,1); assert.equal(results.find(r=>!r.ok).code,'23514');
    assert.equal((await value('select count(*)::int n from public.pp_skill_verifications where order_id=$1',[verified])).n,1);
    check('Different concurrent Verified requests create one immutable review and milestone');

    const suspended = await paidReady();
    const legacy = await client(); await legacy.query('begin');
    await legacy.query('update public.coaches set is_approved=false where id=$1',[coach]);
    const pendingReview = command(a1,'submit_review',finalPayload(suspended)).then(()=>({ok:true}),e=>({ok:false,code:e.code}));
    await blocked(a1); await legacy.query('commit');
    assert.deepEqual(await pendingReview,{ok:false,code:'42501'});
    assert.equal((await a1.query('select count(*)::int n from public.pp_submission_attempts')).rows[0].n,0);
    assert.equal((await p1.query('select count(*)::int n from public.pp_skill_verifications where order_id=$1',[verified])).rows[0].n,1);
    await root.query('update public.coaches set is_approved=true where id=$1',[coach]);
    check('Legacy coach suspension committing first blocks a waiting review; historical verification survives');

    await legacy.query('begin');
    await legacy.query('delete from public.coach_memberships where coach_id=$1 and user_id=$2',[coach,assessor]);
    const memberRace = command(a1,'submit_review',finalPayload(suspended)).then(()=>({ok:true}),e=>({ok:false,code:e.code}));
    await blocked(a1); await legacy.query('commit');
    assert.deepEqual(await memberRace,{ok:false,code:'42501'});
    await root.query("insert into public.coach_memberships(coach_id,user_id) values($1,$2)",[coach,assessor]);
    check('Legacy membership removal committing first blocks a waiting review');

    const heldReview = await paidReady();
    await a1.query('begin'); await command(a1,'submit_review',finalPayload(heldReview));
    const waitingSuspension = legacy.query('update public.coaches set is_approved=false where id=$1',[coach]);
    await blocked(legacy); await a1.query('commit'); await waitingSuspension;
    assert.equal((await value('select count(*)::int n from public.pp_skill_verifications where order_id=$1',[heldReview])).n,1);
    await root.query('update public.coaches set is_approved=true where id=$1',[coach]);
    check('A review committing first holds eligibility rows until completion; later suspension does not rewrite history');

    results = await race([[admin,()=>command(admin,'set_assessor',{id:grant,status:'suspended',reason:'Synthetic suspension concurrent with review'})],[a1,()=>command(a1,'submit_review',finalPayload(suspended))]]);
    assert.ok(results[0].ok);
    const delivered = (await value('select state from public.pp_orders where id=$1',[suspended])).state==='completed';
    assert.equal(delivered,results[1].ok);
    await denies(command(a1,'submit_review',finalPayload(suspended)));
    await command(admin,'set_assessor',{id:grant,status:'approved',credentials_verified:true,reason:'Synthetic reassessment of assessor credentials'});
    check('Explicit grant suspension and final review serialize; suspended assessor cannot issue later decisions');

    const refundOrder = await paidReady();
    results = await race([[admin,()=>command(admin,'request_refund',{order_id:refundOrder,reason:'Synthetic commercial resolution before review'})],[a1,()=>command(a1,'submit_review',finalPayload(refundOrder))]]);
    assert.ok(results[0].ok);
    const beforeRefund = await value('select state,refund_state from public.pp_orders where id=$1',[refundOrder]);
    assert.equal(beforeRefund.refund_state,'requested');
    assert.equal(results[1].ok,beforeRefund.state==='completed');
    const refund = {order_id:refundOrder,amount_minor:3500,currency:'GBP'}; const refundKey = randomUUID();
    results = await race([[worker1,()=>event(worker1,'refund',refund,refundKey)],[worker2,()=>event(worker2,'refund',refund,refundKey)]]);
    assert.ok(results.every(r=>r.ok));
    await denies(command(a1,'submit_review',finalPayload(refundOrder)),'23514');
    await denies(command(p1,'begin_attempt',{order_id:refundOrder}),'23514');
    assert.equal((await value('select count(*)::int n from public.pp_delivered_earnings where order_id=$1 and (commission_minor<>0 or coach_earnings_minor<>0)',[refundOrder])).n,0);
    check('Refund request/review race has a valid serial outcome; duplicate refund applies once; refunded order cannot deliver or earn anew');

    const paymentRace = await newOrder();
    results = await race([[worker1,()=>event(worker1,'payment',payPayload(paymentRace))],[admin,()=>command(admin,'request_refund',{order_id:paymentRace,reason:'Synthetic payment/refund transition race'})]]);
    assert.ok(results[0].ok);
    if (!results[1].ok) { assert.equal(results[1].code,'23514'); await command(admin,'request_refund',{order_id:paymentRace,reason:'Synthetic retry after confirmed payment'}); }
    await event(worker1,'refund',{order_id:paymentRace,amount_minor:3500,currency:'GBP'});
    assert.equal((await value('select payment_state from public.pp_orders where id=$1',[paymentRace])).payment_state,'refunded');
    const unpaid = await newOrder();
    await denies(event(worker1,'refund',{order_id:unpaid,amount_minor:3500,currency:'GBP'}),'23514');
    await command(p1,'cancel_order',{order_id:unpaid,reason:'Synthetic cancellation before payment arrives'});
    await denies(event(worker1,'payment',payPayload(unpaid)),'23514');
    check('Payment/refund concurrency, unsolicited refund and late payment after cancellation fail safely');

    await command(admin,'request_refund',{order_id:verified,reason:'Synthetic refund after a delivered assessment'});
    await event(worker1,'refund',{order_id:verified,amount_minor:3500,currency:'GBP'});
    assert.equal((await value('select count(*)::int n from public.pp_skill_verifications where order_id=$1 and status=\'valid\'',[verified])).n,1);
    await denies(root.query(`insert into public.pp_skill_verifications(order_id,review_id,player_id,skill_id,standard_id,assessor_user_id,coach_id)
      select order_id,review_id,player_id,skill_id,standard_id,assessor_user_id,coach_id from public.pp_skill_verifications where order_id=$1`,[verified]),'23514');
    assert.deepEqual(await value('select commission_minor,coach_earnings_minor from public.pp_delivered_earnings where order_id=$1',[verified]),{commission_minor:0,coach_earnings_minor:0});
    check('Post-delivery refund preserves historical milestone but zeros recognised earnings; verification insert guard rejects refunded funding');

    if ((await value("select to_regprocedure('public.passport_stream_reserve(uuid,uuid,bigint,text,text)') is not null available")).available) {
      await root.query('update public.coaches set is_approved=true where id=$1',[coach]);
      await root.query("insert into public.coach_memberships(coach_id,user_id,membership_role) values($1,$2,'manager') on conflict(coach_id,user_id) do nothing",[coach,assessor]);
      await command(admin,'set_assessor',{id:grant,status:'approved',credentials_verified:true,reason:'Synthetic C2 concurrency credential recheck'});
      const reserve=(db,id,key=randomUUID())=>db.query('select public.passport_stream_reserve($1,$2,$3,$4,$5) result',[id,key,12000,'video/quicktime','f'.repeat(64)]).then(r=>r.rows[0].result);
      const stream=(db,action,data)=>db.query('select public.passport_stream_worker($1,$2) result',[action,{...data,account_id:'a'.repeat(32)}]).then(r=>r.rows[0].result);
      const streamOrder=await newOrder(); await pay(streamOrder);
      const request=randomUUID();
      results=await race([[p1,()=>reserve(p1,streamOrder,request)],[p2,()=>reserve(p2,streamOrder,request)]]);
      assert.ok(results.every(r=>r.ok));assert.equal(results[0].result.id,results[1].result.id);
      const sid=results[0].result.id;
      assert.equal((await value('select count(*)::int n from public.pp_submission_attempts where order_id=$1',[streamOrder])).n,1);
      results=await race([[worker1,()=>stream(worker1,'claim',{id:sid,max_bytes:52428800})],[worker2,()=>stream(worker2,'claim',{id:sid,max_bytes:52428800})]]);
      assert.equal(results.filter(r=>r.ok&&r.result.claimed).length,1);
      const uid=randomUUID().replaceAll('-',''); await stream(worker1,'bind',{id:sid,uid,ciphertext:'synthetic-capability'});
      const metadata={id:sid,uid,stage:'ready',duration:80,bytes:12000};
      results=await race([[worker1,()=>stream(worker1,'reconcile',metadata)],[worker2,()=>stream(worker2,'reconcile',metadata)]]);
      assert.ok(results.every(r=>r.ok));
      const deadline=(await value('select review_due_at from public.pp_orders where id=$1',[streamOrder])).review_due_at;
      await stream(worker2,'reconcile',{...metadata,stage:'failed'});
      assert.equal((await value('select review_due_at from public.pp_orders where id=$1',[streamOrder])).review_due_at.toISOString(),deadline.toISOString());
      check('Stream concurrent reservation/creation/readiness allocates once, binds one UID and ignores late/duplicate decisions without restarting the clock');

      const cancelled=await newOrder(); await pay(cancelled); const cancelledSid=(await reserve(p1,cancelled)).id;
      await stream(worker1,'claim',{id:cancelledSid,max_bytes:52428800}); const cancelledUid=randomUUID().replaceAll('-','');
      await stream(worker1,'bind',{id:cancelledSid,uid:cancelledUid,ciphertext:'synthetic-cancel-capability'});
      results=await race([[worker1,()=>stream(worker1,'reconcile',{id:cancelledSid,uid:cancelledUid,stage:'ready',duration:80,bytes:12000})],
        [p1,()=>p1.query('select public.passport_stream_cancel($1)',[cancelled])]]);
      const cancelledState=await value('select state,payment_state from public.pp_orders where id=$1',[cancelled]);
      assert.ok(['ready_for_review','awaiting_submission'].includes(cancelledState.state));assert.equal(cancelledState.payment_state,'paid');
      if(cancelledState.state==='awaiting_submission') await p1.query('select public.passport_stream_cancel($1)',[cancelled]);
      check('Stream cancellation/readiness race has a valid serial outcome; cancelled uploads remain funded and repeated cancellation is idempotent');

      results=await race([[worker1,()=>stream(worker1,'queue_delete',{id:sid,reason:'Synthetic explicit C2 deletion race test'})],
        [a1,()=>command(a1,'submit_review',finalPayload(streamOrder,'developing'))]]);
      const delivered=await value('select state from public.pp_orders where id=$1',[streamOrder]);
      assert.equal((await value('select count(*)::int n from public.pp_reviews where order_id=$1',[streamOrder])).n,delivered.state==='completed'?1:0);
      await denies(command(a2,'submit_review',finalPayload(streamOrder,'verified')),'23514');
      check('Stream deletion/review race blocks new outcomes or preserves a previously completed Developing decision without duplicate verification');

      const expired=await newOrder();await pay(expired);const expiredSid=(await reserve(p1,expired)).id;
      await root.query("update private.pp_stream_sessions set expires_at=now()-interval '1 second' where id=$1",[expiredSid]);
      await stream(worker1,'expire',{id:expiredSid}); const retrySid=(await reserve(p1,expired)).id;
      assert.notEqual(retrySid,expiredSid);assert.equal((await value('select payment_state from public.pp_orders where id=$1',[expired])).payment_state,'paid');
      await denies(stream(p1,'get',{id:retrySid}));await denies(reserve(outsider,expired));
      check('Expired Stream permissions permit a free new attempt; private worker operations and another player remain denied');
    }

    const privileges = await value(`select count(*)::int n from information_schema.role_table_grants
      where grantee in ('anon','authenticated','service_role') and table_name like 'pp\\_%' escape '\\'
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')`);
    assert.equal(privileges.n,0);
    const rls = await value(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','private') and c.relkind='r' and c.relname like 'pp\\_%' escape '\\' and not c.relrowsecurity`);
    assert.equal(rls.n,0);
    await root.query('update private.pp_runtime set enabled=false');
    await denies(command(p1,'create_order',orderPayload));
    await denies(event(worker1,'media',readyEvent,readyKey));
    check('All Passport tables retain RLS and no direct writes despite inherited Supabase defaults; release switch restored disabled');
    return checks;
  } finally {
    // Roll back held test transactions before closing; release flag even on failure.
    await Promise.all([...clients].map(async db => { try { await db.query('rollback'); } catch {} }));
    try { await root.query('update private.pp_runtime set enabled=false'); } finally {
      await Promise.all([...clients].map(db=>db.end()));
    }
  }
}
