import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { OfficeError } from './errors.js';

export type RpcMessage = { id?: number | string; method?: string; params?: unknown; result?: unknown; error?: unknown };
export async function codexCommand(): Promise<{ file: string; args: string[] }> {
  const explicit = process.env.OFFICE_CODEX_PATH;
  if (explicit) {
    if (!isAbsolute(explicit) || !/\.(exe|js)$/i.test(explicit)) throw new OfficeError('CODEX_PATH', 'OFFICE_CODEX_PATH phải là đường dẫn tuyệt đối tới .exe hoặc .js.', 503);
    await access(explicit);
    return explicit.endsWith('.js') ? { file: process.execPath, args: [explicit] } : { file: explicit, args: [] };
  }
  if (process.platform === 'win32' && process.env.APPDATA) {
    const script = join(process.env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    try { await access(script); return { file: process.execPath, args: [script] }; } catch { /* Fall through to executable lookup. */ }
  }
  return { file: 'codex', args: [] };
}
export function providerEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'HOME', 'CODEX_HOME', 'PROGRAMFILES', 'ProgramFiles', 'PROCESSOR_ARCHITECTURE']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}
export class RpcClient {
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private nextId = 0;
  private buffer = '';
  private dead = false;
  private exitPromise: Promise<void>;
  private closing: Promise<void> | undefined;
  onMessage: (message: RpcMessage) => void = () => {};
  readonly child: ChildProcessWithoutNullStreams;
  constructor(file: string, args: string[], cwd: string) {
    this.child = spawn(file, args, { cwd, env: providerEnvironment(), shell: false, windowsHide: true, stdio: 'pipe' });
    this.exitPromise = new Promise(resolve => this.child.once('close', () => { this.fail(); resolve(); }));
    this.child.once('error', () => this.fail());
    this.child.stdin.on('error', () => this.fail());
    this.child.stderr.resume(); // Never surface raw provider diagnostics or credentials.
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      if (Buffer.byteLength(this.buffer) > 2_000_000) { this.fail(); void this.close(); return; }
      let newline: number;
      while ((newline = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, newline); this.buffer = this.buffer.slice(newline + 1);
        if (!line.trim()) continue;
        let message: RpcMessage;
        try {
          const parsed: unknown = JSON.parse(line);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid RPC envelope');
          message = parsed as RpcMessage;
        }
        catch { this.fail(); void this.close(); return; }
        if (typeof message.id === 'number' && !message.method) {
          const pending = this.pending.get(message.id);
          if (!pending) continue;
          clearTimeout(pending.timer); this.pending.delete(message.id);
          if (message.error) pending.reject(new OfficeError('CODEX_RPC', 'Codex từ chối yêu cầu. Kiểm tra phiên bản, đăng nhập và quyền sandbox.', 503));
          else pending.resolve(message.result);
        } else this.onMessage(message);
      }
    });
  }
  private fail(): void {
    this.dead = true;
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(new OfficeError('CODEX_OFFLINE', 'Mất kết nối với Codex App Server.', 503)); }
    this.pending.clear();
    this.onMessage({ method: 'office/transportClosed' });
  }
  send(message: RpcMessage): void {
    if (this.dead || this.child.stdin.destroyed) throw new OfficeError('CODEX_OFFLINE', 'Codex App Server đã đóng.', 503);
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }
  request(method: string, params: unknown, timeout = 30_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new OfficeError('CODEX_TIMEOUT', 'Codex chưa phản hồi trong thời gian cho phép.', 503)); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  close(): Promise<void> {
    this.closing ??= this.closeProcess(); return this.closing;
  }
  private async closeProcess(): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    this.child.stdin.end();
    const timeout = setTimeout(() => {
      if (this.child.exitCode !== null || this.child.signalCode !== null) return;
      if (process.platform === 'win32' && this.child.pid) {
        const killer = spawn('taskkill.exe', ['/PID', String(this.child.pid), '/T', '/F'], { windowsHide: true, shell: false, stdio: 'ignore' });
        killer.on('error', () => this.child.kill());
      } else this.child.kill('SIGKILL');
    }, 1500);
    await this.exitPromise; clearTimeout(timeout);
  }
}
