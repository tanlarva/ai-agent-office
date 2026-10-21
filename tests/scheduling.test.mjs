import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../dist/server/store.js';
import { Runtime } from '../dist/server/runtime.js';
import { OfficeError } from '../dist/server/errors.js';
import { ProviderGovernor, exhaustedWindows, schedulingFromEnv } from '../dist/server/scheduling.js';
import { providerTurnError } from '../dist/server/provider-errors.js';
import { terminalStates } from '../dist/shared/contracts.js';
import { resumableTaskIndex } from '../dist/shared/retries.js';
import { createApp } from '../dist/server/app.js';
import { parseLimitWindows, quotaReset } from '../dist/server/provider-limits.js';

const limited = () => new OfficeError('PROVIDER_RATE_LIMIT', '429', 429);
const ready = () => ({ id: 'codex', state: 'ready', message: 'ready', billingMode: 'chatgpt', plan: 'plus', models: [{ id: 'test-model', name: 'test', isDefault: true }], limits: null });
function output(options) {
  const p = options.schema.properties;
  const checks = [{ command: 'npm test', passed: true, evidence: 'observed exit 0' }];
  return { text: JSON.stringify(p.steps ? { summary: 'plan evidence', steps: ['check acceptance'] } : p.blocked ? { summary: 'work evidence', blocked: false, files: [], tests: options.writable ? checks : [] } : { summary: 'review evidence', approved: true, findings: [], ...(p.tests ? { tests: checks } : {}) }), tools: [{ command: 'npm test', exitCode: 0 }], changedFiles: false };
}
async function fixture(t, action, overrides = {}) {
  const base = await mkdtemp(join(tmpdir(), 'office-balance-'));
  const root = join(base, 'app'), workspace = join(base, 'workspace');
  await Promise.all([mkdir(root), mkdir(workspace)]);
  const store = await Store.open(join(root, 'office.db'));
  const clock = { value: 1_800_000_000_000, waits: [] };
  const scheduling = { minGapMs: 10, baseBackoffMs: 100, maxBackoffMs: 500, maxWaitMs: 2000, maxRetries: 2, jitterRatio: 0.2, random: () => 1, now: () => clock.value, sleep: async (ms, signal) => { if (signal.aborted) throw new Error('aborted'); clock.waits.push(ms); clock.value += ms; }, ...overrides };
  const calls = [];
  const provider = { status: async () => ready(), execute: async options => {
    calls.push({ role: options.role, time: clock.value, writable: options.writable, prompt: options.prompt });
    await options.onEvent('usage.updated', { inputTokens: 10, outputTokens: 1 });
    const result = await action?.(options, calls);
    return result ?? output(options);
  } };
  const runtime = new Runtime(store, provider, { appRoot: root, scheduling, timeoutMs: overrides.timeoutMs });
  t.after(async () => { await runtime.close(); await store.close(); await rm(base, { recursive: true, force: true }); });
  return { base, root, workspace, store, runtime, provider, clock, calls, scheduling, input: { goal: 'Inspect acceptance criteria', workspace, mode: 'read-only' } };
}
async function settled(store, id) {
  for (let i = 0; i < 500; i++) { const run = await store.get(id); if (terminalStates.has(run.state)) return run; await new Promise(resolve => setTimeout(resolve, 5)); }
  throw new Error('Run did not settle');
}

test('provider error classifier separates 429, quota and unrelated errors', () => {
  assert.equal(providerTurnError({ message: 'exceeded retry limit, last status: 429 Too Many Requests' }).code, 'PROVIDER_RATE_LIMIT');
  assert.equal(providerTurnError({ message: 'failed', codexErrorInfo: { HttpConnectionFailed: { httpStatusCode: 429 } } }).code, 'PROVIDER_RATE_LIMIT');
  assert.equal(providerTurnError({ message: 'usage', codexErrorInfo: 'UsageLimitExceeded' }).code, 'PROVIDER_LIMIT');
  assert.equal(providerTurnError({ message: 'unauthorized', codexErrorInfo: { httpStatusCode: 401 } }).code, 'TURN_FAILED');
  assert.equal(providerTurnError(null).code, 'TURN_FAILED');
});

test('production policy has bounded retry configuration and detects secondary quota', () => {
  assert.deepEqual(schedulingFromEnv({}), { minGapMs: 15000, maxRetries: 2 });
  assert.throws(() => schedulingFromEnv({ OFFICE_RATE_RETRIES: '20' }));
  assert.throws(() => schedulingFromEnv({ OFFICE_CALL_GAP_MS: '-1' }));
  assert.equal(exhaustedWindows({ ...ready(), limits: { usedPercent: 10, resetsAt: null }, limitWindows: [{ name: 'primary', usedPercent: 10, resetsAt: null }, { name: 'secondary', usedPercent: 100, resetsAt: 123 }] }).length, 1);
});

test('App Server limit parser prefers multi-bucket data, includes secondary and rejects invalid reset values', () => {
  const windows = parseLimitWindows({ rateLimits: { primary: { usedPercent: 999 } }, rateLimitsByLimitId: { codex: { primary: { usedPercent: 20, resetsAt: 1800000010 }, secondary: { usedPercent: 100, resetsAt: 1800000020 } }, other: { primary: { usedPercent: 30, resetsAt: Number.POSITIVE_INFINITY } } } });
  assert.equal(windows.length, 3);
  assert.equal(windows[1].name, 'codex/secondary');
  assert.equal(windows[2].resetsAt, null);
  assert.equal(quotaReset({ ...ready(), limitWindows: windows }), 1800000020000);
  assert.deepEqual(parseLimitWindows({ rateLimits: { primary: { usedPercent: 12, resetsAt: 1800000010 } } })[0], { name: 'codex/primary', usedPercent: 12, resetsAt: 1800000010 });
  assert.deepEqual(parseLimitWindows(null), []);
});

test('global spacing persists between roles and future runs without duplicate dispatch', async t => {
  const f = await fixture(t);
  const first = await f.runtime.create(f.input, randomUUID()); await settled(f.store, first.id);
  const second = await f.runtime.create(f.input, randomUUID()); await settled(f.store, second.id);
  assert.equal(f.calls.length, 6);
  for (let i = 1; i < f.calls.length; i++) assert.ok(f.calls[i].time - f.calls[i - 1].time >= 10);
  const events = await f.store.events(first.id, 0, 200);
  assert.equal(events.filter(event => event.type === 'capacity.waiting').length, 2);
  assert.ok(events.some(event => event.payload.reason === 'spacing'));
});

test('read-only 429 retries only the failed role with exponential jitter and accumulated usage', async t => {
  let failures = 0;
  const f = await fixture(t, async options => { if (options.role === 'orchestrator' && failures++ < 2) throw limited(); });
  const run = await f.runtime.create(f.input, randomUUID()), final = await settled(f.store, run.id);
  assert.equal(final.state, 'succeeded', final.error);
  assert.deepEqual(f.calls.map(call => call.role), ['orchestrator', 'orchestrator', 'orchestrator', 'builder', 'reviewer']);
  assert.deepEqual(f.clock.waits.slice(0, 2), [120, 240]);
  assert.equal(final.tasks[0].usageAttempts.length, 3);
  assert.equal(final.tasks[0].inputTokens, 30);
  assert.equal(final.tasks[0].outputTokens, 3);
  assert.equal((await f.runtime.governor.status()).rateLimitStreak, 0);
});

test('continuous 429 has a hard attempt cap, durable cooldown and queued downstream roles', async t => {
  const f = await fixture(t, async () => { throw limited(); });
  const run = await f.runtime.create(f.input, randomUUID()), final = await settled(f.store, run.id);
  assert.equal(final.state, 'failed'); assert.equal(final.failureCode, 'PROVIDER_RATE_LIMIT');
  assert.equal(f.calls.length, 3);
  assert.equal(final.tasks[1].state, 'queued'); assert.equal(final.tasks[2].state, 'queued');
  assert.equal((await f.runtime.governor.status()).rateLimitStreak, 3);
  const reopened = await Store.open(join(f.root, 'office.db'));
  try { assert.deepEqual(await reopened.scheduling(), await f.store.scheduling()); }
  finally { await reopened.close(); }
});

test('wait budget stops retries before a long cooldown can block the worker indefinitely', async t => {
  const f = await fixture(t, async () => { throw limited(); }, { maxWaitMs: 150 });
  const run = await f.runtime.create(f.input, randomUUID()); await settled(f.store, run.id);
  assert.equal(f.calls.length, 2);
  await assert.rejects(f.runtime.governor.wait(new AbortController().signal, async () => {}), { code: 'PROVIDER_RATE_LIMIT' });
});

test('known exhausted secondary quota blocks inference and records reset; no automatic quota retry', async t => {
  const f = await fixture(t);
  f.provider.status = async () => ({ ...ready(), limitWindows: [{ name: 'secondary', usedPercent: 100, resetsAt: (f.clock.value + 3_600_000) / 1000 }] });
  await assert.rejects(f.runtime.create(f.input, randomUUID()), { code: 'PROVIDER_LIMIT' });
  assert.equal(f.calls.length, 0);
  assert.ok((await f.store.scheduling()).nextAllowedAt >= f.clock.value + 3_600_000);
});

test('quota is checked again before each role, not only when the run is created', async t => {
  const f = await fixture(t);
  f.provider.status = async () => f.calls.length ? { ...ready(), limits: { usedPercent: 100, resetsAt: null } } : ready();
  const run = await f.runtime.create(f.input, randomUUID()), final = await settled(f.store, run.id);
  assert.equal(final.failureCode, 'PROVIDER_LIMIT'); assert.equal(f.calls.length, 1);
});

test('provider-classified quota exhaustion does not retry even if usage is unavailable', async t => {
  const f = await fixture(t, async () => { throw new OfficeError('PROVIDER_LIMIT', 'usage exhausted', 429); });
  const run = await f.runtime.create(f.input, randomUUID()); await settled(f.store, run.id);
  assert.equal(f.calls.length, 1);
});

test('writer 429 never replays a writer and cannot resume the writing prefix', async t => {
  const f = await fixture(t, async options => { if (options.role === 'developer') throw limited(); });
  const run = await f.runtime.create({ ...f.input, workflowId: 'software', mode: 'workspace-write' }, randomUUID()), final = await settled(f.store, run.id);
  assert.equal(f.calls.filter(call => call.role === 'developer').length, 1);
  assert.equal(resumableTaskIndex(final), -1);
  await assert.rejects(f.runtime.retry(final.id, final.version, randomUUID()), { code: 'RETRY_UNSAFE' });
});

test('observed file changes prohibit automatic replay even for a nominally read-only role', async t => {
  const f = await fixture(t, async options => { await options.onEvent('artifact.created', {}); throw limited(); });
  const run = await f.runtime.create(f.input, randomUUID()), final = await settled(f.store, run.id);
  assert.equal(f.calls.length, 1); assert.equal(final.tasks[0].observedWrites, true);
  assert.equal(resumableTaskIndex(final), -1);
});

test('cancel during cooldown is immediate and never dispatches another model attempt', async t => {
  let reached;
  const sleeping = new Promise(resolve => { reached = resolve; });
  const f = await fixture(t, async () => { throw limited(); }, { sleep: async (_ms, signal) => { reached(); await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); throw new Error('aborted'); } });
  const run = await f.runtime.create(f.input, randomUUID()); await sleeping;
  assert.equal((await f.store.get(run.id)).state, 'waiting_capacity');
  await f.runtime.cancel(run.id);
  assert.equal((await settled(f.store, run.id)).state, 'canceled'); assert.equal(f.calls.length, 1);
});

test('timeout during cooldown terminates instead of dispatching after the deadline', async t => {
  const f = await fixture(t, async () => { throw limited(); }, { timeoutMs: 100, sleep: async (_ms, signal) => { await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); throw new Error('aborted'); } });
  const run = await f.runtime.create(f.input, randomUUID()), final = await settled(f.store, run.id);
  assert.equal(final.state, 'failed'); assert.equal(f.calls.length, 1);
  assert.equal(final.waiting, undefined);
});

test('resume at QA inherits completed handoffs without replaying Developer and preserves the old run', async t => {
  let failQa = true;
  const f = await fixture(t, async options => { if (options.role === 'qa' && failQa) throw limited(); }, { maxRetries: 0 });
  const old = await f.runtime.create({ ...f.input, workflowId: 'software', mode: 'workspace-write' }, randomUUID()), failed = await settled(f.store, old.id);
  assert.equal(resumableTaskIndex(failed), 3);
  failQa = false;
  const before = f.calls.length, key = randomUUID();
  await assert.rejects(f.runtime.retry(failed.id, failed.version - 1, randomUUID()), { code: 'VERSION_CONFLICT' });
  const [resumed, duplicate] = await Promise.all([f.runtime.retry(failed.id, failed.version, key), f.runtime.retry(failed.id, failed.version, key)]);
  assert.equal(resumed.id, duplicate.id);
  const final = await settled(f.store, resumed.id);
  assert.equal(final.state, 'succeeded', final.error);
  assert.equal(final.retryOfRunId, failed.id);
  assert.deepEqual(f.calls.slice(before).map(call => call.role), ['qa', 'reviewer']);
  assert.ok(final.tasks.slice(0, 3).every(task => task.inheritedFromTaskId && task.inputTokens === 0 && task.handoff));
  assert.match(f.calls[before].prompt, /work evidence/);
  assert.deepEqual(await f.store.get(failed.id), failed);
  assert.equal((await f.runtime.retry(failed.id, failed.version, key)).id, resumed.id);
  assert.equal(f.calls.length, before + 2);
});

test('legacy 429 QA run can use summary handoffs; unrelated failures cannot resume', async t => {
  const f = await fixture(t);
  const initial = await f.runtime.create({ ...f.input, workflowId: 'software' }, randomUUID()), done = await settled(f.store, initial.id);
  const legacy = { ...structuredClone(done), id: randomUUID(), version: 1, lastSequence: 0, state: 'failed', failureCode: undefined, error: 'Codex failed: 429 Too Many Requests' };
  for (const task of legacy.tasks) delete task.handoff;
  legacy.tasks[3].state = 'failed'; legacy.tasks[4].state = 'canceled';
  await f.store.create(legacy, randomUUID(), 'legacy');
  const resumed = await f.runtime.retry(legacy.id, 1, randomUUID());
  assert.equal((await settled(f.store, resumed.id)).state, 'succeeded');
  assert.equal(resumableTaskIndex({ ...legacy, error: 'invalid JSON' }), -1);
});

test('governor rejects dispatch after abort and honors persisted future spacing', async t => {
  const f = await fixture(t);
  await f.runtime.governor.completed(true);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(f.runtime.governor.wait(aborted.signal, async () => {}), { code: 'CANCELED' });
  const gate = new ProviderGovernor(f.store, f.scheduling);
  await gate.wait(new AbortController().signal, async () => {});
  assert.equal(f.clock.waits.at(-1), 10);
});

test('recovery interrupts a waiting run without replay and clears stale UI wait metadata', async t => {
  const f = await fixture(t, async () => { throw limited(); }, { maxRetries: 0 });
  const original = await f.runtime.create(f.input, randomUUID()), failed = await settled(f.store, original.id);
  const orphan = { ...structuredClone(failed), id: randomUUID(), state: 'waiting_capacity', version: 1, lastSequence: 0, waiting: { reason: 'rate_limit', until: new Date(f.clock.value + 500).toISOString(), attempt: 2 } };
  orphan.tasks[0].state = 'waiting_capacity';
  await f.store.create(orphan, randomUUID(), 'orphan');
  const calls = f.calls.length; await f.runtime.recover();
  const result = await f.store.get(orphan.id);
  assert.equal(result.state, 'interrupted'); assert.equal(result.waiting, undefined); assert.equal(f.calls.length, calls);
});

test('scheduling/retry APIs enforce authentication, CSRF, version and idempotency', async t => {
  const base = await mkdtemp(join(tmpdir(), 'office-balance-api-'));
  const root = join(base, 'app'), workspace = join(base, 'workspace'); await Promise.all([mkdir(root), mkdir(workspace)]);
  const store = await Store.open(join(root, 'office.db'));
  const provider = { status: async () => ready(), execute: async options => output(options) };
  const { app } = await createApp({ root, store, provider, scheduling: { minGapMs: 0, maxRetries: 0 } });
  t.after(async () => { await app.close(); await rm(base, { recursive: true, force: true }); });
  const headers = { host: '127.0.0.1:4310', 'x-office-client': 'browser' };
  assert.equal((await app.inject({ url: '/api/scheduling', headers })).statusCode, 401);
  const bootstrap = await app.inject({ url: '/api/session', headers }); headers.cookie = bootstrap.headers['set-cookie'].split(';')[0];
  assert.equal((await app.inject({ url: '/api/scheduling', headers })).json().data.maxRetries, 0);
  const id = randomUUID();
  const payload = { version: 1 };
  assert.equal((await app.inject({ method: 'POST', url: '/api/runs/' + id + '/retries', headers, payload })).statusCode, 403);
  headers['x-csrf-token'] = bootstrap.json().data.csrfToken; headers['idempotency-key'] = randomUUID();
  assert.equal((await app.inject({ method: 'POST', url: '/api/runs/' + id + '/retries', headers, payload: { version: 0 } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/runs/' + id + '/retries', headers, payload })).statusCode, 404);
});
