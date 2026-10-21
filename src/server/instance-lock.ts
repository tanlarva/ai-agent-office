import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { OfficeError } from './errors.js';

// A kernel-owned named pipe avoids stale lock files and PID-reuse races after a crash.
export async function acquireInstanceLock(root: string): Promise<() => Promise<void>> {
  const canonical = (await realpath(root)).toLowerCase();
  const hash = createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  const lock = createServer(socket => socket.end());
  await new Promise<void>((resolve, reject) => {
    lock.once('error', () => reject(new OfficeError('INSTANCE_RUNNING', 'Agent Office đã chạy với thư mục dữ liệu này. Đóng phiên cũ trước.', 409)));
    if (process.platform === 'win32') lock.listen(`\\\\.\\pipe\\ai-agent-office-${hash}`, resolve);
    else lock.listen({ host: '127.0.0.1', port: 44000 + parseInt(hash.slice(0, 4), 16) % 10000, exclusive: true }, resolve);
  });
  return () => new Promise<void>((resolve, reject) => lock.close(error => error ? reject(error) : resolve()));
}
