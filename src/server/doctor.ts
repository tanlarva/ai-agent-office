import { CodexProvider } from './codex.js';
import { ClaudeProvider } from './claude.js';
// Handshake only: account mode, model catalog and limits. Never sends a prompt to a model.
const results = await Promise.all([new CodexProvider(process.cwd()).status(), new ClaudeProvider(process.cwd()).status()]);
console.log(JSON.stringify(results, null, 2));
process.exitCode = results.some(result => result.state === 'ready') ? 0 : 1;
