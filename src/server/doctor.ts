import { CodexProvider } from './codex.js';
const result = await new CodexProvider(process.cwd()).status();
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.state === 'ready' ? 0 : 1;
