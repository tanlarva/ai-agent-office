import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

// The native launcher owns stdin. No HTTP shutdown endpoint or extra permission is exposed.
export function attachLauncherControl(stop: () => Promise<void>, port: number,
  input: Readable = process.stdin, output: Writable = process.stdout, onError: () => void = () => { process.exitCode = 1; }) {
  const lines = createInterface({ input, crlfDelay: Infinity });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    lines.close();
    input.pause();
    void stop().catch(onError);
  };
  lines.on('line', line => { if (line === 'stop') shutdown(); });
  lines.on('close', shutdown); // Launcher crash/disconnect also stops its backend.
  lines.on('error', shutdown);
  output.on('error', shutdown); // Broken parent pipe must not crash midway through cleanup.
  output.write(`OFFICE_LAUNCHER_READY:${port}\n`);
  return shutdown;
}
