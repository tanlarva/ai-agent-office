import { cp, lstat, mkdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

export function includePortableFile(base, file, includeLocalModels = false) {
  const name = relative(base, file).split(sep).join('/');
  return includeLocalModels || (name !== 'models/local' && !name.startsWith('models/local/'));
}

// Copy only locked production packages already installed by npm ci. No network or install scripts.
export async function copyProductionPackages(root, target, packages) {
  for (const [name, entry] of Object.entries(packages)) {
    if (!name.startsWith('node_modules/') || entry.dev) continue;
    if (name.split('/').some(part => part === '..' || part === '.') || entry.link) throw new Error(`Unsupported package path: ${name}`);
    const source = join(root, name);
    let stat;
    try { stat = await lstat(source); }
    catch (error) { if (error.code === 'ENOENT' && entry.optional) continue; throw error; }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Package must be an installed directory: ${name}`);
    const installed = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
    if (installed.version !== entry.version) throw new Error(`Package differs from lockfile: ${name}; run npm ci`);
    await mkdir(join(target, name), { recursive: true });
    await cp(source, join(target, name), { recursive: true, filter: path => {
      // Nested packages are copied using their own lock entries; omit npm bin shims.
      const parts = relative(source, path).split(sep);
      return !parts.includes('node_modules') && !parts.includes('.bin');
    } });
  }
}
