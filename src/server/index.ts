import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Store } from './store.js';
import { CodexProvider } from './codex.js';
import { ClaudeProvider } from './claude.js';
import { createApp } from './app.js';
import { acquireInstanceLock } from './instance-lock.js';
import { attachLauncherControl } from './launcher-control.js';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const port = Number(process.env.OFFICE_PORT ?? 4310);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('OFFICE_PORT must be between 1024 and 65535');
async function main() {
  const unlock = await acquireInstanceLock(root);
  let store: Store | undefined;
  let app: Awaited<ReturnType<typeof createApp>>['app'] | undefined;
  try {
    store = await Store.open(resolve(root, 'data', 'office.db'));
    ({ app } = await createApp({ root, store, providers: { codex: new CodexProvider(root), claude: new ClaudeProvider(root) }, port, logger: true }));
    app.addHook('onClose', unlock);
    await app.listen({ host: '127.0.0.1', port });
    let stopping: Promise<void> | undefined;
    const stop = () => stopping ??= app!.close();
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void stop().catch(reportFailure); });
    if (process.env.OFFICE_LAUNCHER === '1') attachLauncherControl(stop, port);
    console.log(`AI Agent Office: http://127.0.0.1:${port} — local only, Codex + Claude subscriptions`);
  } catch (error) {
    if (app) await app.close();
    else { await store?.close(); await unlock(); }
    throw error;
  }
}

function reportFailure(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'STARTUP_FAILED';
  // Native launcher consumes only this marker, never raw logs, paths, or provider diagnostics.
  console.error(`OFFICE_LAUNCHER_ERROR:${/^[A-Z_]+$/.test(code) ? code : 'STARTUP_FAILED'}`);
  process.exitCode = 1;
}
await main().catch(reportFailure);
