import { lstat, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { OfficeError } from './errors.js';

export async function validateWorkspace(input: string, appRoot: string, allowedRoot?: string): Promise<string> {
  if (!path.isAbsolute(input) || input.startsWith('\\\\') || input.startsWith('//'))
    throw new OfficeError('WORKSPACE_INVALID', 'Chọn đường dẫn tuyệt đối trên ổ đĩa local.');
  let resolved: string;
  try {
    resolved = await realpath(input);
    if (!(await stat(resolved)).isDirectory()) throw new Error('not_directory');
  } catch { throw new OfficeError('WORKSPACE_NOT_FOUND', 'Thư mục workspace không tồn tại hoặc không đọc được.'); }
  const normal = (value: string) => path.resolve(value).toLowerCase();
  const within = (value: string, root: string) => normal(value) === normal(root) || normal(value).startsWith(normal(root) + path.sep);
  if (normal(resolved) === normal(path.parse(resolved).root) || normal(resolved) === normal(homedir()) || within(resolved, appRoot) || within(appRoot, resolved))
    throw new OfficeError('WORKSPACE_SCOPE', 'Chọn thư mục dự án riêng, không chọn ổ đĩa, thư mục người dùng hoặc source của Agent Office.');
  if (allowedRoot && !within(resolved, await realpath(allowedRoot)))
    throw new OfficeError('WORKSPACE_SCOPE', 'Workspace nằm ngoài OFFICE_WORKSPACE_ROOT đã cấu hình.');
  // Reject reparse/symbolic components of the selected path; Codex sandbox enforces access during execution.
  let current = path.resolve(input);
  while (current !== path.dirname(current)) {
    if ((await lstat(current)).isSymbolicLink()) throw new OfficeError('WORKSPACE_LINK', 'Không chọn workspace qua symlink hoặc junction.');
    current = path.dirname(current);
  }
  return resolved;
}
