/** Prepare a NEW unlinked scratch workspace; never edits app config or migrations. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,renameSync,copyFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,arg,i,all)=>{if(i%2===0)pairs.push([arg,all[i+1]]);return pairs;},[]));
assert.ok(args['--workdir']&&args['--cli'],'--workdir and --cli required');
const root=path.resolve(args['--workdir']);
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
assert.notEqual(root,repo);assert.notEqual(root,path.join(repo,'supabase'));
assert.equal(existsSync(path.join(root,'supabase/config.toml')),false,'Use a new scratch directory, not an existing project');
assert.equal(existsSync(path.join(root,'supabase/.temp/project-ref')),false,'Refusing a linked directory');
const cli=path.resolve(args['--cli']);
assert.equal(execFileSync(cli,['--version'],{encoding:'utf8',windowsHide:true}).trim(),'3.0.0');
const baseline=readFileSync(path.join(repo,'supabase/tests/fixtures/pre-sprint6a-schema.sql'),'utf8');
assert.equal(createHash('sha256').update(baseline).digest('hex'),'3a3f1c3ce371a5c2bd1699d1824b13bf004f6baee969808c8750d403f47549f2','Review changed baseline before use');
mkdirSync(root,{recursive:true});
execFileSync(cli,['init','--workdir',root],{stdio:'pipe',windowsHide:true});
execFileSync(cli,['migration','new','local_application_baseline','--workdir',root],{stdio:'pipe',windowsHide:true});
const dir=path.join(root,'supabase/migrations');
const generated=readdirSync(dir).find(f=>f.endsWith('_local_application_baseline.sql'));
const target='20260803000000_local_application_baseline.sql';
// Synthetic ordering prefix in scratch only, not a real production history entry.
renameSync(path.join(dir,generated),path.join(dir,target));
writeFileSync(path.join(dir,target),`
-- LOCAL ONLY: restore snapshot ACLs rather than overlay fresh-stack defaults.
alter default privileges for role postgres in schema public revoke all on tables from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon,authenticated,service_role;
`+baseline+`
-- Schema-filtered backup omits attachment to managed auth.users.
create trigger on_auth_user_created after insert on auth.users
 for each row execute function private.handle_new_user();
-- Historical migration assertions require existing listings. Synthetic only.
insert into public.coaches(name) values ('B1 synthetic baseline coach');
insert into public.venues(name) values ('B1 synthetic baseline venue');
reset all;
`);
for(const file of readdirSync(path.join(repo,'supabase/migrations')).filter(f=>f.endsWith('.sql'))) copyFileSync(path.join(repo,'supabase/migrations',file),path.join(dir,file));
writeFileSync(path.join(root,'supabase/config.toml'),`# Disposable unlinked local validation. Use Invoke-LocalSupabase.ps1.
project_id = "padel-b1-local"
[api]
enabled = true
port = 55321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
[api.tls]
enabled = false
[db]
port = 55322
shadow_port = 55320
major_version = 17
health_timeout = "2m"
[db.migrations]
enabled = true
schema_paths = []
[db.seed]
enabled = false
sql_paths = []
[db.pooler]
enabled = false
[realtime]
enabled = true
[studio]
enabled = true
port = 55323
api_url = "http://127.0.0.1"
[local_smtp]
enabled = true
port = 55324
[storage]
enabled = true
file_size_limit = "50MiB"
[storage.s3_protocol]
enabled = true
[storage.analytics]
enabled = false
[storage.vector]
enabled = false
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["http://127.0.0.1:3000/auth/callback", "http://localhost:3000/auth/callback"]
jwt_expiry = 3600
enable_signup = true
enable_anonymous_sign_ins = false
enable_refresh_token_rotation = true
minimum_password_length = 8
[auth.rate_limit]
email_sent = 100
sign_in_sign_ups = 100
[auth.email]
enabled = true
enable_confirmations = true
max_frequency = "1s"
[edge_runtime]
enabled = false
[analytics]
enabled = false
`);
console.log('Prepared unlinked scratch config, schema-only bootstrap and unchanged repository migration copies.');
