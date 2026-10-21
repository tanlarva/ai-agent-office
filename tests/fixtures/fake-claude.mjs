// Minimal stand-in for `claude -p --input-format stream-json --output-format stream-json`.
// It speaks the documented message shapes so adapter tests never spend model usage.
import { createInterface } from 'node:readline';

const scenario = process.env.FAKE_CLAUDE_SCENARIO ?? 'basic';
const account = JSON.parse(process.env.FAKE_CLAUDE_ACCOUNT ?? '{"subscriptionType":"pro","tokenSource":"claude.ai","apiProvider":"firstParty"}');
const output = JSON.parse(process.env.FAKE_CLAUDE_OUTPUT ?? '{"summary":"ok","blocked":false,"files":[],"tests":[],"questions":[]}');
const send = message => process.stdout.write(JSON.stringify(message) + '\n');
const session = 'fake-session';
const waiting = new Map();
const users = [];
let userWaiter = null;
const control = request => new Promise(resolve => { const id = 'cli-' + Math.random().toString(36).slice(2); waiting.set(id, resolve); send({ type: 'control_request', request_id: id, request }); });
const result = (extra = {}) => send({ type: 'result', subtype: 'success', is_error: false, session_id: session, uuid: 'r' + users.length, usage: { input_tokens: 7, cache_read_input_tokens: 3, output_tokens: 5 }, structured_output: output, user_message_uuids: users.map(user => user.uuid), queued_turn_count: 0, ...extra });
const tool = (id, name, input) => send({ type: 'assistant', parent_tool_use_id: null, session_id: session, message: { content: [{ type: 'tool_use', id, name, input }] } });
const toolResult = (id, content, isError = false) => send({ type: 'user', parent_tool_use_id: null, session_id: session, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] } });
const nextUser = () => new Promise(resolve => { userWaiter = resolve; });

async function run(prompt) {
  send({ type: 'system', subtype: 'init', session_id: session, model: 'fake-model', apiKeySource: scenario === 'apikey' ? 'ANTHROPIC_API_KEY' : 'none', tools: [], cwd: process.cwd() });
  if (scenario === 'apikey') return;
  if (scenario === 'basic') {
    tool('t1', 'TodoWrite', { todos: [{ content: 'Đọc code', status: 'completed', activeForm: 'Đang đọc code' }, { content: 'Chạy test', status: 'in_progress', activeForm: 'Đang chạy test' }] });
    tool('t2', 'Bash', { command: 'npm test', description: 'Run tests' });
    toolResult('t2', 'all 3 passed');
    tool('t3', 'Bash', { command: 'npm run lint' });
    toolResult('t3', 'Exit code 2\nlint failed', true);
    tool('t4', 'Edit', { file_path: 'src/a.ts', old_string: 'a', new_string: 'b' });
    toolResult('t4', 'updated');
    send({ type: 'stream_event', parent_tool_use_id: null, session_id: session, event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Đang tổng hợp' } } });
    result({ result: 'echo:' + prompt.slice(0, 20) });
  } else if (scenario === 'ask') {
    const questions = [{ question: 'Dùng database nào?', header: 'DB', options: [{ label: 'SQLite', description: 'nhẹ' }, { label: 'Postgres' }], multiSelect: false }];
    const response = await control({ subtype: 'can_use_tool', tool_name: 'AskUserQuestion', tool_use_id: 'q1', input: { questions } });
    output.summary = JSON.stringify(response);
    result();
  } else if (scenario === 'approval') {
    const response = await control({ subtype: 'can_use_tool', tool_name: 'Bash', tool_use_id: 'b1', input: { command: 'npm install left-pad', description: 'install' } });
    output.summary = JSON.stringify(response);
    result();
  } else if (scenario === 'steer') {
    await nextUser();
    output.summary = 'steered:' + users.at(-1).text;
    result();
  } else if (scenario === 'ratelimit') {
    send({ type: 'rate_limit_event', session_id: session, rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour', resetsAt: 1900000000 } });
    send({ type: 'result', subtype: 'success', is_error: true, result: 'limit reached', session_id: session, usage: {} });
  } else if (scenario === 'hang') {
    await new Promise(() => {});
  }
}
createInterface({ input: process.stdin }).on('line', line => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.type === 'control_request') {
    const request = message.request;
    if (request.subtype === 'initialize') send({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: { account, models: [{ value: 'default', displayName: 'Default' }, { value: 'sonnet', displayName: 'Sonnet' }], claude_code_version: '9.9.9-fake' } } });
    else if (request.subtype === 'interrupt') {
      send({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: {} } });
      send({ type: 'result', subtype: 'error_during_execution', is_error: true, errors: ['interrupted'], session_id: session, usage: {} });
    }
  } else if (message.type === 'control_response') {
    waiting.get(message.response.request_id)?.(message.response.response); waiting.delete(message.response.request_id);
  } else if (message.type === 'user') {
    const text = message.message.content.map(block => block.text).join('');
    users.push({ uuid: message.uuid, text });
    if (users.length === 1) void run(text);
    else userWaiter?.();
  }
}).on('close', () => process.exit(0));
