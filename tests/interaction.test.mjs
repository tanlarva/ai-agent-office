import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../dist/server/store.js';
import { Runtime, MAX_INTERRUPTIONS } from '../dist/server/runtime.js';
import { createApp } from '../dist/server/app.js';
import { terminalStates, inquiryAnswerSchema, userNoteSchema, createRunSchema } from '../dist/shared/contracts.js';
import { suggestWorkflow } from '../dist/shared/suggest.js';

const fastScheduling = { minGapMs: 0, maxRetries: 0, baseBackoffMs: 1, jitterRatio: 0 };
const ready = id => ({ id, state: 'ready', billingMode: 'chatgpt', plan: 'plus', message: 'ready', models: [], limits: null });
function output(options, extra = {}) {
  const p = options.schema.properties;
  return JSON.stringify(p.steps ? { summary: 'Plan', steps: ['Inspect'], ...extra } : p.blocked ? { summary: 'Done', blocked: false, files: [], tests: [], ...extra } : { approved: true, summary: 'Reviewed', findings: [], ...extra });
}
function fakeProvider(id, action) {
  const calls = [];
  return { calls, id, status: async () => ready(id), async execute(options) {
    calls.push(options);
    const override = await action?.(options, calls);
    return override ?? { text: output(options), tools: [], changedFiles: false };
  } };
}
async function fixture(t, providers, timeoutMs = 5000) {
  const base = await mkdtemp(join(tmpdir(), 'office-interaction-'));
  const root = join(base, 'app'), workspace = join(base, 'workspace');
  await Promise.all([mkdir(root), mkdir(workspace)]);
  const store = await Store.open(join(root, 'office.db'));
  const runtime = new Runtime(store, providers, { appRoot: root, scheduling: fastScheduling, timeoutMs });
  t.after(async () => { await runtime.close(); await store.close(); await rm(base, { recursive: true, force: true }); });
  return { root, store, runtime, input: { goal: 'Inspect this workspace', workspace, mode: 'read-only' } };
}
async function waitFor(fn, message = 'condition') {
  for (let i = 0; i < 400; i++) { const value = await fn(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw new Error('Timed out waiting for ' + message);
}
const settled = (store, id) => waitFor(async () => { const run = await store.get(id); return run && terminalStates.has(run.state) ? run : null; }, 'terminal run');
const untilAborted = signal => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { code: 'CANCELED' })), { once: true }));

test('boundary schemas: answers, notes and provider choice are validated', () => {
  assert.equal(inquiryAnswerSchema.safeParse({ answers: ['a', 'b', 'c', 'd', 'e'] }).success, false);
  assert.equal(inquiryAnswerSchema.parse({ skip: true }).answers.length, 0);
  assert.equal(userNoteSchema.safeParse({ text: '' }).success, false);
  assert.equal(userNoteSchema.parse({ text: 'Dừng lại' }).mode, 'steer');
  assert.equal(userNoteSchema.safeParse({ text: 'x', mode: 'shell' }).success, false);
  assert.equal(createRunSchema.safeParse({ goal: 'Inspect', workspace: 'C:/x', provider: 'gemini' }).success, false);
});

test('a live question pauses the agent, notifies attention and resumes with the answer', async t => {
  let received;
  const provider = fakeProvider('codex', async options => {
    if (options.role !== 'builder') return;
    received = await options.onQuestion([{ question: 'Giữ API cũ?', options: [{ label: 'Có' }, { label: 'Không' }], multiSelect: false }]);
  });
  const { runtime, store, input } = await fixture(t, provider);
  const run = await runtime.create(input, randomUUID());
  const waiting = await waitFor(async () => { const r = await store.get(run.id); return r.state === 'waiting_input' ? r : null; }, 'waiting_input');
  assert.equal(waiting.tasks.find(task => task.role === 'builder').state, 'waiting_input');
  const [item] = runtime.attention();
  assert.deepEqual([item.kind, item.role, item.title], ['inquiry', 'Builder', 'Giữ API cũ?']);
  await assert.rejects(runtime.answer(item.id, { answers: [], skip: false }), { code: 'ANSWER_REQUIRED' });
  await runtime.answer(item.id, { answers: ['Có'], skip: false });
  const final = await settled(store, run.id);
  assert.equal(final.state, 'succeeded'); assert.deepEqual(received, { answers: ['Có'] });
  assert.equal(final.inquiries[0].state, 'answered'); assert.deepEqual(runtime.attention(), []);
  await assert.rejects(runtime.answer(item.id, { answers: ['x'], skip: false }), { code: 'INQUIRY_NOT_FOUND' });
});

test('letting the agent decide resolves a live question with null', async t => {
  let received = 'unset';
  const provider = fakeProvider('codex', async options => { if (options.role === 'builder') received = await options.onQuestion([{ question: 'Q?', options: [], multiSelect: false }]); });
  const { runtime, store, input } = await fixture(t, provider);
  const run = await runtime.create(input, randomUUID());
  const item = await waitFor(() => runtime.attention()[0], 'inquiry');
  await runtime.answer(item.id, { answers: [], skip: true });
  assert.equal((await settled(store, run.id)).inquiries[0].state, 'skipped'); assert.equal(received, null);
});

test('waiting for the user does not consume the run work deadline', async t => {
  const provider = fakeProvider('codex', async options => { if (options.role === 'builder') await options.onQuestion([{ question: 'Q?', options: [], multiSelect: false }]); });
  const { runtime, store, input } = await fixture(t, provider, 120);
  const run = await runtime.create(input, randomUUID());
  const item = await waitFor(() => runtime.attention()[0], 'inquiry');
  await new Promise(resolve => setTimeout(resolve, 250));
  await runtime.answer(item.id, { answers: ['ok'], skip: false });
  assert.equal((await settled(store, run.id)).state, 'succeeded');
});

test('questions returned at the end of a turn are asked, then the same role reruns with the answers', async t => {
  const provider = fakeProvider('codex', async (options, calls) => {
    if (options.role === 'orchestrator' && calls.filter(call => call.role === 'orchestrator').length === 1)
      return { text: output(options, { questions: ['Phạm vi gồm cả mobile?'] }), tools: [], changedFiles: false };
  });
  const { runtime, store, input } = await fixture(t, provider);
  const run = await runtime.create(input, randomUUID());
  const item = await waitFor(() => runtime.attention()[0], 'turn question');
  assert.equal(item.title, 'Phạm vi gồm cả mobile?');
  await runtime.answer(item.id, { answers: ['Chỉ web'], skip: false });
  const final = await settled(store, run.id);
  assert.equal(final.state, 'succeeded');
  assert.deepEqual(provider.calls.map(call => call.role), ['orchestrator', 'orchestrator', 'builder', 'reviewer']);
  assert.match(provider.calls[1].prompt, /Q: Phạm vi gồm cả mobile\?\nA: Chỉ web/);
  assert.equal(final.inquiries[0].source, 'turn_output'); assert.equal(final.tasks[0].questionRounds, 1);
});

test('skipping end-of-turn questions keeps the delivered result without another model call', async t => {
  const provider = fakeProvider('codex', async options => { if (options.role === 'orchestrator') return { text: output(options, { questions: ['Q?'] }), tools: [], changedFiles: false }; });
  const { runtime, store, input } = await fixture(t, provider);
  const run = await runtime.create(input, randomUUID());
  await runtime.answer((await waitFor(() => runtime.attention()[0])).id, { answers: [], skip: true });
  assert.equal((await settled(store, run.id)).state, 'succeeded');
  assert.equal(provider.calls.length, 3);
});

test('interrupting stops the current attempt and redoes the step with the user correction', async t => {
  const provider = fakeProvider('codex', async (options, calls) => {
    if (options.role === 'builder' && calls.filter(call => call.role === 'builder').length === 1) await untilAborted(options.signal);
  });
  const { runtime, store, input } = await fixture(t, provider);
  const run = await runtime.create(input, randomUUID());
  await waitFor(() => provider.calls.some(call => call.role === 'builder'), 'builder');
  await runtime.note(run.id, 'Sai rồi: chỉ sửa file README', 'interrupt');
  const final = await settled(store, run.id);
  assert.equal(final.state, 'succeeded', final.error);
  const builders = provider.calls.filter(call => call.role === 'builder');
  assert.equal(builders.length, 2);
  assert.match(builders[1].prompt, /chỉ sửa file README/); assert.match(builders[1].prompt, /stopped by the user/);
  assert.equal(final.tasks[1].interruptions, 1); assert.equal(final.notes[0].delivery, 'prompt');
  assert.equal(provider.calls.filter(call => call.role === 'reviewer').length, 1);
});

test('an interrupt during a question is honoured even if the provider ignores the stop and finishes', async t => {
  const provider = fakeProvider('codex', async (options, calls) => {
    if (options.role === 'builder' && calls.filter(call => call.role === 'builder').length === 1) {
      assert.equal(await options.onQuestion([{ question: 'Q?', options: [], multiSelect: false }]), null);
      // Misbehaving provider: returns a normal result after the attempt was aborted.
    }
  });
  const { runtime, store, input } = await fixture(t, provider);
  const run = await runtime.create(input, randomUUID());
  await waitFor(() => runtime.attention()[0], 'question');
  await runtime.note(run.id, 'Bỏ qua câu hỏi, chỉ sửa README', 'interrupt');
  const final = await settled(store, run.id);
  assert.equal(final.state, 'succeeded');
  const builders = provider.calls.filter(call => call.role === 'builder');
  assert.equal(builders.length, 2, 'the stale result is discarded and the step is redone');
  assert.match(builders[1].prompt, /chỉ sửa README/);
  assert.deepEqual([final.inquiries[0].state, final.notes[0].delivery, final.tasks[1].interruptions], ['expired', 'prompt', 1]);
});

test('interrupting declines a pending approval of the stopped attempt', async t => {
  const decisions = [];
  const provider = fakeProvider('codex', async (options, calls) => {
    if (options.role === 'builder' && calls.filter(call => call.role === 'builder').length === 1) {
      decisions.push(await options.onApproval('item/commandExecution/requestApproval', 'rm -rf build'));
      throw Object.assign(new Error('aborted'), { code: 'CANCELED' });
    }
  });
  const { runtime, store, input } = await fixture(t, provider);
  const run = await runtime.create({ ...input, mode: 'workspace-write', workflowId: 'quick' }, randomUUID());
  const approval = await waitFor(() => runtime.attention().find(item => item.kind === 'approval'), 'approval');
  assert.ok(approval);
  await runtime.note(run.id, 'Không xoá build', 'interrupt');
  await waitFor(() => decisions.length, 'decision');
  assert.deepEqual(decisions, ['decline']);
  const final = await settled(store, run.id);
  assert.equal(final.approvals[0].state, 'expired');
});

test('queued notes reach the next dispatched role; steering is delivered live when the provider supports it', async t => {
  let steered = [];
  const provider = fakeProvider('claude', async (options, calls) => {
    if (calls.length === 1) {
      options.registerSteer(text => { steered.push(text); return true; });
      await waitFor(() => steered.length, 'steer');
      options.registerSteer(null);
    }
  });
  const { runtime, store, input } = await fixture(t, provider);
  const run = await runtime.create({ ...input, provider: 'claude' }, randomUUID());
  await waitFor(() => provider.calls.length === 1, 'first call');
  // Queue first, while the first role is still blocked waiting for the live message.
  await waitFor(async () => { try { return await runtime.note(run.id, 'Viết tóm tắt bằng tiếng Việt', 'queued'); } catch { return null; } }, 'queued note');
  const live = await waitFor(async () => { try { return await runtime.note(run.id, 'Ưu tiên bảo mật', 'steer'); } catch { return null; } }, 'note');
  assert.equal(live.notes[1].delivery, 'live');
  const final = await settled(store, run.id);
  assert.deepEqual(steered, ['Ưu tiên bảo mật']);
  assert.match(provider.calls[1].prompt, /Viết tóm tắt bằng tiếng Việt/);
  assert.doesNotMatch(provider.calls[2].prompt, /Viết tóm tắt bằng tiếng Việt/, 'a note is delivered once');
  assert.deepEqual(final.notes.map(note => note.delivery), ['prompt', 'live']);
  await assert.rejects(runtime.note(run.id, 'late', 'steer'), { code: 'RUN_NOT_ACTIVE' });
});

test('interrupt limit protects against endless redo loops', async t => {
  const provider = fakeProvider('codex', async options => { if (options.role === 'builder') await untilAborted(options.signal); });
  const { runtime, store, input } = await fixture(t, provider);
  const run = await runtime.create(input, randomUUID());
  for (let i = 0; i < MAX_INTERRUPTIONS; i++) {
    const count = provider.calls.filter(call => call.role === 'builder').length;
    await waitFor(() => provider.calls.filter(call => call.role === 'builder').length > count || (i === 0 && count), 'builder attempt');
    await runtime.note(run.id, 'redo ' + i, 'interrupt');
  }
  await waitFor(async () => (await store.get(run.id)).tasks[1].interruptions === MAX_INTERRUPTIONS, 'interruptions');
  await assert.rejects(runtime.note(run.id, 'again', 'interrupt'), { code: 'INTERRUPT_LIMIT' });
  await runtime.cancel(run.id);
  assert.equal((await settled(store, run.id)).state, 'canceled');
});

test('each run uses the provider it was assigned, with separate pacing state', async t => {
  const codex = fakeProvider('codex'), claude = fakeProvider('claude');
  const { runtime, store, input } = await fixture(t, { codex, claude });
  const run = await runtime.create({ ...input, provider: 'claude', workflowId: 'solo' }, randomUUID());
  const final = await settled(store, run.id);
  assert.equal(final.state, 'succeeded'); assert.equal(final.provider, 'claude');
  assert.deepEqual([codex.calls.length, claude.calls.length], [0, 1]);
  assert.equal(final.tasks[0].provider, 'claude');
  await runtime.governorFor('claude').limited();
  assert.equal((await store.scheduling('claude')).rateLimitStreak, 1);
  assert.equal((await store.scheduling('codex'))?.rateLimitStreak ?? 0, 0);
  const solo = await fixture(t, codex);
  await assert.rejects(solo.runtime.create({ ...solo.input, provider: 'claude' }, randomUUID()), { code: 'PROVIDER_UNAVAILABLE' });
});

test('provider events update the observable activity and checklist for the debug view', async t => {
  const provider = fakeProvider('codex', async options => {
    if (options.role !== 'builder') return;
    await options.onEvent('agent.todos', { todos: [{ text: 'Đọc', status: 'in_progress' }] });
    await options.onEvent('tool.started', { kind: 'commandExecution', command: 'npm test' });
  });
  const { runtime, store, input } = await fixture(t, provider);
  const run = await runtime.create(input, randomUUID());
  await settled(store, run.id);
  const events = await store.events(run.id, 0, 200);
  const started = events.find(event => event.type === 'tool.started');
  assert.ok(started && started.taskId);
  const builder = (await store.get(run.id)).tasks[1];
  assert.deepEqual(builder.todos, [{ text: 'Đọc', status: 'in_progress' }]);
  assert.equal(builder.activity, undefined, 'activity clears when the role completes');
});

test('HTTP: attention, notes and answers require CSRF and expose only the active run', async t => {
  const provider = fakeProvider('codex', async options => { if (options.role === 'builder') await options.onQuestion([{ question: 'Q?', options: [], multiSelect: false }]); });
  const base = await mkdtemp(join(tmpdir(), 'office-http-'));
  const root = join(base, 'app'), workspace = join(base, 'workspace');
  await Promise.all([mkdir(root), mkdir(workspace)]);
  const store = await Store.open(join(root, 'office.db'));
  const { app, runtime } = await createApp({ scheduling: fastScheduling, root, store, providers: { codex: provider } });
  t.after(async () => { await app.close(); await rm(base, { recursive: true, force: true }); });
  const headers = { host: '127.0.0.1:4310', 'x-office-client': 'browser' };
  const bootstrap = await app.inject({ url: '/api/session', headers });
  const auth = { ...headers, cookie: bootstrap.headers['set-cookie'].split(';')[0], 'x-csrf-token': bootstrap.json().data.csrfToken };
  const providers = (await app.inject({ url: '/api/providers', headers: auth })).json().data;
  assert.deepEqual(providers.map(item => item.id), ['codex']);
  const run = await runtime.create({ goal: 'Inspect this workspace', workspace, mode: 'read-only' }, randomUUID());
  const item = await waitFor(async () => (await app.inject({ url: '/api/attention', headers: auth })).json().data[0], 'attention');
  assert.equal((await app.inject({ method: 'POST', url: `/api/inquiries/${item.id}/answers`, headers: { ...headers, cookie: auth.cookie }, payload: { answers: ['x'] } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: `/api/runs/${run.id}/notes`, headers: auth, payload: { text: 'Chú ý', mode: 'queued' } })).statusCode, 201);
  assert.equal((await app.inject({ method: 'POST', url: `/api/runs/${run.id}/notes`, headers: auth, payload: { text: 'x', mode: 'rm -rf' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: `/api/inquiries/${item.id}/answers`, headers: auth, payload: { answers: ['Trả lời'] } })).statusCode, 200);
  assert.equal((await settled(store, run.id)).state, 'succeeded');
  assert.equal((await app.inject({ url: '/api/scheduling?provider=claude', headers: auth })).json().data.provider, 'claude');
});

test('quick-assign suggestion picks a template locally from Vietnamese or English keywords', () => {
  assert.equal(suggestWorkflow('Sửa bug đăng nhập và viết test cho API'), 'software');
  assert.equal(suggestWorkflow('Lên chiến dịch quảng cáo Tết cho fanpage'), 'marketing');
  assert.equal(suggestWorkflow('Kiểm toán chứng từ quý 3'), 'audit');
  assert.equal(suggestWorkflow('Sửa chính tả nhỏ trong README'), 'solo');
  assert.equal(suggestWorkflow('Thiết kế giao diện trang chủ'), 'design');
  assert.equal(suggestWorkflow('xin chào'), 'quick');
  assert.equal(suggestWorkflow(''), 'software');
});
