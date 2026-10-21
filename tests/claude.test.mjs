import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ClaudeProvider, accountState, claudeEnvironment, claudeTurnError, describeTool, questionsFrom, todosFrom } from '../dist/server/claude.js';
import { RpcClient, providerEnvironment } from '../dist/server/rpc.js';

const fake = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));
function provider(scenario, extra = {}) {
  const spawned = [];
  const instance = new ClaudeProvider(process.cwd(), { spawn: async (args, cwd) => {
    spawned.push(args);
    return new RpcClient(process.execPath, [fake, ...args], cwd, { label: 'Claude Code', env: { ...providerEnvironment(), FAKE_CLAUDE_SCENARIO: scenario, ...extra } });
  } });
  return { instance, spawned };
}
function execution(overrides = {}) {
  const events = [];
  return { events, options: {
    cwd: process.cwd(), role: 'developer', prompt: 'Sửa lỗi đăng nhập', writable: true, schema: { type: 'object' }, signal: new AbortController().signal,
    onEvent: async (type, payload) => { events.push({ type, payload }); },
    onApproval: async () => 'decline', ...overrides,
  } };
}

test('credential environment never forwards API keys to the Claude CLI', () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-should-not-leak';
  try {
    const env = claudeEnvironment();
    assert.equal(env.ANTHROPIC_API_KEY, undefined);
    assert.equal(Object.keys(env).some(key => /KEY|TOKEN|SECRET/i.test(key)), false);
  } finally { delete process.env.ANTHROPIC_API_KEY; }
});

test('account handshake accepts only a claude.ai subscription', () => {
  assert.equal(accountState({ subscriptionType: 'max', tokenSource: 'claude.ai', apiProvider: 'firstParty' }).state, 'ready');
  assert.equal(accountState({ tokenSource: 'none', apiProvider: 'firstParty' }).state, 'signed_out');
  assert.equal(accountState({ subscriptionType: 'pro', tokenSource: 'claude.ai', apiKeySource: 'ANTHROPIC_API_KEY' }).state, 'billing_mismatch');
  assert.equal(accountState({ subscriptionType: 'pro', tokenSource: 'x', apiProvider: 'bedrock' }).state, 'billing_mismatch');
});

test('status reads account and model catalog through initialize, without a model turn', async () => {
  const { instance, spawned } = provider('basic');
  const status = await instance.status();
  assert.equal(status.state, 'ready'); assert.equal(status.billingMode, 'claude_subscription'); assert.equal(status.plan, 'pro');
  assert.deepEqual(status.models.map(model => [model.id, model.isDefault]), [['default', true], ['sonnet', false]]);
  assert.equal(status.version, '9.9.9-fake');
  assert.deepEqual(status.interaction, { questions: 'live', steer: true });
  const signedOut = await provider('basic', { FAKE_CLAUDE_ACCOUNT: '{"tokenSource":"none"}' }).instance.status();
  assert.equal(signedOut.state, 'signed_out');
  assert.equal(spawned[0].includes('--setting-sources='), true, 'project hooks/settings are not loaded');
});

test('turn streams todos, tools, exit codes, edits, usage and structured output', async () => {
  const { instance, spawned } = provider('basic');
  const { options, events } = execution();
  const result = await instance.execute(options);
  assert.deepEqual(JSON.parse(result.text), { summary: 'ok', blocked: false, files: [], tests: [], questions: [] });
  assert.deepEqual(result.tools, [{ command: 'npm test', exitCode: 0 }, { command: 'npm run lint', exitCode: 2 }]);
  assert.equal(result.changedFiles, true);
  const types = events.map(event => event.type);
  for (const type of ['agent.assigned', 'agent.todos', 'tool.started', 'tool.completed', 'artifact.created', 'usage.updated']) assert.ok(types.includes(type), type);
  assert.deepEqual(events.find(event => event.type === 'agent.todos').payload.todos.map(todo => todo.status), ['completed', 'in_progress']);
  assert.deepEqual(events.find(event => event.type === 'usage.updated').payload, { inputTokens: 10, outputTokens: 5 });
  const args = spawned[0];
  assert.equal(args[args.indexOf('--permission-mode') + 1], 'acceptEdits');
  assert.ok(args[args.indexOf('--tools') + 1].includes('Edit'));
  assert.ok(!args[args.indexOf('--tools') + 1].includes('WebFetch'));
});

test('read-only turns get no edit tools and run in manual permission mode', async () => {
  const { instance, spawned } = provider('basic');
  await instance.execute(execution({ writable: false }).options);
  const args = spawned[0], tools = args[args.indexOf('--tools') + 1];
  assert.equal(args[args.indexOf('--permission-mode') + 1], 'manual');
  assert.deepEqual(tools.split(',').filter(name => ['Edit', 'Write', 'NotebookEdit'].includes(name)), []);
});

test('AskUserQuestion is answered with the user choice, or declined when the user lets the agent decide', async () => {
  let asked;
  const answered = await provider('ask').instance.execute(execution({ onQuestion: async questions => { asked = questions; return { answers: ['SQLite'] }; } }).options);
  assert.equal(asked[0].question, 'Dùng database nào?'); assert.deepEqual(asked[0].options.map(item => item.label), ['SQLite', 'Postgres']);
  const response = JSON.parse(JSON.parse(answered.text).summary);
  assert.equal(response.behavior, 'allow'); assert.deepEqual(response.updatedInput.answers, { 'Dùng database nào?': 'SQLite' });
  const skipped = await provider('ask').instance.execute(execution({ onQuestion: async () => null }).options);
  assert.equal(JSON.parse(JSON.parse(skipped.text).summary).behavior, 'deny');
});

test('shell permission prompts go to the user only for writable or verification steps', async () => {
  const seen = [];
  const allowed = await provider('approval').instance.execute(execution({ onApproval: async (method, description) => { seen.push([method, description]); return 'accept'; } }).options);
  assert.equal(JSON.parse(JSON.parse(allowed.text).summary).behavior, 'allow');
  assert.equal(seen[0][0], 'claude/Bash'); assert.match(seen[0][1], /npm install left-pad/);
  const readOnly = await provider('approval').instance.execute(execution({ writable: false, onApproval: async () => { throw new Error('must not ask'); } }).options);
  assert.equal(JSON.parse(JSON.parse(readOnly.text).summary).behavior, 'deny');
});

test('live steering reaches the running turn and the adapter waits for it to be consumed', async () => {
  let send;
  const pending = provider('steer').instance.execute(execution({ registerSteer: fn => { if (fn) send = fn; } }).options);
  for (let i = 0; i < 200 && !send; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(send('Đừng sửa file cấu hình'), true);
  const result = await pending;
  assert.match(JSON.parse(result.text).summary, /Đừng sửa file cấu hình/);
});

test('API-key billing, subscription limit and cancellation fail closed', async () => {
  await assert.rejects(provider('apikey').instance.execute(execution().options), { code: 'BILLING_MODE' });
  await assert.rejects(provider('ratelimit').instance.execute(execution().options), { code: 'PROVIDER_LIMIT' });
  const controller = new AbortController();
  const hanging = provider('hang').instance.execute(execution({ signal: controller.signal }).options);
  setTimeout(() => controller.abort(), 150);
  await assert.rejects(hanging, { code: 'CANCELED' });
});

test('helpers describe tools and bound untrusted provider content', () => {
  assert.equal(describeTool('Bash', { command: 'npm test' }).command, 'npm test');
  assert.match(describeTool('Edit', { file_path: 'a.ts', old_string: 'x', new_string: 'y' }).detail, /- x\n\+ y/);
  assert.equal(todosFrom({ todos: Array.from({ length: 30 }, (_, i) => ({ content: 'step ' + i, status: 'pending' })) }).length, 20);
  assert.equal(questionsFrom({ questions: [{ question: 'Q?', options: [{ label: 'A' }, { nope: 1 }] }, { bad: true }] })[0].options.length, 1);
  assert.equal(claudeTurnError({ errors: ['429 Too Many Requests'] }, { rejected: null, retryError: '' }).code, 'PROVIDER_RATE_LIMIT');
  assert.equal(claudeTurnError({}, { rejected: null, retryError: 'authentication_failed' }).code, 'PROVIDER_NOT_READY');
});
