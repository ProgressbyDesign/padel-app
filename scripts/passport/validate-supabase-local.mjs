/** Real local Supabase only. No env file, hosted URL, remote migration or secret output. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exerciseConcurrentOperations } from './concurrency.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs,key,index,all)=>{
  if(index%2===0) pairs.push([key,all[index+1]]); return pairs;
},[]));
for(const name of ['--cli','--workdir','--pg-module','--evidence']) assert.ok(args[name],`${name} is required`);
const project = 'padel-b1-local';
const workdir = path.resolve(args['--workdir']);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
assert.match(readFileSync(path.join(workdir,'supabase/config.toml'),'utf8'),/^project_id = "padel-b1-local"$/m);
assert.equal(existsSync(path.join(workdir,'supabase/.temp/project-ref')),false,'Refusing a linked workspace');
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve(args['--pg-module']));
const { createClient } = require(path.join(repo,'node_modules/@supabase/supabase-js'));
const statusRaw = execFileSync(path.resolve(args['--cli']),['status','--workdir',workdir,'-o','json'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
const status = JSON.parse(statusRaw);
const api = status.API_URL ?? status['api.url'] ?? status.api?.url;
const anon = status.ANON_KEY ?? status['auth.anon_key'] ?? status.auth?.anon_key;
const service = status.SERVICE_ROLE_KEY ?? status['auth.service_role_key'] ?? status.auth?.service_role_key;
const dbUrl = status.DB_URL ?? status['db.url'] ?? status.db?.url;
assert.equal(api,'http://127.0.0.1:55321');
assert.equal(typeof anon,'string'); assert.equal(typeof service,'string');
const parsed = new URL(dbUrl);
assert.equal(parsed.hostname,'127.0.0.1'); assert.equal(parsed.port,'55322'); assert.equal(parsed.pathname,'/postgres');
const container = JSON.parse(execFileSync('docker.exe',['inspect',`supabase_db_${project}`],{encoding:'utf8',windowsHide:true}))[0];
assert.equal(container.Config.Labels['com.supabase.cli.project'],project);
assert.equal(container.NetworkSettings.Ports['5432/tcp'][0].HostIp,'127.0.0.1');
assert.equal(container.NetworkSettings.Ports['5432/tcp'][0].HostPort,'55322');
const running = JSON.parse(execFileSync('docker.exe',['ps','--filter',`name=_${project}`,'--format','{{json .}}'],{encoding:'utf8',windowsHide:true}).trim().split('\n').map(line=>`[${line}]`).join('').replace(/\]\[/g,',').replace(/^\[/,'['));
for(const c of running) assert.ok(!/0\.0\.0\.0|\[::\]/.test(c.Ports),'Wildcard host binding is forbidden');
const evidence = { date:new Date().toISOString(),project,api,engine:'Docker Desktop / WSL2',containerId:container.Id,
  image:container.Config.Image,checks:[],platformServices:running.map(c=>({name:c.Names,status:c.Status,ports:c.Ports})) };
const check = message => {evidence.checks.push(message); console.log('PASS',message);};
const config = {connectionString:dbUrl,connectionTimeoutMillis:5000};
async function connect() {const db=new Client(config);await db.connect();await db.query("set statement_timeout='15s';set lock_timeout='10s'");return db;}
const root=await connect();
async function call(endpoint,{method='GET',jwt=anon,key=anon,body,headers={}}={}) {
  assert.ok(endpoint.startsWith('/auth/v1/')||endpoint.startsWith('/rest/v1/')||endpoint.startsWith('/storage/v1/'));
  const response=await fetch(api+endpoint,{method,redirect:'manual',headers:{apikey:key,Authorization:`Bearer ${jwt}`,...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=null;}
  return {status:response.status,data,headers:response.headers};
}
async function ok(endpoint,options) {const r=await call(endpoint,options);assert.ok(r.status>=200&&r.status<300,`${endpoint}: HTTP ${r.status}; code ${r.data?.code??r.data?.error_code??'none'}`);return r.data;}
async function denied(endpoint,options) {const r=await call(endpoint,options);assert.ok(r.status>=400,`${endpoint}: expected denial, received HTTP ${r.status}`);return r;}
async function command(actor,name,payload,key=randomUUID()) {return ok('/rest/v1/rpc/passport_command',{method:'POST',jwt:actor.jwt,body:{p_command:name,p_payload:payload,p_request_id:key}});}
async function denyCommand(actor,name,payload) {return denied('/rest/v1/rpc/passport_command',{method:'POST',jwt:actor.jwt,body:{p_command:name,p_payload:payload,p_request_id:randomUUID()}});}
async function event(source,payload,key=randomUUID(),jwt=service) {return ok('/rest/v1/rpc/passport_provider_event',{method:'POST',jwt,key:service,body:{p_source:source,p_event_id:key,p_payload:payload}});}
async function emailLink(email,type) {
  const deadline=Date.now()+10000;
  while(Date.now()<deadline) {
    const listing=await fetch('http://127.0.0.1:55324/api/v1/messages',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
    for(const message of listing.messages??[]) {
      if(!(message.To??[]).some(to=>to.Address===email)) continue;
      const detail=await fetch(`http://127.0.0.1:55324/api/v1/message/${message.ID}`).then(r=>r.json());
      const html=(detail.HTML??detail.Text??'').replaceAll('&amp;','&');
      const links=html.match(/https?:\/\/[^\s"<>]+/g)??[];
      const link=links.find(link=>link.includes('/auth/v1/verify')&&link.includes(`type=${type}`));
      if(link) {const url=new URL(link);assert.equal(url.origin,api);return url;}
    }
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw Error('Local SMTP did not receive the expected auth email');
}
async function verify(email,type) {
  const url=await emailLink(email,type);
  const response=await fetch(url,{redirect:'manual'});
  assert.equal(response.status,303);
  const location=new URL(response.headers.get('location'));
  assert.equal(location.origin,'http://127.0.0.1:3000');
  return new URLSearchParams(location.hash.slice(1));
}
async function signup(label) {
  const email=`${label}-${randomUUID()}@example.test`,password=`Pp!${randomUUID()}`;
  const data=await ok('/auth/v1/signup',{method:'POST',body:{email,password,data:{full_name:'Synthetic Supabase validation',role:'owner',is_admin:true}}});
  assert.ok(data.id??data.user?.id);
  await denied('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  await verify(email,'signup');
  const session=await ok('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  assert.equal(session.user.email,email);assert.ok(session.access_token);
  return {id:session.user.id,email,password,jwt:session.access_token,refresh:session.refresh_token};
}
try {
  evidence.database=(await root.query("select current_database() name,inet_server_addr() address,current_setting('server_version') version,current_setting('data_directory') directory,(select system_identifier::text from pg_control_system()) system_id")).rows[0];
  assert.equal(evidence.database.address,container.NetworkSettings.Networks['padel-b1-loopback'].IPAddress);
  assert.equal((await root.query('select enabled from private.pp_runtime')).rows[0].enabled,false);
  assert.equal((await root.query('select count(*)::int n from auth.users')).rows[0].n,0,'Use a clean guarded local reset before the full validation suite');
  evidence.migrations=(await root.query('select version,name from supabase_migrations.schema_migrations order by version')).rows;
  const expectedMigrations=readdirSync(path.join(repo,'supabase/migrations')).filter(file=>file.endsWith('.sql')).sort();
  assert.equal(evidence.migrations.length,expectedMigrations.length+1);
  assert.equal(evidence.migrations.at(-1).version,expectedMigrations.at(-1).split('_')[0]);
  check(`Actual Supabase PostgreSQL, ${evidence.migrations.length} local migrations and disabled Passport release gate confirmed`);
  await root.query(readFileSync(path.join(repo,'supabase/tests/progress_passport_stream.sql'),'utf8'));
  check('Stream SQL authorisation, ownership, binding, limits, free replacement, revocation, Developing, reassessment and deletion-history checks pass; rolled back');
  await root.query(readFileSync(path.join(repo,'supabase/tests/progress_passport_review.sql'),'utf8'));
  check('Phase D private identity/notes, scoped reviews, repeated replacements, Passport and idempotent notification intentions pass; rolled back');
  const lifecycle=readFileSync(path.join(repo,'supabase/tests/progress_passport_lifecycle.sql'),'utf8')
    .replace('insert into public.coach_memberships values','insert into public.coach_memberships(coach_id,user_id) values')
    .replace('insert into public.admin_memberships values','insert into public.admin_memberships(user_id,role,status) values');
  await root.query(lifecycle);
  check('Original Passport lifecycle SQL passes on real Supabase Auth/schema/RLS; fixtures rolled back');
  evidence.concurrency=await exerciseConcurrentOperations(connect);
  assert.equal((await root.query('select enabled from private.pp_runtime')).rows[0].enabled,false);
  const player=await signup('player'),other=await signup('other'),assessor=await signup('assessor'),admin=await signup('admin');
  check('Real GoTrue signup, local SMTP confirmation, unconfirmed-login denial and password sign-in for four users');
  const sdk=createClient(api,anon,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data:claims,error}=await sdk.auth.getClaims(player.jwt);assert.equal(error,null);assert.equal(claims.claims.sub,player.id);
  assert.equal((await ok('/auth/v1/user',{jwt:player.jwt})).id,player.id);
  const profile=await ok('/rest/v1/profiles?select=id,role',{jwt:player.jwt});
  assert.equal(profile.length,1);assert.equal(profile[0].id,player.id);assert.equal(profile[0].role,'user');
  await denied('/rest/v1/profiles?id=eq.'+player.id,{method:'PATCH',jwt:player.jwt,body:{role:'admin'}});
  assert.deepEqual(await ok('/rest/v1/profiles?id=eq.'+other.id+'&select=id',{jwt:player.jwt}),[]);
  const parts=player.jwt.split('.'); const altered=JSON.parse(Buffer.from(parts[1],'base64url').toString());altered.sub=other.id;altered.role='service_role';parts[1]=Buffer.from(JSON.stringify(altered)).toString('base64url');
  await denied('/rest/v1/profiles?select=id',{jwt:parts.join('.')});
  await denied('/rest/v1/pp_orders?select=id');
  check('SDK getClaims and GoTrue validate real JWTs; forged JWT, metadata role escalation, profile role changes and cross-account reads denied');
  const refreshed=await ok('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:player.refresh}});
  player.jwt=refreshed.access_token;assert.equal((await ok('/auth/v1/user',{jwt:player.jwt})).id,player.id);
  await ok('/auth/v1/recover',{method:'POST',body:{email:other.email}});
  const recovery=await verify(other.email,'recovery');assert.ok(recovery.get('access_token'));
  const changed=`Pp!${randomUUID()}`;
  await ok('/auth/v1/user',{method:'PUT',jwt:recovery.get('access_token'),body:{password:changed}});
  await denied('/auth/v1/token?grant_type=password',{method:'POST',body:{email:other.email,password:other.password}});
  other.jwt=(await ok('/auth/v1/token?grant_type=password',{method:'POST',body:{email:other.email,password:changed}})).access_token;
  check('Refresh-token exchange and SMTP password recovery work; old password rejected after reset');
  const coach=randomUUID();
  await root.query("insert into public.coaches(id,name,is_approved) values($1,'Local HTTP assessor fixture',true)",[coach]);
  await root.query('insert into public.coach_memberships(coach_id,user_id) values($1,$2)',[coach,assessor.id]);
  await root.query("insert into public.admin_memberships(user_id,role,status) values($1,'owner','active')",[admin.id]);
  assert.deepEqual(await ok('/rest/v1/coach_public_profiles?id=eq.'+coach+'&select=id'),[]);
  await denied('/rest/v1/coaches?select=id');
  await ok('/rest/v1/coaches?id=eq.'+coach,{method:'PATCH',jwt:admin.jwt,body:{publication_status:'published'}});
  const published=await ok('/rest/v1/coach_public_profiles?id=eq.'+coach+'&select=*');
  assert.equal(published.length,1);assert.equal(published[0].id,coach);
  assert.equal(Object.hasOwn(published[0],'email'),false);assert.equal(Object.hasOwn(published[0],'phone'),false);
  check('Existing public profile projection hides private coaches, permits explicit publication, omits contact fields and keeps anonymous base-table access closed');
  // A committed local-only activation is required for cross-connection HTTP tests.
  await root.query('update private.pp_runtime set enabled=true');
  const standard='a0000000-0000-4000-8000-000000000001',policy='c0000000-0000-4000-8000-000000000001';
  // Concurrency suite published policy, while the beginner rubric remains draft.
  await command(admin,'publish_standard',{id:standard,reason:'Synthetic HTTP rubric approval for isolated validation'});
  const grant=(await command(admin,'set_assessor',{coach_id:coach,assessor_user_id:assessor.id,skill_id:'beginner-rally',credential_reference:'mock:http-credential',status:'approved',credentials_verified:true,reason:'Synthetic credential check for isolated HTTP validation'})).id;
  const offer=(await command(assessor,'create_offer',{grant_id:grant,standard_id:standard,price_minor:3500,currency:'GBP'})).id;
  const key=randomUUID(),payload={offer_id:offer,policy_id:policy};
  const [one,two]=await Promise.all([command(player,'create_order',payload,key),command(player,'create_order',payload,key)]);
  assert.equal(one.id,two.id);const order=one.id;
  assert.equal((await ok('/rest/v1/pp_orders?id=eq.'+order+'&select=id,payment_state',{jwt:player.jwt}))[0].payment_state,'pending');
  assert.deepEqual(await ok('/rest/v1/pp_orders?id=eq.'+order+'&select=id',{jwt:other.jwt}),[]);
  await denied('/rest/v1/pp_orders?id=eq.'+order,{method:'PATCH',jwt:player.jwt,body:{payment_state:'paid'}});
  await denyCommand(player,'begin_attempt',{order_id:order});
  const payment={order_id:order,amount_minor:3500,currency:'GBP',payment_reference:`mock:http-payment:${order}`};
  await denied('/rest/v1/rpc/passport_provider_event',{method:'POST',jwt:player.jwt,body:{p_source:'payment',p_event_id:randomUUID(),p_payload:payment}});
  await denied('/rest/v1/rpc/passport_provider_event',{method:'POST',jwt:admin.jwt,body:{p_source:'payment',p_event_id:randomUUID(),p_payload:payment}});
  await event('payment',payment);
  const attempt=(await command(player,'begin_attempt',{order_id:order})).id;
  assert.deepEqual(await ok('/rest/v1/pp_submission_attempts?id=eq.'+attempt+'&select=id',{jwt:other.jwt}),[]);
  const media={order_id:order,attempt_id:attempt,provider:'mock',provider_reference:`mock:http-video:${attempt}`};
  await event('media',{...media,stage:'uploaded'});await event('media',{...media,stage:'ready',duration_seconds:60,bytes:12000,mime_type:'video/mp4'});
  await denyCommand(player,'submit_review',{order_id:order,outcome:'verified'});
  const review={order_id:order,outcome:'verified',observations:'Synthetic evidence clearly demonstrates the published control criterion.',positive_feedback:'Balanced and controlled contact throughout the sample.',areas_for_improvement:'Continue developing consistency in longer rallies.',practice_tasks:['Practise cooperative rallies with stable racket preparation.'],next_step:'Repeat controlled rallies before your next session.',criteria_results:{control:true}};
  await command(assessor,'submit_review',review);
  assert.equal((await ok('/rest/v1/pp_skill_verifications?order_id=eq.'+order+'&select=id',{jwt:player.jwt})).length,1);
  await command(admin,'set_assessor',{id:grant,status:'suspended',reason:'Synthetic HTTP eligibility suspension after valid assessment'});
  assert.deepEqual(await ok('/rest/v1/pp_submission_attempts?id=eq.'+attempt+'&select=id',{jwt:assessor.jwt}),[]);
  assert.equal((await ok('/rest/v1/pp_skill_verifications?order_id=eq.'+order+'&select=id',{jwt:player.jwt})).length,1);
  check('Actual PostgREST JWT/RLS/RPC flow: duplicate order, trusted-only funding, private evidence, named-assessor verification and suspension');
  await denied('/rest/v1/rpc/pp_command',{method:'POST',jwt:player.jwt,body:{p_command:'create_order',p_payload:payload,p_request_id:randomUUID()}});
  const bucket=`b1-${randomUUID()}`;
  await ok('/storage/v1/bucket',{method:'POST',jwt:service,key:service,body:{id:bucket,name:bucket,public:false}});
  const upload=await fetch(`${api}/storage/v1/object/${bucket}/private.txt`,{method:'POST',headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'text/plain'},body:'Synthetic local validation only.'});assert.ok(upload.ok);
  await denied(`/storage/v1/object/${bucket}/private.txt`,{jwt:other.jwt});
  await denied(`/storage/v1/object/public/${bucket}/private.txt`,{jwt:other.jwt});
  check('Private schema is not a REST API; actual Storage denies other-player and public object access');
  // Existing booking regression expects a completed, unpaid historical record.
  // Seed only this synthetic fixture with triggers bypassed, then restore them
  // before testing the actual authenticated permission/payment transition.
  await root.query(`begin; set local session_replication_role=replica;
    do $$ declare c uuid; u uuid; p uuid; v uuid; rel uuid; begin
      select coach_id,user_id into c,u from public.coach_memberships limit 1;
      select id into p from auth.users where id<>u limit 1;
      insert into public.venues(name) values('Local booking fixture') returning id into v;
      insert into public.coach_venues(coach_id,venue_id,status,initiated_by,responded_at,responded_by_user_id)
        values(c,v,'active','import',now(),u) returning id into rel;
      insert into public.coach_booking_requests(coach_venue_id,coach_id,venue_id,requester_user_id,status,
        starts_at,ends_at,timezone,requester_name,requester_email,responded_at,responded_by_user_id,completed_at)
        values(rel,c,v,p,'completed',now()-interval '2 hours',now()-interval '1 hour','Europe/London',
          'Synthetic player','booking@example.invalid',now()-interval '3 hours',u,now());
    end $$; set local session_replication_role=origin; commit;`);
  evidence.legacy=[];
  for(const file of ['application_email_claim_fallback.sql','approved_coach_publication.sql',
    'approve_with_existing_coach_preserves_profile.sql','registration_admin_notification.sql',
    'player_favourites_regression.sql','coaching_venue_catalogue.sql','booking_payment_regression.sql']) {
    const db=await connect();
    try {
      await db.query('begin');
      try {await db.query(readFileSync(path.join(repo,'supabase/tests',file),'utf8'));}
      catch(error) {if(!(error.code==='P0001'&&error.message===`${file.replace('.sql','')}: all checks passed`)) throw error;}
      evidence.legacy.push(file);
    } finally {await db.query('rollback');await db.end();}
  }
  check('Seven existing SQL regressions pass on full Supabase, including coach approval, private venue discovery and booking payment attribution');
  const schemas=(await root.query("select nspname from pg_namespace where nspname in ('auth','storage','realtime','vault','private','supabase_migrations') order by nspname")).rows;
  evidence.schemas=schemas.map(row=>row.nspname);
  await root.query('update private.pp_runtime set enabled=false');
  await denyCommand(player,'create_order',payload);
  check('Final release gate disabled; no live provider calls or external emails used');
  evidence.success=true;
} catch(error) {
  evidence.success=false;evidence.failure={message:error.message,code:error.code};throw error;
} finally {
  await root.query('rollback');await root.query('update private.pp_runtime set enabled=false');
  evidence.releaseEnabled=(await root.query('select enabled from private.pp_runtime')).rows[0].enabled;
  evidence.migrationHashes=Object.fromEntries(evidence.migrations.map(m=>{
    const filename=`${m.version}_${m.name}.sql`;const file=path.join(workdir,'supabase/migrations',filename);
    return [filename,existsSync(file)?createHash('sha256').update(readFileSync(file)).digest('hex'):null];
  }));
  writeFileSync(path.resolve(args['--evidence']),JSON.stringify(evidence,null,2)+'\n');await root.end();
}
