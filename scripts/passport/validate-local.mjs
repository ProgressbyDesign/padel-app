/** Native PostgreSQL compatibility replay. Never accepts a remote URL or env credentials.
 * See docs/progress-passport-phase-b1.md. pg is supplied from an external test runtime.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exerciseConcurrentOperations } from './concurrency.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, index, all) => {
  if (index % 2 === 0) pairs.push([arg, all[index + 1]]);
  return pairs;
}, []));
for (const key of ['--pg-module', '--cluster-dir', '--evidence']) assert.ok(args[key], `${key} required`);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve(args['--pg-module']));
const port = Number(args['--port'] ?? 55439);
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
const config = { host: '127.0.0.1', port, user: 'postgres', database: 'postgres', connectionTimeoutMillis: 5000 };
const admin = new Client(config);
const created = new Set();
const evidence = { environment: 'native PostgreSQL; Supabase platform compatibility shim', migrations: [], checks: [] };
const digest = (value) => createHash('sha256').update(value).digest('hex');
const baseline = readFileSync(path.join(repo, 'backups/pre-sprint6a/schema.sql'), 'utf8');
assert.equal(digest(baseline), '3a3f1c3ce371a5c2bd1699d1824b13bf004f6baee969808c8750d403f47549f2', 'Review any changed schema baseline before replay');
const migrations = readdirSync(path.join(repo, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
evidence.migrationSha256 = Object.fromEntries(migrations.map(file => [file, digest(readFileSync(path.join(repo, 'supabase/migrations', file)))]));
const baselineAdapter = `
create schema auth; create schema extensions; create schema vault;
create publication supabase_realtime;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),auth.jwt()->>'role') $$;
grant usage on schema auth,public to anon,authenticated,service_role;
grant execute on all functions in schema auth to anon,authenticated,service_role;
`;
async function legacyFingerprint(db) {
  const { rows } = await db.query(`
    select 'function' kind,n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' name,
      pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'') body
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f' and p.proname !~ '^(pp_|passport_)'
    union all select 'policy',schemaname||'.'||tablename||'.'||policyname,to_jsonb(p)::text
      from pg_policies p where schemaname in ('public','private') and tablename !~ '^pp_'
    union all select 'relation',n.nspname||'.'||c.relname,
      coalesce(c.relacl::text,'')||c.relrowsecurity::text||coalesce(pg_get_viewdef(c.oid,true),'')
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','v') and c.relname !~ '^pp_'
    union all select 'trigger',n.nspname||'.'||c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid)
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','private') and c.relname !~ '^pp_' and not t.tgisinternal
    order by 1,2`);
  return { objects: rows.length, sha256: digest(JSON.stringify(rows)) };
}
async function createDatabase(label, template = 'template0') {
  const name = `passport_b1_${label}_${Date.now()}`;
  assert.match(name, /^passport_b1_[a-z0-9_]+$/);
  assert.ok(template === 'template0' || created.has(template));
  await admin.query(`create database "${name}" template "${template}"`);
  created.add(name);
  return name;
}
async function connect(database) {
  assert.ok(created.has(database));
  const db = new Client({ ...config, database }); await db.connect();
  await db.query("set statement_timeout='15s'; set lock_timeout='10s'");
  return db;
}
await admin.connect();
try {
  const identity = (await admin.query("select current_database() database,inet_server_addr() host,inet_server_port() port,current_setting('data_directory') directory,version() version")).rows[0];
  assert.equal(identity.host, '127.0.0.1'); assert.equal(identity.port, port);
  assert.equal(realpathSync(identity.directory), realpathSync(args['--cluster-dir']), 'Wrong cluster: refusing all writes');
  assert.match(identity.version, /^PostgreSQL 17\./);
  evidence.identity = identity; evidence.baselineSha256 = digest(baseline);
  console.log('Confirmed disposable cluster', JSON.stringify(identity));
  await admin.query(`do $$ begin
    if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
    if not exists(select from pg_roles where rolname='authenticator') then create role authenticator nologin; end if;
    if not exists(select from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if;
  end $$;`);
  for (let run = 1; run <= 2; run++) {
    const name = await createDatabase(`replay${run}`); const db = await connect(name);
    try {
      await db.query(baselineAdapter);
      await db.query(baseline.replace('CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";', '-- Native adapter: unused Supabase Vault extension omitted.'));
      await db.query('reset all; set row_security=on');
      // Historical migration's embedded assertions require two existing listings.
      await db.query("insert into public.coaches(name) values('B1 synthetic baseline coach'); insert into public.venues(name) values('B1 synthetic baseline venue')");
      let before;
      for (const file of migrations) {
        if (!before && file.includes('progress_passport')) before = await legacyFingerprint(db);
        try { await db.query(readFileSync(path.join(repo, 'supabase/migrations', file), 'utf8')); }
        catch (error) { error.message = `${file}: ${error.message}`; throw error; }
      }
      assert.deepEqual(await legacyFingerprint(db), before, 'Passport changed legacy functions, policies, triggers or access');
      assert.equal((await db.query('select enabled from private.pp_runtime')).rows[0].enabled, false);
      evidence.migrations.push({ database: name, files: migrations, legacy: before, releaseEnabled: false });
      console.log(`Full replay ${run} passed: ${migrations.length} migrations; legacy objects unchanged`);
    } finally { await db.end(); }
  }
  const testName = await createDatabase('tests', evidence.migrations[1].database);
  const testDb = await connect(testName);
  try {
    let lifecycle = readFileSync(path.join(repo, 'supabase/tests/progress_passport_lifecycle.sql'), 'utf8');
    // Explicit fixture columns make the old minimal harness test work on real tables.
    lifecycle = lifecycle.replace('insert into public.coach_memberships values', 'insert into public.coach_memberships(coach_id,user_id) values')
      .replace('insert into public.admin_memberships values', 'insert into public.admin_memberships(user_id,role,status) values');
    await testDb.query(lifecycle);
    assert.equal((await testDb.query('select enabled from private.pp_runtime')).rows[0].enabled, false, 'Lifecycle fixture must roll back');
    evidence.checks.push('Original lifecycle SQL passed against complete application tables; fixture rolled back');
    console.log(evidence.checks.at(-1));
  } finally { await testDb.end(); }
  const concurrency = await exerciseConcurrentOperations(() => connect(testName));
  evidence.checks.push(...concurrency);
  // Existing SQL regressions use the synthetic users/admin/coach from the test DB.
  // Make one completed unpaid booking as historical fixture data, then re-enable
  // all triggers before testing the real booking-payment update path.
  const legacy = await connect(testName);
  try {
    await legacy.query(`begin;
      set local session_replication_role=replica;
      do $$ declare c uuid; u uuid; p uuid; v uuid; rel uuid; begin
        select coach_id,user_id into c,u from public.coach_memberships limit 1;
        select id into p from auth.users where id<>u limit 1;
        insert into public.venues(name) values('B1 synthetic booking venue') returning id into v;
        insert into public.coach_venues(coach_id,venue_id,status,initiated_by,responded_at,responded_by_user_id)
          values(c,v,'active','import',now(),u) returning id into rel;
        insert into public.coach_booking_requests(coach_venue_id,coach_id,venue_id,requester_user_id,status,
          starts_at,ends_at,timezone,requester_name,requester_email,responded_at,responded_by_user_id,completed_at)
          values(rel,c,v,p,'completed',now()-interval '2 hours',now()-interval '1 hour','Europe/London',
            'B1 synthetic player','booking@example.invalid',now()-interval '3 hours',u,now());
      end $$;
      set local session_replication_role=origin;
      commit;`);
  } finally { await legacy.end(); }
  for (const file of ['application_email_claim_fallback.sql','approved_coach_publication.sql',
    'approve_with_existing_coach_preserves_profile.sql','registration_admin_notification.sql',
    'player_favourites_regression.sql','coaching_venue_catalogue.sql','booking_payment_regression.sql']) {
    const db = await connect(testName);
    try {
      await db.query('begin');
      try { await db.query(readFileSync(path.join(repo,'supabase/tests',file),'utf8')); }
      catch (error) {
        if (!(error.code === 'P0001' && error.message === `${file.replace('.sql','')}: all checks passed`)) {
          error.message = `${file}: ${error.message}`; throw error;
        }
      }
      evidence.checks.push(`Legacy SQL passed: ${file} (fixture rolled back)`);
      console.log(evidence.checks.at(-1));
    } finally { await db.query('rollback'); await db.end(); }
  }
  evidence.success = true;
} catch (error) {
  evidence.success = false; evidence.failure = { message: error.message, code: error.code, where: error.where };
  throw error;
} finally {
  for (const database of [...created].reverse()) {
    // Names come only from createDatabase after identity validation, never from a URL.
    await admin.query(`drop database "${database}" with (force)`);
  }
  evidence.disposableDatabasesRemoved = created.size;
  writeFileSync(path.resolve(args['--evidence']), JSON.stringify(evidence, null, 2));
  await admin.end();
}
