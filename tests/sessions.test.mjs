const fastScheduling = { minGapMs: 0, maxRetries: 0, baseBackoffMs: 1, jitterRatio: 0 };
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../dist/server/store.js';
import { Runtime } from '../dist/server/runtime.js';
import { ProjectSessions } from '../dist/server/project-sessions.js';
import { FolderBrowser } from '../dist/server/folders.js';
import { createApp } from '../dist/server/app.js';
import { createProjectSessionSchema, createRunSchema, terminalStates } from '../dist/shared/contracts.js';

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'office-session-test-'));
  const root = join(base, 'office'), workspace = join(base, 'alpha'), other = join(base, 'beta');
  await Promise.all([mkdir(root), mkdir(workspace), mkdir(other)]);
  const store = await Store.open(join(root, 'db.sqlite'));
  const provider = { calls: 0, async status() { return { id: 'codex', state: 'ready', billingMode: 'chatgpt', plan: 'plus', models: [], limits: null, message: 'ready' }; }, async execute(options) {
    this.calls++;
    return { text: JSON.stringify(options.role === 'orchestrator' ? { summary: 'plan', steps: ['Read'] } : options.role === 'builder' ? { summary: 'read', blocked: false, files: [], tests: [] } : { approved: true, summary: 'reviewed', findings: [] }), tools: [], changedFiles: false };
  } };
  const runtime = new Runtime(store, provider, { appRoot: root, scheduling: fastScheduling });
  const sessions = new ProjectSessions(store, root);
  t.after(async () => { await runtime.close(); await store.close(); await rm(base, { recursive: true, force: true }); });
  return { base, root, workspace, other, store, runtime, sessions, provider };
}
async function finished(store, id) {
  for (let i = 0; i < 200; i++) {
    const run = await store.get(id); if (run && terminalStates.has(run.state)) return run;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Run did not finish');
}
test('session boundary validates name, workspace and run session ID', () => {
  assert.equal(createProjectSessionSchema.parse({ name: '  My project  ', workspace: 'E:/Projects/demo' }).name, 'My project');
  for (const input of [{ name: ' ', workspace: 'E:/Projects/demo' }, { name: 'x'.repeat(81), workspace: 'E:/Projects/demo' }, { name: 'Demo', workspace: 'E:/x', admin: true }]) assert.equal(createProjectSessionSchema.safeParse(input).success, false);
  assert.equal(createRunSchema.safeParse({ goal: 'Inspect', workspace: 'E:/Projects/demo', sessionId: 'bad' }).success, false);
});
test('create session is persisted and idempotent without any model call', async t => {
  const { sessions, store, workspace, provider } = await fixture(t);
  const key = randomUUID(), input = { name: 'Alpha project', workspace };
  const [first, second] = await Promise.all([sessions.create(input, key), sessions.create(input, key)]);
  assert.equal(first.id, second.id);
  assert.equal(first.workspace, await realpath(workspace));
  assert.deepEqual(await store.getSession(first.id), first);
  assert.equal((await store.sessions(10)).length, 1);
  await assert.rejects(sessions.create({ ...input, name: 'Changed' }, key), { code: 'IDEMPOTENCY_CONFLICT' });
  assert.equal(provider.calls, 0);
});
test('session-scoped runs cannot switch workspace and history filters correctly', async t => {
  const { sessions, runtime, store, workspace, other, provider } = await fixture(t);
  const a = await sessions.create({ name: 'A', workspace }, randomUUID());
  const b = await sessions.create({ name: 'B', workspace: other }, randomUUID());
  const input = { goal: 'Read the project', workspace, mode: 'read-only' };
  await assert.rejects(runtime.create({ ...input, sessionId: randomUUID() }, randomUUID()), { code: 'PROJECT_SESSION_NOT_FOUND' });
  await assert.rejects(runtime.create({ ...input, sessionId: b.id }, randomUUID()), { code: 'SESSION_WORKSPACE_MISMATCH' });
  assert.equal(provider.calls, 0);
  const first = await runtime.create({ ...input, sessionId: a.id }, randomUUID()); await finished(store, first.id);
  const second = await runtime.create({ ...input, workspace: other, sessionId: b.id }, randomUUID()); await finished(store, second.id);
  const legacy = await runtime.create(input, randomUUID()); await finished(store, legacy.id);
  const filtered = await store.list(10, undefined, a.id);
  assert.equal(filtered.length, 1); assert.equal(filtered[0].id, first.id); assert.equal(filtered[0].sessionName, 'A');
  assert.equal((await store.list(10)).length, 3);
  assert.equal((await store.get(legacy.id)).sessionId, undefined);
});
test('session pagination yields distinct entries and survives reopening database', async t => {
  const { sessions, store, workspace, root } = await fixture(t);
  for (const name of ['One', 'Two', 'Three']) await sessions.create({ name, workspace }, randomUUID());
  const first = await store.sessions(2), next = await store.sessions(2, first.at(-1).id);
  assert.equal(new Set([...first, ...next].map(item => item.id)).size, 3);
  const reopened = await Store.open(join(root, 'db.sqlite'));
  try { assert.equal((await reopened.sessions(10)).length, 3); }
  finally { await reopened.close(); }
});
test('additive v1 migration preserves legacy run and existing data', async t => {
  const base = await mkdtemp(join(tmpdir(), 'office-migration-test-'));
  const dbPath = join(base, 'old.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE runs(id TEXT PRIMARY KEY, created_at TEXT NOT NULL,state TEXT NOT NULL,version INTEGER NOT NULL,body TEXT NOT NULL,request_key TEXT UNIQUE,request_hash TEXT); PRAGMA user_version=1');
  const legacy = { id: randomUUID(), goal: 'Old data', state: 'succeeded', version: 7 };
  db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?)').run(legacy.id, '2026-10-20T00:00:00Z', legacy.state, legacy.version, JSON.stringify(legacy), randomUUID(), 'hash'); db.close();
  const store = await Store.open(dbPath);
  try {
    assert.deepEqual(await store.get(legacy.id), legacy);
    const check = new DatabaseSync(dbPath, { readOnly: true });
    try { assert.equal(check.prepare('PRAGMA user_version').get().user_version, 3); assert.ok(check.prepare('PRAGMA table_info(runs)').all().some(column => column.name === 'session_id')); }
    finally { check.close(); }
  } finally { await store.close(); await rm(base, { recursive: true, force: true }); }
  t.assert.ok(true);
});
test('folder tree lists directories only, one level at a time, with bounded pages', async t => {
  const { base, root, workspace } = await fixture(t);
  await mkdir(join(base, '.hidden')); await mkdir(join(base, 'node_modules'));
  await mkdir(join(workspace, 'nested')); await writeFile(join(base, 'private.txt'), 'not returned');
  const browser = new FolderBrowser(root);
  const first = await browser.list(undefined, 0, 1);
  assert.equal(first.entries.length, 1); assert.ok(first.nextCursor);
  const second = await browser.list(undefined, Number(first.nextCursor), 1);
  const names = [...first.entries, ...second.entries].map(entry => entry.name).sort();
  assert.deepEqual(names, ['alpha', 'beta']);
  const child = await browser.list(workspace);
  assert.deepEqual(child.entries.map(entry => entry.name), ['nested']);
  assert.ok(child.entries[0].selectable);
});
test('folder browser blocks path traversal, source tree and junction escapes', async t => {
  const { base, root, workspace } = await fixture(t);
  const browser = new FolderBrowser(root);
  await assert.rejects(browser.list(dirname(base)), { code: 'FOLDER_SCOPE' });
  await assert.rejects(browser.list(root), { code: 'FOLDER_SCOPE' });
  const link = join(base, 'alias');
  await symlink(workspace, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await browser.list()).entries.some(entry => entry.name === 'alias'), false);
  await assert.rejects(browser.list(link), { code: 'FOLDER_LINK' });
  const restricted = new FolderBrowser(root, workspace);
  await assert.rejects(restricted.list(base), { code: 'FOLDER_SCOPE' });
});
test('new APIs require session/CSRF and return validated session/filter/folder data', async t => {
  const { root, store, provider, workspace } = await fixture(t);
  const { app } = await createApp({ scheduling: fastScheduling, root, store, provider });
  // This app owns store close; fixture Store.close is safe to call after termination.
  t.after(() => app.close());
  const headers = { host: '127.0.0.1:4310', 'x-office-client': 'browser' };
  assert.equal((await app.inject({ url: '/api/workspace-folders', headers })).statusCode, 401);
  const bootstrap = await app.inject({ url: '/api/session', headers });
  const auth = { ...headers, cookie: bootstrap.headers['set-cookie'].split(';')[0], 'x-csrf-token': bootstrap.json().data.csrfToken };
  const payload = { name: 'From API', workspace };
  assert.equal((await app.inject({ method: 'POST', url: '/api/project-sessions', headers: { ...headers, cookie: auth.cookie }, payload })).statusCode, 403);
  const created = await app.inject({ method: 'POST', url: '/api/project-sessions', headers: { ...auth, 'idempotency-key': randomUUID() }, payload });
  assert.equal(created.statusCode, 201);
  const id = created.json().data.id;
  assert.equal((await app.inject({ url: '/api/project-sessions', headers: auth })).json().data[0].id, id);
  assert.equal((await app.inject({ url: `/api/runs?sessionId=${id}`, headers: auth })).json().data.length, 0);
  assert.equal((await app.inject({ url: '/api/runs?sessionId=invalid', headers: auth })).statusCode, 400);
  assert.equal((await app.inject({ url: '/api/workspace-folders?limit=101', headers: auth })).statusCode, 400);
  assert.equal((await app.inject({ url: '/api/workspace-folders', headers: auth })).statusCode, 200);
  assert.equal(provider.calls, 0);
});
