/** C.1 browser -> Next -> real local Auth/RLS -> mock media worker. No hosted target. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, openSync, closeSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => {
  if (i % 2 === 0) pairs.push([value, all[i + 1]]); return pairs;
}, []));
for (const key of ['--cli', '--workdir', '--pg-module', '--playwright-module', '--probe', '--evidence']) assert.ok(args[key], `${key} required`);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workdir = path.resolve(args['--workdir']);
const config = readFileSync(path.join(workdir, 'supabase/config.toml'), 'utf8');
assert.match(config, /^project_id = "padel-b1-local"$/m);
const { existsSync } = await import('node:fs');
assert.equal(existsSync(path.join(workdir, 'supabase/.temp/project-ref')), false);
const status = JSON.parse(execFileSync(args['--cli'], ['status', '--workdir', workdir, '-o', 'json'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(status.API_URL, 'http://127.0.0.1:55321');
const dbURL = new URL(status.DB_URL);
assert.equal(dbURL.hostname, '127.0.0.1'); assert.equal(dbURL.port, '55322'); assert.equal(dbURL.pathname, '/postgres');
const container = JSON.parse(execFileSync('docker.exe', ['inspect', 'supabase_db_padel-b1-local'], { encoding: 'utf8', windowsHide: true }))[0];
assert.equal(container.Config.Labels['com.supabase.cli.project'], 'padel-b1-local');
for (const binding of Object.values(container.NetworkSettings.Ports).flat().filter(Boolean)) assert.equal(binding.HostIp, '127.0.0.1');
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve(args['--pg-module']));
const { createClient } = require(path.join(repo, 'node_modules/@supabase/supabase-js'));
const { chromium } = await import(pathToFileURL(path.resolve(args['--playwright-module'])).href);
const root = new Client({ connectionString: status.DB_URL }); await root.connect();
assert.equal((await root.query('select enabled from private.pp_runtime')).rows[0].enabled, false);
assert.equal((await root.query('select count(*)::int n from auth.users')).rows[0].n, 0, 'Use a clean isolated local reset first');
const worker = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const api = status.API_URL, anon = status.ANON_KEY;
const origin = 'http://127.0.0.1:3107';
const evidence = { date: new Date().toISOString(), environment: 'padel-b1-local / Next dev 127.0.0.1:3107', checks: [], success: false };
const check = (message) => { evidence.checks.push(message); console.log('PASS', message); };
let server, browser, logFD;
const users = [];
async function user(label) {
  const email = `c1-${label}-${randomUUID()}@example.test`, password = `Pp!${randomUUID()}`;
  const { data, error } = await worker.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Local C1 ${label}` } });
  assert.equal(error, null); users.push(data.user.id);
  const client = createClient(api, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
  return { id: data.user.id, email, password, client };
}
async function command(actor, name, payload) {
  const { data, error } = await actor.client.rpc('passport_command', { p_command: name, p_payload: payload, p_request_id: randomUUID() });
  assert.equal(error, null, `Command ${name}: ${error?.code}`); return data;
}
async function login(context, actor, next) {
  const page = await context.newPage();
  await page.goto(`${origin}/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email address', { exact: true }).fill(actor.email);
  await page.getByLabel('Password', { exact: true }).fill(actor.password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL(`${origin}${next}`, { timeout: 40_000 });
  return page;
}
try {
  evidence.database = (await root.query("select current_setting('server_version') version,(select system_identifier::text from pg_control_system()) system_id")).rows[0];
  const player = await user('player'), other = await user('other'), assessor = await user('assessor'), admin = await user('admin');
  await root.query("insert into public.admin_memberships(user_id,role,status) values($1,'owner','active')", [admin.id]);
  const coach = randomUUID();
  await root.query("insert into public.coaches(id,name,is_approved) values($1,'C1 Synthetic assessor',true)", [coach]);
  await root.query('insert into public.coach_memberships(coach_id,user_id) values($1,$2)', [coach, assessor.id]);
  // Only this previously identity-checked synthetic stack is temporarily enabled.
  await root.query('update private.pp_runtime set enabled=true');
  const standard = 'a0000000-0000-4000-8000-000000000002', policy = 'c0000000-0000-4000-8000-000000000001';
  await command(admin, 'publish_standard', { id: standard, reason: 'Synthetic C1 rubric approval for local-only tests' });
  await command(admin, 'publish_policy', { id: policy, reason: 'Synthetic C1 policy approval for local-only tests' });
  const grant = (await command(admin, 'set_assessor', { coach_id: coach, assessor_user_id: assessor.id, skill_id: 'improver-bandeja', credential_reference: 'mock:c1', status: 'approved', credentials_verified: true, reason: 'Synthetic local assessor credential test' })).id;
  const offer = (await command(assessor, 'create_offer', { grant_id: grant, standard_id: standard, price_minor: 3500, currency: 'GBP' })).id;
  const order = (await command(player, 'create_order', { offer_id: offer, policy_id: policy })).id;
  const unpaid = (await command(player, 'create_order', { offer_id: offer, policy_id: policy })).id;
  const { error: paidError } = await worker.rpc('passport_provider_event', { p_source: 'payment', p_event_id: randomUUID(), p_payload: { order_id: order, amount_minor: 3500, currency: 'GBP', payment_reference: `mock:c1:${order}` } });
  assert.equal(paidError, null);
  check('Synthetic orders use existing commands; only the trusted local worker funds one order; another remains pending');
  const log = path.join(workdir, 'c1-next-private.log'); logFD = openSync(log, 'w');
  // Process-only overrides. Never read/copy/edit .env.local or hosted credentials.
  server = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3107'], {
    cwd: repo, windowsHide: true, stdio: ['ignore', logFD, logFD], env: { ...process.env, NODE_ENV: 'development', VERCEL: '',
      NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anon, NEXT_PUBLIC_APP_URL: origin,
      PADEL_PASSPORT_PREVIEW: 'true', PADEL_PASSPORT_STREAM_ENABLED: 'false', PADEL_PASSPORT_MOCK_VIDEO: 'true', PADEL_PASSPORT_MOCK_SERVICE_KEY: status.SERVICE_ROLE_KEY,
      PADEL_PASSPORT_C1_CHECK: 'true',
      PADEL_PASSPORT_MOCK_FFPROBE: path.resolve(args['--probe']), RESEND_API_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '' },
  });
  let ready = false;
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw Error('Local Next exited; inspect private log');
    try { if ((await fetch(`${origin}/login`)).status === 200) { ready = true; break; } } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Local Next startup');
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const route = `/account/development/assessments/${order}`, endpoint = `${route}/video`;
  const page = await login(context, player, route);
  const pageErrors = []; page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.getByRole('heading', { name: 'Your Bandeja video' }).waitFor();
  await page.waitForFunction(() => { const input = document.querySelector('input[aria-label="Choose video"]'); return input && !input.matches(':disabled'); });
  assert.ok((await context.cookies()).some((cookie) => cookie.name.includes('auth-token')));
  check('Existing login form creates real SSR cookies and returns to the authorised Bandeja submission route');
  const clip = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
    const paint = canvas.getContext('2d'); let frame = 0;
    const timer = setInterval(() => { paint.fillStyle = '#002536'; paint.fillRect(0, 0, 320, 240); paint.fillStyle = '#d3ee25'; paint.fillRect((frame++ * 8) % 280, 100, 25, 25); }, 50);
    const mime = ['video/mp4;codecs=avc1.42001E', 'video/mp4', 'video/webm;codecs=vp8'].find((type) => MediaRecorder.isTypeSupported(type));
    const stream = canvas.captureStream(20); const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = []; recorder.ondataavailable = (event) => chunks.push(event.data);
    const done = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.start(); await new Promise((resolve) => setTimeout(resolve, 1200)); recorder.stop(); await done;
    clearInterval(timer); stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    return { type: blob.type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
  });
  assert.equal(clip.type, 'video/mp4', 'Test browser needs MP4 recording for a finite-duration fixture');
  const file = { name: 'synthetic-bandeja.mp4', mimeType: clip.type, buffer: Buffer.from(clip.bytes) };
  const rejectedFormat = await context.request.post(`${origin}${endpoint}`, { data: 'not video', headers: { origin, 'content-type': 'video/mp4', 'x-request-id': randomUUID() } });
  assert.equal(rejectedFormat.status(), 422, 'Server must inspect bytes, not trust an MP4 header');
  const rejectedOrigin = await context.request.post(`${origin}${endpoint}`, { data: file.buffer, headers: { origin: 'https://other.invalid', 'content-type': 'video/mp4', 'x-request-id': randomUUID() } });
  assert.equal(rejectedOrigin.status(), 403);
  assert.equal((await root.query('select count(*)::int n from public.pp_submission_attempts where order_id=$1', [order])).rows[0].n, 0);
  await page.getByLabel('Choose video', { exact: true }).setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not video') });
  await page.getByRole('alert').filter({ hasText: 'Choose an MP4' }).waitFor();
  const oversizedFile = path.join(workdir, 'c1-oversized-fixture.mp4');
  writeFileSync(oversizedFile, Buffer.alloc(50 * 1024 * 1024 + 1));
  await page.getByLabel('Choose video', { exact: true }).setInputFiles(oversizedFile);
  await page.getByRole('alert').filter({ hasText: 'smaller than 50 MB' }).waitFor();
  await page.getByLabel('Choose video', { exact: true }).setInputFiles(file);
  await page.getByText('Your clip is ready to upload.', { exact: true }).waitFor();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`);
    const size = await page.getByRole('button', { name: 'Upload video', exact: true }).boundingBox(); assert.ok(size.height >= 44);
  }
  await page.getByRole('button', { name: 'Upload video', exact: true }).focus();
  assert.equal(await page.getByRole('button', { name: 'Upload video', exact: true }).evaluate((el) => el === document.activeElement), true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(workdir, 'c1-mobile-preview.png'), fullPage: true });
  check('Mobile 320/390px preview, file/type/size errors, keyboard focus and 44px upload action pass using real synthetic video');
  await page.route(`**${endpoint}`, (r) => r.request().method() === 'POST' ? r.abort('internetdisconnected') : r.continue());
  await page.getByRole('button', { name: 'Upload video', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Connection interrupted' }).waitFor();
  assert.equal((await root.query('select count(*)::int n from public.pp_submission_attempts where order_id=$1', [order])).rows[0].n, 0);
  await page.unroute(`**${endpoint}`);
  await page.getByRole('button', { name: 'Retry upload', exact: true }).click();
  await page.getByRole('heading', { name: 'Your video is ready', exact: true }).waitFor({ timeout: 40_000 });
  const accepted = (await root.query('select * from public.pp_orders where id=$1', [order])).rows[0];
  assert.equal(accepted.state, 'ready_for_review'); assert.equal(accepted.payment_state, 'paid');
  assert.equal((await root.query('select count(*)::int n from public.pp_submission_attempts where order_id=$1', [order])).rows[0].n, 1);
  const video = page.getByLabel('Submitted Bandeja video', { exact: true });
  await video.evaluate(async (el) => { await el.play(); });
  assert.ok(await video.evaluate((el) => el.readyState >= 2));
  const partial = await context.request.get(`${origin}${endpoint}`, { headers: { Range: 'bytes=0-99' } });
  assert.equal(partial.status(), 206); assert.equal(partial.headers()['cache-control'], 'private, no-store');
  check('Interrupted upload retry keeps the same funded order; server validates/decode-checks bytes, records one attempt and serves private playable ranged video');
  const deadline = accepted.review_due_at.toISOString();
  const upload = async (ctx, target = endpoint, bytes = file.buffer, mime = file.mimeType) => ctx.request.post(`${origin}${target}`, { data: bytes, headers: { origin, 'content-type': mime, 'x-request-id': randomUUID(), 'x-duration-seconds': '1', 'x-payment-state': 'paid' } });
  assert.equal((await upload(context)).status(), 200);
  assert.equal((await root.query('select review_due_at from public.pp_orders where id=$1', [order])).rows[0].review_due_at.toISOString(), deadline);
  assert.equal((await upload(context, `/account/development/assessments/${unpaid}/video`)).status(), 409);
  const otherContext = await browser.newContext(); await login(otherContext, other, '/account/development/assessments');
  assert.equal((await upload(otherContext)).status(), 404);
  assert.equal((await otherContext.request.get(`${origin}${endpoint}`)).status(), 404);
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get(`${origin}${endpoint}`, { maxRedirects: 0 }); assert.ok([307, 401, 404].includes(denied.status()));
  check('Lost-response replay does not reset the SLA; client payment headers cannot fund an order; anonymous and cross-account upload/playback denied');
  await command(assessor, 'submit_review', { order_id: order, outcome: 'replacement_requested', observations: 'Synthetic unusable framing test', replacement_reason: 'The racket contact is outside the frame.', recording_guidance: 'Film from behind the baseline with your full body and contact visible.' });
  await page.reload(); await page.getByText('Your replacement stays under the same order.', { exact: false }).waitFor();
  await page.waitForFunction(() => { const input = document.querySelector('input[aria-label="Choose video"]'); return input && !input.matches(':disabled'); });
  await page.getByLabel('Choose video', { exact: true }).setInputFiles(file);
  await page.getByText('Your clip is ready to upload.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Upload video', exact: true }).click();
  await page.getByRole('heading', { name: 'Your video is ready', exact: true }).waitFor({ timeout: 40_000 });
  assert.equal((await root.query('select count(*)::int n from public.pp_submission_attempts where order_id=$1', [order])).rows[0].n, 2);
  assert.equal((await root.query('select count(*)::int n from public.pp_orders where id=$1 and payment_reference=$2', [order, accepted.payment_reference])).rows[0].n, 1);
  const assessorContext = await browser.newContext(); await login(assessorContext, assessor, '/account');
  assert.equal((await assessorContext.request.get(`${origin}${endpoint}`)).status(), 200);
  await command(admin, 'set_assessor', { id: grant, status: 'suspended', reason: 'Synthetic suspension access regression check' });
  assert.equal((await assessorContext.request.get(`${origin}${endpoint}`)).status(), 404);
  await command(admin, 'set_assessor', { id: grant, status: 'approved', credentials_verified: true, reason: 'Synthetic local credential reapproval after access test' });
  check('Unusable evidence replacement creates attempt 2 under the original payment; assigned-assessor playback works and suspension immediately removes access');
  await command(assessor, 'submit_review', { order_id: order, outcome: 'developing', observations: 'Synthetic completed development assessment', positive_feedback: 'Good preparation and control.', areas_for_improvement: 'Recover together after contact.', practice_tasks: ['Controlled partner feeds'], next_step: 'Practise recovery before another paid assessment.', criteria_results: { position: true, contact: false } });
  assert.equal((await root.query('select state from public.pp_orders where id=$1', [order])).rows[0].state, 'completed');
  const reassessment = (await command(player, 'create_order', { offer_id: offer, policy_id: policy, parent_order_id: order })).id;
  assert.equal((await upload(context, `/account/development/assessments/${reassessment}/video`)).status(), 409);
  assert.equal((await root.query('select count(*)::int n from public.pp_skill_verifications where order_id=$1', [order])).rows[0].n, 0);
  await page.goto(`${origin}/account/development/assessments`); await page.getByText('Assessment delivered', { exact: true }).waitFor();
  assert.deepEqual(pageErrors, []);
  check('Developing completes the paid service with no Verified award; linked reassessment remains payment-gated; My Assessments shows server status');
  evidence.success = true;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    execFileSync('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  }
  if (logFD !== undefined) closeSync(logFD);
  await root.query('update private.pp_runtime set enabled=false');
  evidence.releaseEnabled = (await root.query('select enabled from private.pp_runtime')).rows[0].enabled;
  // The final guarded reset removes only this stack's synthetic DB records.
  await root.end();
  writeFileSync(path.resolve(args['--evidence']), JSON.stringify(evidence, null, 2) + '\n');
  // Delete only the verified app's ignored, purpose-built mock clip directory.
  const media = path.resolve(repo, '.next/cache/passport-private-mock');
  assert.equal(path.dirname(media), path.resolve(repo, '.next/cache'));
  rmSync(media, { recursive: true, force: true });
  rmSync(path.join(workdir, 'c1-oversized-fixture.mp4'), { force: true });
}
