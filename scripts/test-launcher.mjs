import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('Native launcher tests require Windows.');
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(project, 'release');
const candidates = (await readdir(release)).filter(name => /^AI-Agent-Office-.*-\d+$/.test(name)).sort((a, b) => Number(b.split('-').at(-1)) - Number(a.split('-').at(-1)));
if (!candidates.length) throw new Error('Run npm run build:portable first.');
const source = join(release, candidates[0]);
assert.equal((await readdir(source)).some(name => /^(data|auth\.json|\.codex|\.env|work)$/i.test(name)), false);
assert.equal((await readdir(join(source, 'dist/web/models'))).includes('local'), false);
console.log('PASS: portable has no private data or local character models');
const work = join(project, 'work');
await mkdir(work, { recursive: true });
const fixture = await mkdtemp(join(work, 'launcher-test-'));
const root = join(fixture, 'Ứng dụng có khoảng trắng');
await cp(source, root, { recursive: true });
const exe = join(root, 'AI Agent Office.exe');
const children = new Set();
let occupied;
let port;
const log = async () => readFile(join(root, 'data/launcher.log'), 'utf8').catch(() => '');
async function waitFor(check, description, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout: ${description}`);
}
function launch(args) {
  const child = spawn(exe, args, { cwd: fixture, windowsHide: true, stdio: 'ignore', env: { ...process.env, OFFICE_PORT: String(port) } });
  children.add(child);
  child.once('error', error => { child.launchError = error; });
  return child;
}
async function exited(child, expected) {
  await waitFor(() => child.exitCode !== null || child.signalCode !== null || child.launchError, 'launcher exit');
  if (child.launchError) throw child.launchError;
  if (expected !== undefined) assert.equal(child.exitCode, expected);
  children.delete(child);
}
async function reachable() {
  try { return (await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(500) })).status === 200; }
  catch { return false; }
}
async function cleanup() {
  const name = relative(work, fixture);
  if (!name.startsWith('launcher-test-') || name.includes('/') || name.includes('\\')) throw new Error('Unsafe cleanup path');
  await rm(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
let failure;
try {
  const listener = createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  assert.match(execFileSync(join(root, 'runtime/node.exe'), ['--version'], { encoding: 'utf8', windowsHide: true }), /^v24\./);
  await exited(launch(['--smoke-test']), 0);
  assert.match(await log(), /READY[\s\S]*STOPPED/);
  console.log('PASS: native exe starts and stops with bundled Node, from a Unicode/spaced path');

  const owner = launch(['--no-browser']);
  await waitFor(reachable, 'HTTP ready');
  const response = await fetch(`http://127.0.0.1:${port}`);
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await response.text(), /<div id="root">/);
  const session = await fetch(`http://127.0.0.1:${port}/api/session`, { headers: { 'x-office-client': 'browser' } });
  assert.equal(session.status, 200);
  const before = (await log()).match(/ READY/g)?.length;
  await exited(launch(['--no-browser']), 0);
  assert.equal((await log()).match(/ READY/g)?.length, before);
  assert.equal(owner.exitCode, null);
  console.log('PASS: backend serves real UI/session and a second launcher reuses the owner');
  await exited(launch(['--stop']), 0);
  await exited(owner, 0);
  await waitFor(async () => !await reachable(), 'port released');
  await exited(launch(['--smoke-test']), 0);
  console.log('PASS: stop closes backend and releases database/instance lock for restart');

  occupied = createServer(socket => socket.destroy());
  await new Promise(resolve => occupied.listen(port, '127.0.0.1', resolve));
  await exited(launch(['--smoke-test']), 1);
  await new Promise(resolve => occupied.close(resolve));
  occupied = undefined;
  console.log('PASS: occupied port fails without opening an unrelated service');

  const crashed = launch(['--no-browser']);
  await waitFor(reachable, 'backend before launcher crash');
  crashed.kill();
  await exited(crashed);
  await waitFor(async () => !await reachable(), 'backend stops after launcher crash');
  await exited(launch(['--smoke-test']), 0);
  console.log('PASS: launcher crash closes stdin, stops backend and permits restart');

  const page = join(root, 'dist/web/index.html');
  await rename(page, page + '.test-backup');
  await exited(launch(['--smoke-test']), 1);
  await rename(page + '.test-backup', page);
  console.log('PASS: incomplete app fails before starting a backend');
} catch (error) {
  failure = error;
  console.error('Native launcher test failed:', error);
  console.error(await log());
} finally {
  if (occupied) await new Promise(resolve => occupied.close(resolve));
  if (children.size) {
    await exited(launch(['--stop'])).catch(() => {});
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill();
    await waitFor(async () => !await reachable(), 'test backend cleanup').catch(() => {});
  }
  // Keep failed fixtures for diagnosis; successful runs delete only their checked temp directory.
  if (failure) console.error(`Failed fixture kept: ${fixture}`);
  else await cleanup();
}
if (failure) throw failure;
