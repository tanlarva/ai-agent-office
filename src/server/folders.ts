import { lstat, opendir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { FolderEntry, FolderPage } from '../shared/contracts.js';
import { OfficeError } from './errors.js';

const hidden = new Set(['node_modules', '$recycle.bin', 'system volume information']);
const sameOrWithin = (candidate: string, root: string) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
export class FolderBrowser {
  constructor(private readonly appRoot: string, private readonly configuredRoot?: string) {}
  async list(input?: string, offset = 0, limit = 50): Promise<FolderPage> {
    let root: string, current: string;
    try {
      root = await realpath(this.configuredRoot ?? path.dirname(this.appRoot));
      const requested = input ?? root;
      if (!path.isAbsolute(requested) || requested.startsWith('\\\\') || requested.startsWith('//') || !sameOrWithin(path.resolve(requested), root))
        throw new OfficeError('FOLDER_SCOPE', 'Cây thư mục chỉ duyệt bên trong root dự án đã cấu hình.', 403);
      current = await realpath(requested);
      if (!sameOrWithin(current, root) || sameOrWithin(current, this.appRoot)) throw new OfficeError('FOLDER_SCOPE', 'Thư mục này không được phép duyệt.', 403);
      let part = path.resolve(requested);
      while (part !== root && sameOrWithin(part, root)) {
        if ((await lstat(part)).isSymbolicLink()) throw new OfficeError('FOLDER_LINK', 'Không duyệt symlink hoặc junction.', 403);
        part = path.dirname(part);
      }
      if (!(await stat(current)).isDirectory()) throw new OfficeError('FOLDER_INVALID', 'Đường dẫn không phải thư mục.');
    } catch (error) {
      if (error instanceof OfficeError) throw error;
      throw new OfficeError('FOLDER_UNAVAILABLE', 'Không đọc được thư mục. Kiểm tra đường dẫn và quyền trên máy.', 404);
    }
    const entries: FolderEntry[] = [];
    let count = 0, scanned = 0, more = false, truncated = false;
    try {
      // Read one directory level on demand; never recursively scan the user's projects.
      for await (const entry of await opendir(current)) {
        if (++scanned > 10_000) { truncated = true; break; }
        if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith('.') || hidden.has(entry.name.toLowerCase())) continue;
        const child = path.join(current, entry.name);
        if (sameOrWithin(child, this.appRoot)) continue;
        if (count++ < offset) continue;
        if (entries.length === limit) { more = true; break; }
        entries.push({ name: entry.name, path: child, selectable: !sameOrWithin(this.appRoot, child) });
      }
    } catch { throw new OfficeError('FOLDER_UNAVAILABLE', 'Không đọc được danh sách thư mục.', 404); }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return { root, path: current, entries, nextCursor: more ? String(offset + entries.length) : null, truncated };
  }
}
