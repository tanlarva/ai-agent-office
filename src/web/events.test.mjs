import assert from 'node:assert/strict';
import test from 'node:test';
import { api, mergeEvents, request } from './api.ts';

function event(sequence, eventId = String(sequence)) {
  return { schemaVersion: 1, eventId, sequence, runId: 'run-1', taskId: null, occurredAt: '2026-10-20T00:00:00Z', type: 'task.updated', payload: {} };
}

test('replayed events replace duplicates and preserve sequence order', () => {
  const existing = [event(3), event(1)];
  const replay = [event(2), event(3, 'replayed-3')];
  const result = mergeEvents(existing, replay);
  assert.deepEqual(result.map(item => item.sequence), [1, 2, 3]);
  assert.equal(result.at(-1)?.eventId, 'replayed-3');
  assert.equal(existing.length, 2);
  assert.equal(existing[0]?.eventId, '3');
});

test('event buffer retains only the latest 200 unique events', () => {
  const result = mergeEvents(Array.from({ length: 200 }, (_, index) => event(index + 1)), [event(201), event(202), event(202)]);
  assert.equal(result.length, 200);
  assert.equal(result[0]?.sequence, 3);
  assert.equal(result.at(-1)?.sequence, 202);
});

test('empty replay leaves an empty buffer and does not invent events', () => {
  assert.deepEqual(mergeEvents([], []), []);
});

test('mutations carry session protection and a stable idempotency key', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return Response.json({ data: path === '/api/session' ? { csrfToken: 'test-csrf' } : { id: 'run-1' }, meta: { traceId: 'test' } });
  };
  try {
    await api.session();
    await api.create({ goal: 'Analyze the project', workspace: 'E:\\Projects\\test', mode: 'read-only' }, 'idempotency-1');
    assert.equal(calls[1].options.credentials, 'same-origin');
    assert.equal(calls[1].options.headers['X-Office-Client'], 'browser');
    assert.equal(calls[1].options.headers['X-CSRF-Token'], 'test-csrf');
    assert.equal(calls[1].options.headers['Idempotency-Key'], 'idempotency-1');
    assert.equal(JSON.parse(calls[1].options.body).mode, 'read-only');
  } finally { globalThis.fetch = originalFetch; }
});

test('API errors preserve the server message and forward cancellation', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async (_path, options) => {
    assert.equal(options.signal, controller.signal);
    return Response.json({ error: { code: 'SESSION_REQUIRED', message: 'Phiên local đã hết hạn.' } }, { status: 401 });
  };
  try { await assert.rejects(request('/api/runs', { signal: controller.signal }), { message: 'Phiên local đã hết hạn.' }); }
  finally { globalThis.fetch = originalFetch; }
});
test('project session requests keep workspace and idempotency; history filter is encoded', async () => {
  const originalFetch = globalThis.fetch, calls = [];
  globalThis.fetch = async (path, options) => { calls.push({ path, options }); return Response.json({ data: {}, meta: { traceId: 'test' } }); };
  try {
    await api.createProjectSession({ name: 'My project', workspace: 'E:\\Projects\\demo' }, 'project-key');
    await api.runs(undefined, 'project-id');
    await api.folders('E:\\Projects\\space folder', '50');
    assert.equal(calls[0].options.headers['Idempotency-Key'], 'project-key');
    assert.equal(JSON.parse(calls[0].options.body).name, 'My project');
    assert.equal(calls[1].path, '/api/runs?limit=30&sessionId=project-id');
    assert.equal(new URL(calls[2].path, 'http://local').searchParams.get('path'), 'E:\\Projects\\space folder');
  } finally { globalThis.fetch = originalFetch; }
});
