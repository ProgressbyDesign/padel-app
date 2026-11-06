/** Phase D real browser review journey on verified loopback Supabase; no live media, payment or email. */
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
assert.ok(existsSync(path.dirname(path.resolve(args['--evidence']))), 'Evidence directory must already exist before fixture creation');
assert.ok(existsSync(path.resolve(args['--probe'])), 'Local probe must exist before fixture creation');
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
  const { data, error } = await worker.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Local D ${label}` } });
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
  await root.query("insert into public.coaches(id,name,is_approved) values($1,'D Synthetic assessor',true)", [coach]);
  await root.query('insert into public.coach_memberships(coach_id,user_id) values($1,$2)', [coach, assessor.id]);
  // Only this previously identity-checked synthetic stack is temporarily enabled.
  await root.query('update private.pp_runtime set enabled=true');
  const standard = 'a0000000-0000-4000-8000-000000000002', policy = 'c0000000-0000-4000-8000-000000000001';
  await command(admin, 'publish_standard', { id: standard, reason: 'Synthetic C1 rubric approval for local-only tests' });
  await command(admin, 'publish_policy', { id: policy, reason: 'Synthetic C1 policy approval for local-only tests' });
  const grant = (await command(admin, 'set_assessor', { coach_id: coach, assessor_user_id: assessor.id, skill_id: 'improver-bandeja', credential_reference: 'mock:c1', status: 'approved', credentials_verified: true, reason: 'Synthetic local assessor credential test' })).id;
  const offer = (await command(assessor, 'create_offer', { grant_id: grant, standard_id: standard, price_minor: 3500, currency: 'GBP' })).id;
  const order = (await command(player, 'create_order', { offer_id: offer, policy_id: policy })).id;
  const { error: paidError } = await worker.rpc('passport_provider_event', { p_source: 'payment', p_event_id: randomUUID(), p_payload: { order_id: order, amount_minor: 3500, currency: 'GBP', payment_reference: `mock:c1:${order}` } });
  assert.equal(paidError, null);
  check('Synthetic order uses existing commands; funding is recorded only by the trusted local worker');
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

  const route = '/account/development/assessments/' + order;
  const endpoint = route + '/video';
  const page = await login(context, player, route);
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.getByRole('heading', { name: 'Your Bandeja video' }).waitFor();
  await page.getByLabel('Your question for the assessor').fill('How can I improve my contact point and recovery?');
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Notes saved' }).waitFor();
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

  async function upload(target = order) {
    await page.goto(origin + '/account/development/assessments/' + target);
    await page.waitForFunction(() => { const input = document.querySelector('input[aria-label="Choose video"]'); return input && !input.matches(':disabled'); });
    await page.getByLabel('Choose video', { exact: true }).setInputFiles(file);
    try { await page.getByText('Your clip is ready to upload.', { exact: true }).waitFor(); }
    catch (error) { console.log('File-selection diagnostic:', await page.getByRole('alert').allTextContents()); await page.screenshot({ path: path.join(workdir, 'd-selection-failure.png'), fullPage: true }); throw error; }
    await page.getByRole('button', { name: 'Upload video', exact: true }).click();
    await page.getByRole('heading', { name: 'Your video is ready', exact: true }).waitFor({ timeout: 40000 });
  }
  await upload();
  check('Player saves private notes and submits decoded synthetic evidence through the existing video UI');
  async function openAs(actor, target, width = 1280) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    const p = await login(ctx, actor, target); p.on('pageerror', error => pageErrors.push(error.message)); return { ctx, p };
  }
  const queue = '/account/coaches/' + coach + '/assessments';
  const reviewPath = queue + '/' + order;
  const { ctx: coachContext, p: coachPage } = await openAs(assessor, queue);
  await coachPage.getByRole('heading', { name: 'Assessments', exact: true }).waitFor();
  await coachPage.getByRole('link', { name: 'Open assessment', exact: false }).click();
  await coachPage.getByRole('heading', { name: 'Your assessment', exact: true }).waitFor();
  await coachPage.getByText('How can I improve my contact point and recovery?', { exact: true }).waitFor();
  const video = coachPage.getByLabel('Private Bandeja video attempt 1', { exact: true });
  await video.evaluate(async el => { await el.play(); });
  assert.ok(await video.evaluate(el => el.readyState >= 2));
  await coachPage.getByRole('button', { name: 'Start review', exact: true }).click();
  await coachPage.getByText('Review in progress', { exact: true }).waitFor();
  await coachPage.getByRole('button', { name: 'Complete as Developing', exact: true }).click();
  await coachPage.getByRole('alert').filter({ hasText: 'Assessment summary' }).waitFor();
  await coachPage.setViewportSize({ width: 390, height: 844 });
  await coachPage.screenshot({ path: path.join(workdir, 'd-coach-review-mobile.png'), fullPage: true });
  if (!(await coachPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) console.log('Overflow:', await coachPage.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(-12).map(el => ({ tag: el.tagName, classes: el.className, width: el.getBoundingClientRect().width }))));
  assert.ok(await coachPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('Coach portal queue, private playback, submission notes, start-review and incomplete-feedback validation work at mobile width');
  async function replacement() {
    await coachPage.getByRole('radio', { name: 'Replacement footage', exact: true }).check();
    await coachPage.getByLabel('Assessment summary', { exact: false }).fill('The racket contact cannot be seen from this camera angle.');
    await coachPage.getByLabel('Recording issue', { exact: true }).selectOption('Incorrect camera angle');
    await coachPage.getByLabel('Replacement recording guidance', { exact: false }).fill('Film behind the baseline showing full body, racket contact and recovery.');
    await coachPage.getByRole('button', { name: 'Request replacement footage', exact: true }).click();
    await coachPage.getByRole('heading', { name: 'Review unavailable', exact: true }).waitFor();
  }
  await replacement();
  await page.reload(); await page.getByText('Replacement is free under the same order.', { exact: false }).waitFor();
  await upload();
  await coachPage.reload(); await replacement();
  const { p: adminPage } = await openAs(admin, '/admin/passport/assessments');
  await adminPage.getByText('improver-bandeja · 2 requests', { exact: false }).waitFor();
  check('Two replacement requests stay incomplete under one payment and appear in the authorised admin watch without sending email');
  await upload(); await coachPage.reload();
  await coachPage.getByRole('button', { name: 'Complete as Developing', exact: true }).click();
  await coachPage.getByRole('alert').filter({ hasText: 'Assessment summary' }).waitFor();
  async function finalFeedback(verified) {
    if (verified) await coachPage.getByRole('radio', { name: 'Verified', exact: true }).check();
    await coachPage.getByLabel('Assessment summary', { exact: false }).fill('Stable preparation with improving racket control through contact.');
    const criteria = coachPage.getByRole('combobox').filter({ hasNotText: 'Choose an issue' });
    await criteria.nth(0).selectOption('true'); await criteria.nth(1).selectOption(verified ? 'true' : 'false');
    await coachPage.getByLabel('What is working', { exact: true }).fill('Good early preparation and balanced positioning.');
    await coachPage.getByLabel('Areas to improve', { exact: false }).fill('Keep the contact point further in front while recovering.');
    await coachPage.getByLabel('Technical recommendations', { exact: true }).fill('Shorten the backswing and recover together after each contact.');
    await coachPage.getByLabel('Practice exercises', { exact: false }).fill('Ten controlled partner feeds to a marked target.');
    await coachPage.getByLabel('Recommended next step', { exact: true }).fill('Practise controlled feeds with a partner before reassessment.');
    await coachPage.getByRole('button', { name: verified ? 'Complete as Verified' : 'Complete as Developing', exact: true }).click();
    await coachPage.getByRole('heading', { name: 'Assessment complete', exact: true }).waitFor();
  }
  await finalFeedback(false);
  assert.equal((await root.query('select count(*)::int n from public.pp_skill_verifications where order_id=$1', [order])).rows[0].n, 0);
  await page.goto(origin + route); await page.getByRole('heading', { name: "Your coach's feedback", exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Developing', exact: true }).waitFor();
  for (const width of [320, 390]) { await page.setViewportSize({ width, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  await page.goto(origin + '/account/development/next-step');
  await page.getByText('Ten controlled partner feeds to a marked target.', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(workdir, 'd-player-next-step.png'), fullPage: true });
  check('Developing completes the paid assessment without verification; player feedback and My Next Step show the submitted coach guidance');
  const reassessment = (await command(player, 'create_order', { offer_id: offer, policy_id: policy, parent_order_id: order })).id;
  assert.equal((await context.request.post(origin + '/account/development/assessments/' + reassessment + '/video', { data: file.buffer, headers: { origin, 'content-type': file.mimeType, 'x-request-id': randomUUID() } })).status(), 409);
  assert.equal((await worker.rpc('passport_provider_event', { p_source: 'payment', p_event_id: randomUUID(), p_payload: { order_id: reassessment, amount_minor: 3500, currency: 'GBP', payment_reference: 'mock:d:reassessment:' + reassessment } })).error, null);
  await upload(reassessment);
  await coachPage.goto(origin + queue + '/' + reassessment);
  await finalFeedback(true);
  await page.goto(origin + '/account/development/passport');
  await page.getByText('1 valid skill milestone(s)', { exact: false }).waitFor();
  await page.getByRole('heading', { name: 'Verification history', exact: true }).waitFor();
  await page.screenshot({ path: path.join(workdir, 'd-player-passport.png'), fullPage: true });
  assert.equal((await root.query('select count(*)::int n from public.pp_skill_verifications where order_id=$1', [reassessment])).rows[0].n, 1);
  check('New linked reassessment requires its own trusted funding; Verified creates one evidence-linked Passport milestone through the coach UI');
  const otherView = await openAs(other, '/account');
  async function deniedPage(ctx, target) {
    const response = await ctx.request.get(origin + target), html = await response.text();
    // Next can stream a not-found boundary after its parent sent HTTP 200.
    assert.ok(response.status() === 404 || html.includes('NEXT_HTTP_ERROR_FALLBACK;404'));
    assert.ok(!html.includes('The professional assessment has been delivered.'));
  }
  await deniedPage(otherView.ctx, route);
  assert.equal((await otherView.ctx.request.get(origin + endpoint)).status(), 404);
  const differentAttempt = (await root.query('select active_attempt_id from public.pp_orders where id=$1', [reassessment])).rows[0].active_attempt_id;
  assert.equal((await context.request.get(origin + endpoint + '?attempt=' + differentAttempt)).status(), 404);
  const attempt1 = (await root.query('select id from public.pp_submission_attempts where order_id=$1 order by attempt_number limit 1', [order])).rows[0].id;
  assert.equal((await coachContext.request.get(origin + endpoint + '?attempt=' + attempt1)).status(), 200);
  await command(admin, 'set_assessor', { id: grant, status: 'suspended', reason: 'Synthetic D revocation access check' });
  assert.equal((await coachContext.request.get(origin + endpoint)).status(), 404);
  await deniedPage(coachContext, reviewPath);
  assert.equal((await context.request.get(origin + route)).status(), 200);
  check('Cross-player feedback/video denied; authorised old-attempt playback works, suspension removes new coach access and player history remains');
  assert.deepEqual(pageErrors, []);
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
