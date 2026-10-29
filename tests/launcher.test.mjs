import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attachLauncherControl } from '../dist/server/launcher-control.js';
import { copyProductionPackages, includePortableFile } from '../scripts/portable-files.mjs';

test('launcher signals readiness and stops once for an explicit stop command', async () => {
  const input = new PassThrough(), output = new PassThrough();
  let calls = 0;
  attachLauncherControl(async () => { calls++; }, 4310, input, output);
  assert.equal(output.read().toString(), 'OFFICE_LAUNCHER_READY:4310\n');
  input.write('arbitrary\n');
  assert.equal(calls, 0);
  input.write('st'); input.write('op\r\nstop\n'); input.end();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
});

test('launcher disconnect closes backend, and failed shutdown is reported', async () => {
  const input = new PassThrough(), output = new PassThrough();
  let calls = 0, errors = 0;
  attachLauncherControl(async () => { calls++; throw new Error('close failed'); }, 5432, input, output, () => { errors++; });
  input.end();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(errors, 1);
});

test('broken launcher output pipe initiates clean shutdown rather than an unhandled stream error', async () => {
  const input = new PassThrough(), output = new PassThrough();
  let calls = 0;
  attachLauncherControl(async () => { calls++; }, 4310, input, output);
  output.emit('error', Object.assign(new Error('parent closed'), { code: 'EPIPE' }));
  input.end();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
});

test('portable excludes private character binaries by default and includes them only on opt-in', () => {
  const root = join(tmpdir(), 'portable-web');
  for (const name of ['models/local', 'models/local/yori.vrm', 'models/local/nested/asset.bin'])
    assert.equal(includePortableFile(root, join(root, name)), false);
  for (const name of ['', 'index.html', 'models/README.md', 'models/localized.png'])
    assert.equal(includePortableFile(root, join(root, name)), true);
  assert.equal(includePortableFile(root, join(root, 'models/local/yori.vrm'), true), true);
});

test('portable copies locked production packages including nested dependencies, without dev files', async t => {
  const base = await mkdtemp(join(tmpdir(), 'office-portable-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const source = join(base, 'source'), target = join(base, 'target');
  async function packageAt(name, version = '1.0.0') {
    const directory = join(source, name);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'package.json'), JSON.stringify({ version }));
    await writeFile(join(directory, 'LICENSE'), 'fixture license');
  }
  await packageAt('node_modules/runtime');
  await packageAt('node_modules/devtool');
  await packageAt('node_modules/runtime/node_modules/child');
  await packageAt('node_modules/runtime/node_modules/unlocked-dev');
  await writeFile(join(source, 'auth.json'), 'private fixture');
  await copyProductionPackages(source, target, {
    '': {},
    'node_modules/runtime': { version: '1.0.0' },
    'node_modules/runtime/node_modules/child': { version: '1.0.0' },
    'node_modules/devtool': { dev: true, version: '1.0.0' },
    'node_modules/platform-optional': { optional: true, version: '1.0.0' },
  });
  assert.deepEqual(await readdir(target), ['node_modules']);
  assert.deepEqual(await readdir(join(target, 'node_modules')), ['runtime']);
  assert.deepEqual(await readdir(join(target, 'node_modules/runtime/node_modules')), ['child']);
  assert.equal(await readFile(join(target, 'node_modules/runtime/LICENSE'), 'utf8'), 'fixture license');
  await assert.rejects(copyProductionPackages(source, target, { 'node_modules/runtime': { version: '2.0.0' } }), /differs from lockfile/);
  await assert.rejects(copyProductionPackages(source, target, { 'node_modules/missing': { version: '1.0.0' } }), { code: 'ENOENT' });
  await assert.rejects(copyProductionPackages(source, target, { 'node_modules/../escape': {} }), /Unsupported package path/);
  await assert.rejects(copyProductionPackages(source, target, { 'node_modules/link': { link: true } }), /Unsupported package path/);
});
