import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Store } from './store.js';
import { CodexProvider } from './codex.js';
import { ClaudeProvider } from './claude.js';
import { createApp } from './app.js';
import { acquireInstanceLock } from './instance-lock.js';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const port = Number(process.env.OFFICE_PORT ?? 4310);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('OFFICE_PORT must be between 1024 and 65535');
const unlock = await acquireInstanceLock(root);
const store = await Store.open(resolve(root, 'data', 'office.db'));
const { app } = await createApp({ root, store, providers: { codex: new CodexProvider(root), claude: new ClaudeProvider(root) }, port, logger: true });
app.addHook('onClose', unlock);
try {
  await app.listen({ host: '127.0.0.1', port });
  console.log(`AI Agent Office: http://127.0.0.1:${port} — local only, Codex + Claude subscriptions`);
} catch { await app.close(); process.exitCode = 1; }
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close().then(() => { process.exitCode = 0; }); });
