const fastScheduling = { minGapMs: 0, maxRetries: 0, baseBackoffMs: 1, jitterRatio: 0 };
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../dist/server/store.js';
import { Runtime, verifyBuild, normalizeCommand } from '../dist/server/runtime.js';
import { validateWorkspace } from '../dist/server/workspace.js';
import { createApp } from '../dist/server/app.js';
import { createRunSchema, terminalStates } from '../dist/shared/contracts.js';
import { safeText } from '../dist/server/errors.js';
import { providerEnvironment } from '../dist/server/rpc.js';
import { acquireInstanceLock } from '../dist/server/instance-lock.js';

const ready = { id: 'codex', state: 'ready', billingMode: 'chatgpt', plan: 'plus', message: 'ready', models: [], limits: null };
class FakeProvider {
  calls = [];
  constructor(action) { this.action = action; }
  async status() { return ready; }
  async execute(options) {
    this.calls.push(options.role);
    await options.onEvent('usage.updated', { inputTokens: 11, outputTokens: 3 });
    if (this.action) { const override = await this.action(options); if (override) return override; }
    const output = options.role === 'orchestrator' ? { summary: 'Plan', steps: ['Inspect'] }
      : options.role === 'builder' ? { summary: 'Read-only result', blocked: false, files: [], tests: [] }
      : { approved: true, summary: 'Reviewed', findings: [] };
    return { text: JSON.stringify(output), tools: [], changedFiles: false };
  }
}
async function setup(t, provider = new FakeProvider(), timeoutMs = 5000) {
  const base = await mkdtemp(join(tmpdir(), 'agent-office-test-'));
  const root = join(base, 'app'), workspace = join(base, 'workspace');
  await mkdir(root); await mkdir(workspace);
  const store = await Store.open(join(root, 'office.db'));
  const runtime = new Runtime(store, provider, { appRoot: root, scheduling: fastScheduling, timeoutMs });
  t.after(async () => { await runtime.close(); await store.close(); await rm(base, { recursive: true, force: true }); });
  return { base, root, workspace, store, runtime, provider, input: { goal: 'Inspect this workspace', workspace, mode: 'read-only' } };
}
async function waitFor(fn, message = 'condition') {
  for (let i = 0; i < 300; i++) { const result = await fn(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw new Error(`Timed out waiting for ${message}`);
}
const settled = (store, id) => waitFor(async () => { const run = await store.get(id); return run && terminalStates.has(run.state) ? run : null; }, 'terminal run');

test('contracts enforce boundaries and reject unknown fields', () => {
  assert.equal(createRunSchema.parse({ goal: 'Inspect', workspace: 'C:/test' }).mode, 'read-only');
  for (const body of [{ goal: 'x', workspace: 'C:/test' }, { goal: 'Inspect', workspace: 'C:/test', command: 'bad' }, { goal: 'Inspect', workspace: 'C:/test', mode: 'full-access' }])
    assert.equal(createRunSchema.safeParse(body).success, false);
});
test('pipeline uses three real roles in order and persists usage/events', async t => {
  const { runtime, input, store, provider } = await setup(t);
  const run = await runtime.create(input, randomUUID());
  const result = await settled(store, run.id);
  assert.equal(result.state, 'succeeded');
  assert.deepEqual(provider.calls, ['orchestrator', 'builder', 'reviewer']);
  assert.equal(result.tasks.every(task => task.state === 'succeeded' && task.inputTokens === 11), true);
  const events = await store.events(run.id, 0, 200);
  assert.deepEqual(events.map(event => event.sequence), Array.from({ length: events.length }, (_, i) => i + 1));
  assert.equal(events.at(-1).type, 'run.completed');
  assert.equal(result.version, events.length + 1);
});
test('idempotency returns same run, rejects changed body, and does not dispatch twice', async t => {
  const { runtime, input, store, provider } = await setup(t);
  const key = randomUUID();
  const [first, second] = await Promise.all([runtime.create(input, key), runtime.create(input, key)]);
  assert.equal(first.id, second.id);
  await assert.rejects(runtime.create({ ...input, goal: 'Different goal' }, key), { code: 'IDEMPOTENCY_CONFLICT' });
  await settled(store, first.id); assert.equal(provider.calls.length, 3);
});
test('single active run prevents concurrent writers; cancel is idempotent', async t => {
  const provider = new FakeProvider(async options => {
    await new Promise(resolve => options.signal.addEventListener('abort', resolve, { once: true }));
    throw new Error('aborted');
  });
  const { runtime, input, store } = await setup(t, provider);
  const run = await runtime.create(input, randomUUID());
  await waitFor(() => provider.calls.length);
  await assert.rejects(runtime.create(input, randomUUID()), { code: 'WORKER_BUSY' });
  await runtime.cancel(run.id); await runtime.cancel(run.id);
  assert.equal((await settled(store, run.id)).state, 'canceled');
});
test('timeout fails run and stops dispatching later roles', async t => {
  const provider = new FakeProvider(async options => {
    await new Promise(resolve => options.signal.addEventListener('abort', resolve, { once: true }));
    throw new Error('aborted');
  });
  const { runtime, input, store } = await setup(t, provider, 30);
  const run = await runtime.create(input, randomUUID());
  assert.equal((await settled(store, run.id)).state, 'failed'); assert.equal(provider.calls.length, 1);
});
test('billing mismatch and exhausted quota prevent any turn', async t => {
  const provider = new FakeProvider();
  const { runtime, input } = await setup(t, provider);
  provider.status = async () => ({ ...ready, state: 'billing_mismatch', billingMode: 'apiKey' });
  await assert.rejects(runtime.create(input, randomUUID()), { code: 'PROVIDER_NOT_READY' });
  provider.status = async () => ({ ...ready, limits: { usedPercent: 100, resetsAt: null } });
  await assert.rejects(runtime.create(input, randomUUID()), { code: 'PROVIDER_LIMIT' }); assert.equal(provider.calls.length, 0);
});
test('unavailable models are rejected before dispatch', async t => {
  const { runtime, input } = await setup(t);
  await assert.rejects(runtime.create({ ...input, model: 'made-up' }, randomUUID()), { code: 'MODEL_INVALID' });
});
test('invalid structured output fails closed', async t => {
  const provider = new FakeProvider(async () => ({ text: 'not JSON', tools: [], changedFiles: false }));
  const { runtime, input, store } = await setup(t, provider);
  const run = await runtime.create(input, randomUUID());
  assert.equal((await settled(store, run.id)).state, 'failed'); assert.equal(provider.calls.length, 1);
});
test('review findings prevent false success', async t => {
  const provider = new FakeProvider(async options => options.role === 'reviewer' ? { text: JSON.stringify({ approved: true, summary: 'Bug found', findings: ['Fix bug'] }), tools: [], changedFiles: false } : undefined);
  const { runtime, input, store } = await setup(t, provider);
  const run = await runtime.create(input, randomUUID());
  const result = await settled(store, run.id);
  assert.equal(result.state, 'failed'); assert.match(result.error, /Bug found/);
});
test('build gate requires observed successful commands after file changes', () => {
  const build = { summary: 'done', blocked: false, files: ['x.ts'], tests: [] };
  assert.throws(() => verifyBuild(build, { changedFiles: false, tools: [] }), { code: 'TEST_EVIDENCE_MISSING' });
  const withTest = { ...build, tests: [{ command: 'npm test', passed: true, evidence: 'passed' }] };
  assert.throws(() => verifyBuild(withTest, { tools: [{ command: 'npm test', exitCode: 1 }] }), { code: 'TEST_EVIDENCE_INVALID' });
  assert.throws(() => verifyBuild(withTest, { tools: [{ command: 'echo ok', exitCode: 0 }] }), { code: 'TEST_EVIDENCE_INVALID' });
  verifyBuild(withTest, { tools: [{ command: 'npm  test', exitCode: 0 }] });
  assert.equal(normalizeCommand('"C:\\Tools\\pwsh.exe" -Command \'node --test greet.test.mjs\''), 'node --test greet.test.mjs');
  verifyBuild({ ...withTest, tests: [{ command: 'node --test greet.test.mjs', passed: true, evidence: 'exit 0' }] }, { tools: [{ command: '"C:\\Tools\\pwsh.exe" -Command \'node --test greet.test.mjs\'', exitCode: 0 }] });
  assert.throws(() => verifyBuild(withTest, { tools: [{ command: '"C:\\Tools\\pwsh.exe" -Command \'npm test; echo done\'', exitCode: 0 }] }), { code: 'TEST_EVIDENCE_INVALID' });
  assert.throws(() => verifyBuild({ ...build, files: [] }, { changedFiles: false, tools: [] }, true), { code: 'TEST_EVIDENCE_MISSING' });
});
test('read-only roles cannot acquire approval; writable builder requires explicit decision', async t => {
  const provider = new FakeProvider(async options => {
    if (options.role === 'orchestrator') assert.equal(await options.onApproval('item/fileChange/requestApproval', 'write'), 'decline');
    if (options.role === 'builder') {
      const decision = await options.onApproval('item/commandExecution/requestApproval', 'Run a check');
      assert.equal(decision, 'accept');
      return { text: JSON.stringify({ summary: 'Checked', blocked: false, files: [], tests: [{ command: 'check', passed: true, evidence: 'exit 0' }] }), tools: [{ command: 'check', exitCode: 0 }], changedFiles: false };
    }
  });
  const { runtime, input, store } = await setup(t, provider);
  const run = await runtime.create({ ...input, mode: 'workspace-write' }, randomUUID());
  const pending = await waitFor(async () => { const r = await store.get(run.id); return r?.state === 'waiting_approval' ? r : null; });
  await assert.rejects(runtime.decide(pending.approvals[0].id, 'accept', pending.version - 1), { code: 'VERSION_CONFLICT' });
  const current = await store.get(run.id);
  await runtime.decide(current.approvals[0].id, 'accept', current.version);
  assert.equal((await settled(store, run.id)).state, 'succeeded');
});
test('pending approvals expire when canceled and cannot be accepted later', async t => {
  const provider = new FakeProvider(async options => {
    if (options.role === 'builder') await options.onApproval('item/fileChange/requestApproval', 'write');
  });
  const { runtime, input, store } = await setup(t, provider);
  const run = await runtime.create({ ...input, mode: 'workspace-write' }, randomUUID());
  const pending = await waitFor(async () => { const r = await store.get(run.id); return r?.state === 'waiting_approval' ? r : null; });
  await runtime.cancel(run.id);
  const final = await settled(store, run.id); assert.equal(final.approvals[0].state, 'expired');
  await assert.rejects(runtime.decide(pending.approvals[0].id, 'accept', pending.version), { code: 'APPROVAL_NOT_FOUND' });
});
test('optimistic concurrency rejects stale state and event atomically', async t => {
  const { runtime, input, store } = await setup(t);
  const created = await runtime.create(input, randomUUID());
  const run = await settled(store, created.id);
  const event = { schemaVersion: 1, eventId: randomUUID(), runId: run.id, taskId: null, sequence: run.lastSequence + 1, occurredAt: new Date().toISOString(), type: 'bad', payload: {} };
  await assert.rejects(store.save(run, event), /VERSION_CONFLICT/);
  assert.equal((await store.events(run.id, event.sequence - 1, 10)).length, 0);
});
test('recovery marks orphaned run interrupted without invoking provider', async t => {
  const { runtime, input, store, provider } = await setup(t);
  const id = randomUUID(), now = new Date().toISOString();
  await store.create({ id, ...input, state: 'running', version: 1, lastSequence: 0, createdAt: now, updatedAt: now, tasks: [], approvals: [], error: null }, randomUUID(), 'hash');
  await runtime.recover(); assert.equal((await store.get(id)).state, 'interrupted'); assert.equal(provider.calls.length, 0);
});
test('workspace rejects app source, filesystem root, missing and relative folders', async t => {
  const { root, workspace } = await setup(t);
  assert.equal(await validateWorkspace(workspace, root), await realpath(workspace));
  for (const input of [root, join(root, '..'), '.', 'Z:/folder-that-does-not-exist-44']) await assert.rejects(validateWorkspace(input, root));
  await assert.rejects(validateWorkspace(workspace, root, root), { code: 'WORKSPACE_SCOPE' });
});
test('workspace rejects selected junction or symlink', async t => {
  const { base, root, workspace } = await setup(t);
  const link = join(base, 'link');
  await symlink(workspace, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(validateWorkspace(link, root), { code: 'WORKSPACE_LINK' });
});
test('redaction and child environment keep conventional credentials out', () => {
  assert.equal(safeText('Bearer abc.def sk-abcdefghijk API_KEY=123 password:hello').includes('abc.def'), false);
  const env = providerEnvironment();
  assert.equal('OPENAI_API_KEY' in env, false); assert.equal('ANTHROPIC_API_KEY' in env, false);
});
test('failed persistence does not poison live version or manufacture an event', async t => {
  const { runtime, input, store } = await setup(t);
  const save = store.save.bind(store); let fail = true;
  store.save = async (run, event) => { if (fail) { fail = false; throw new Error('Injected transaction failure'); } return save(run, event); };
  const run = await runtime.create(input, randomUUID());
  const final = await settled(store, run.id);
  assert.equal(final.state, 'failed'); assert.equal(final.version, 2);
  const events = await store.events(run.id, 0, 100);
  assert.equal(events.length, 1); assert.equal(events[0].sequence, 1); assert.equal(events[0].type, 'run.completed');
});
test('cancellation racing final task save cannot become success or stuck canceling', async t => {
  const { runtime, input, store } = await setup(t);
  const save = store.save.bind(store); let release, waiting = false;
  const gate = new Promise(resolve => { release = resolve; });
  store.save = async (run, event) => {
    if (event.type === 'task.state_changed' && run.tasks.at(-1)?.state === 'succeeded') { waiting = true; await gate; }
    return save(run, event);
  };
  const run = await runtime.create(input, randomUUID());
  await waitFor(() => waiting);
  const cancel = runtime.cancel(run.id); release(); await cancel;
  assert.equal((await settled(store, run.id)).state, 'canceled');
});
test('single-instance kernel lock prevents a second runtime and releases cleanly', async t => {
  const { root } = await setup(t);
  const release = await acquireInstanceLock(root);
  try { await assert.rejects(acquireInstanceLock(root), { code: 'INSTANCE_RUNNING' }); }
  finally { await release(); }
  const releaseAgain = await acquireInstanceLock(root); await releaseAgain();
});
test('HTTP authentication, origin, validation and safe errors', async t => {
  const base = await mkdtemp(join(tmpdir(), 'office-http-'));
  const store = await Store.open(join(base, 'db.sqlite'));
  const { app } = await createApp({ scheduling: fastScheduling, root: base, store, provider: new FakeProvider() });
  t.after(async () => { await app.close(); await rm(base, { recursive: true, force: true }); });
  const headers = { host: '127.0.0.1:4310', 'x-office-client': 'browser' };
  assert.equal((await app.inject({ url: '/api/session', headers: { ...headers, origin: 'https://evil.example' } })).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/session', headers: { ...headers, host: 'evil.example' } })).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/providers', headers })).statusCode, 401);
  const session = await app.inject({ url: '/api/session', headers });
  const auth = { ...headers, cookie: session.headers['set-cookie'].split(';')[0] };
  const token = session.json().data.csrfToken;
  assert.equal((await app.inject({ url: '/api/providers', headers: auth })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/runs', headers: auth, payload: {} })).statusCode, 403);
  const invalid = await app.inject({ method: 'POST', url: '/api/runs', headers: { ...auth, 'x-csrf-token': token }, payload: { goal: 'x' } });
  assert.equal(invalid.statusCode, 400); assert.equal('stack' in invalid.json(), false);
  assert.equal((await app.inject({ url: '/api/runs?limit=201', headers: auth })).statusCode, 400);
  assert.equal((await app.inject({ url: '/api/runs/not-a-uuid', headers: auth })).statusCode, 400);
});
