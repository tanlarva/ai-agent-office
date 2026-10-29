import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyProductionPackages, includePortableFile } from './portable-files.mjs';

if (process.platform !== 'win32' || process.versions.node.split('.')[0] !== '24') throw new Error('Build portable on Windows with Node.js 24.x.');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--include-local-models')) throw new Error('Supported option: --include-local-models (personal use only)');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
if (lock.packages[''].version !== manifest.version) throw new Error('Manifest and lockfile versions differ.');
const includeLocalModels = args.includes('--include-local-models');
const release = join(root, 'release');
await mkdir(release, { recursive: true });
// Unique staging folder: never delete or overwrite a previous portable app or its database.
const staging = await mkdtemp(join(release, '.staging-'));
try {
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'build-launcher.ps1')], { cwd: root, stdio: 'inherit', windowsHide: true });
  await cp(join(root, 'AI Agent Office.exe'), join(staging, 'AI Agent Office.exe'));
  for (const directory of ['server', 'shared']) await cp(join(root, 'dist', directory), join(staging, 'dist', directory), { recursive: true });
  const web = join(root, 'dist', 'web');
  await cp(web, join(staging, 'dist', 'web'), { recursive: true, filter: file => includePortableFile(web, file, includeLocalModels) });
  await mkdir(join(staging, 'runtime'));
  await cp(process.execPath, join(staging, 'runtime', 'node.exe'));
  await cp(join(dirname(process.execPath), 'LICENSE'), join(staging, 'runtime', 'NODE-LICENSE.txt'));
  await copyProductionPackages(root, staging, lock.packages);
  await writeFile(join(staging, 'package.json'), JSON.stringify({ name: manifest.name, version: manifest.version, private: true, type: 'module' }, null, 2) + '\n');
  await cp(join(root, 'docs', 'PORTABLE.md'), join(staging, 'HUONG-DAN.md'));
  if (includeLocalModels) await writeFile(join(staging, 'PERSONAL-USE-ONLY.txt'), 'Contains local character models. For personal use on your machine only. Do not redistribute without permission from the authors.\n');
  const destination = join(release, `AI-Agent-Office-${manifest.version}-win-${process.arch}-${Date.now()}`);
  await rename(staging, destination);
  console.log(`Portable app: ${destination}`);
  console.log('Double-click AI Agent Office.exe. Provider CLI and subscription login are required on the destination machine.');
} catch (error) {
  console.error(`Packaging failed. Incomplete output kept for inspection: ${staging}`);
  throw error;
}
