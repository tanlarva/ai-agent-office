const fastScheduling = { minGapMs: 0, maxRetries: 0, baseBackoffMs: 1, jitterRatio: 0 };
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../dist/server/store.js';
import { Runtime } from '../dist/server/runtime.js';
import { ProjectSessions } from '../dist/server/project-sessions.js';
import { createRunSchema, createProjectSessionSchema, terminalStates } from '../dist/shared/contracts.js';
import { getWorkflow, workflows } from '../dist/shared/workflows.js';

async function fixture(t, action) {
  const base = await mkdtemp(join(tmpdir(), 'office-workflows-'));
  const root = join(base, 'app'), workspace = join(base, 'workspace');
  await Promise.all([mkdir(root), mkdir(workspace)]);
  const store = await Store.open(join(root, 'office.db'));
  const calls = [];
  const provider = {
    async status() { return { state: 'ready', models: [], limits: null }; },
    async execute(options) {
      calls.push(options);
      const override = await action?.(options, calls);
      if (override) return override;
      const properties = options.schema.properties;
      const checks = [{ command: 'node --test', passed: true, evidence: 'observed exit 0' }];
      const output = properties.steps ? { summary: 'Plan with acceptance criteria', steps: ['Verify ORIGINAL-ACCEPTANCE'] }
        : properties.blocked ? { summary: 'Work evidence', blocked: false, files: [], tests: options.writable ? checks : [] }
        : { summary: 'Verified independently', approved: true, findings: [], ...(properties.tests ? { tests: checks } : {}) };
      return { text: JSON.stringify(output), tools: [{ command: 'node --test', exitCode: 0 }], changedFiles: false };
    },
  };
  const runtime = new Runtime(store, provider, { appRoot: root, scheduling: fastScheduling });
  const sessions = new ProjectSessions(store, root);
  t.after(async () => { await runtime.close(); await store.close(); await rm(base, { recursive: true, force: true }); });
  return { runtime, store, sessions, calls, input: { goal: 'ORIGINAL-ACCEPTANCE: produce the requested result', workspace, mode: 'read-only' } };
}
async function finished(store, id) {
  for (let i = 0; i < 300; i++) {
    const run = await store.get(id);
    if (terminalStates.has(run.state)) return run;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Run did not settle');
}

test('workflow boundary rejects unknown templates and client-supplied roles/permissions', () => {
  const input = { goal: 'Inspect', workspace: 'E:/Projects/sample' };
  for (const payload of [{ ...input, workflowId: 'root-admin' }, { ...input, workflow: getWorkflow('software') }, { ...input, roles: ['developer'] }]) assert.equal(createRunSchema.safeParse(payload).success, false);
  assert.equal(createProjectSessionSchema.safeParse({ name: 'Project', workspace: input.workspace, workflowId: 'unknown' }).success, false);
  assert.throws(() => getWorkflow('unknown'));
});

for (const workflow of workflows) test(`${workflow.id}: dispatches actual ordered roles with a persisted workflow snapshot`, async t => {
  const { runtime, store, calls, input } = await fixture(t);
  const run = await runtime.create({ ...input, workflowId: workflow.id }, randomUUID());
  const result = await finished(store, run.id);
  assert.equal(result.state, 'succeeded', result.error);
  assert.deepEqual(calls.map(call => call.role), workflow.steps.map(step => step.role));
  assert.equal(calls.every(call => call.writable === false), true);
  assert.equal(calls.every(call => call.prompt.includes('ORIGINAL-ACCEPTANCE')), true);
  assert.deepEqual(result.workflow, getWorkflow(workflow.id));
  run.workflow.steps[0].name = 'Client mutation';
  const first = workflow.steps[0].name;
  assert.equal((await store.get(run.id)).workflow.steps[0].name, first);
  assert.equal(getWorkflow(workflow.id).steps[0].name, first);
});

test('multi-role workflows start with the Orchestrator; only the solo template uses one self-checking agent', () => {
  for (const workflow of workflows.filter(item => item.steps.length > 1)) assert.equal(workflow.steps[0].role, 'orchestrator', workflow.id);
  const solo = getWorkflow('solo');
  assert.equal(solo.steps.length, 1);
  assert.deepEqual([solo.steps[0].kind, solo.steps[0].writable], ['work', true]);
});

test('project workflow defaults persist; per-run override preserves session and legacy fallback', async t => {
  const { runtime, sessions, store, input } = await fixture(t);
  const session = await sessions.create({ name: 'Campaign', workspace: input.workspace, workflowId: 'marketing' }, randomUUID());
  const inherited = await runtime.create({ ...input, sessionId: session.id }, randomUUID());
  assert.equal((await finished(store, inherited.id)).workflow.id, 'marketing');
  const override = await runtime.create({ ...input, sessionId: session.id, workflowId: 'business' }, randomUUID());
  assert.equal((await finished(store, override.id)).workflow.id, 'business');
  assert.equal((await store.getSession(session.id)).workflowId, 'marketing');
  const legacy = await runtime.create(input, randomUUID());
  assert.equal((await finished(store, legacy.id)).workflow.id, 'quick');
});

test('software separates Developer and QA context; only Developer may write or request approval', async t => {
  const { runtime, store, calls, input } = await fixture(t, async options => {
    if (options.role !== 'developer') assert.equal(await options.onApproval('item/fileChange/requestApproval', 'write'), 'decline');
  });
  const run = await runtime.create({ ...input, workflowId: 'software', mode: 'workspace-write' }, randomUUID());
  const result = await finished(store, run.id);
  assert.equal(result.state, 'succeeded', result.error);
  assert.deepEqual(calls.filter(call => call.writable).map(call => call.role), ['developer']);
  const qa = calls.find(call => call.role === 'qa');
  assert.match(qa.prompt, /ORIGINAL goal/);
  assert.match(qa.prompt, /Work evidence/);
  assert.equal(qa.schema.properties.approved.type, 'boolean');
  assert.equal(qa.writable, false);
  assert.match(result.tasks.find(task => task.role === 'qa').summary, /node --test/);
});

test('QA cannot pass a writable run without independently observed test evidence', async t => {
  const { runtime, store, calls, input } = await fixture(t, async options => options.role === 'qa' ? { text: JSON.stringify({ summary: 'Claimed success', approved: true, findings: [], tests: [{ command: 'node --test', passed: true, evidence: 'claim' }] }), tools: [], changedFiles: false } : undefined);
  const run = await runtime.create({ ...input, workflowId: 'software', mode: 'workspace-write' }, randomUUID());
  const result = await finished(store, run.id);
  assert.equal(result.state, 'failed');
  assert.match(result.error, /command/);
  assert.equal(calls.some(call => call.role === 'reviewer'), false);
});

test('QA rejected acceptance scenarios stop handoff to Reviewer', async t => {
  const { runtime, store, calls, input } = await fixture(t, async options => options.role === 'qa' ? { text: JSON.stringify({ summary: 'Acceptance gap', approved: false, findings: ['Missing negative case'], tests: [] }), tools: [], changedFiles: false } : undefined);
  const run = await runtime.create({ ...input, workflowId: 'software' }, randomUUID());
  const result = await finished(store, run.id);
  assert.equal(result.state, 'failed'); assert.match(result.error, /Missing negative case/);
  assert.equal(calls.at(-1).role, 'qa');
});

test('non-code workflows permit only artifact author to write and still require observed checks', async t => {
  const { runtime, store, calls, input } = await fixture(t);
  const run = await runtime.create({ ...input, workflowId: 'marketing', mode: 'workspace-write' }, randomUUID());
  assert.equal((await finished(store, run.id)).state, 'succeeded');
  assert.deepEqual(calls.filter(call => call.writable).map(call => call.role), ['copywriter']);
  assert.match(calls.find(call => call.role === 'editor').prompt, /unsupported claims/);
});

test('audit preserves separation of duties and persists the project default', async t => {
  const { runtime, sessions, store, calls, input } = await fixture(t, async options => {
    if (options.role !== 'audit-reporter') assert.equal(await options.onApproval('item/fileChange/requestApproval', 'modify evidence'), 'decline');
  });
  const session = await sessions.create({ name: 'Audit working papers', workspace: input.workspace, workflowId: 'audit' }, randomUUID());
  const body = createRunSchema.parse({ ...input, sessionId: session.id, mode: 'workspace-write' });
  const run = await runtime.create(body, randomUUID());
  const result = await finished(store, run.id);
  assert.equal(result.state, 'succeeded', result.error);
  assert.equal(result.workflow.id, 'audit');
  assert.deepEqual(calls.map(call => call.role), ['orchestrator', 'audit-risk', 'audit-evidence', 'audit-reporter', 'audit-reviewer']);
  assert.deepEqual(calls.filter(call => call.writable).map(call => call.role), ['audit-reporter']);
  assert.equal((await store.getSession(session.id)).workflowId, 'audit');
});

test('documented audit exceptions can be delivered without treating them as report defects', async t => {
  const { runtime, store, calls, input } = await fixture(t, async options => options.role === 'audit-evidence' ? { text: JSON.stringify({ summary: 'Observed exception: invoice missing; reference records.csv row 3; coverage limited.', blocked: false, files: [], tests: [] }), tools: [], changedFiles: false } : undefined);
  const run = await runtime.create({ ...input, workflowId: 'audit' }, randomUUID());
  assert.equal((await finished(store, run.id)).state, 'succeeded');
  const review = calls.find(call => call.role === 'audit-reviewer');
  assert.match(review.prompt, /invoice missing/);
  assert.match(review.prompt, /report quality only/);
  assert.match(review.prompt, /do not themselves block completion/);
});

test('independent audit review rejects unsupported conclusions in the report', async t => {
  const { runtime, store, input } = await fixture(t, async options => options.role === 'audit-reviewer' ? { text: JSON.stringify({ summary: 'Unsupported conclusion', approved: false, findings: ['Report claim has no source record'] }), tools: [], changedFiles: false } : undefined);
  const run = await runtime.create({ ...input, workflowId: 'audit' }, randomUUID());
  const result = await finished(store, run.id);
  assert.equal(result.state, 'failed');
  assert.match(result.error, /no source record/);
});

test('canceling during a later workflow role stops all following roles', async t => {
  let qaStarted;
  const started = new Promise(resolve => { qaStarted = resolve; });
  const { runtime, store, calls, input } = await fixture(t, async options => {
    if (options.role === 'qa') {
      qaStarted();
      await new Promise(resolve => options.signal.addEventListener('abort', resolve, { once: true }));
      throw new Error('aborted');
    }
  });
  const run = await runtime.create({ ...input, workflowId: 'software' }, randomUUID());
  await started; await runtime.cancel(run.id);
  assert.equal((await finished(store, run.id)).state, 'canceled');
  assert.equal(calls.at(-1).role, 'qa');
});
