import { createHash, randomUUID } from 'node:crypto';
import type { CreateProjectSession, ProjectSession } from '../shared/contracts.js';
import type { Store } from './store.js';
import { validateWorkspace } from './workspace.js';
import { OfficeError } from './errors.js';

export class ProjectSessions {
  private creates: Promise<unknown> = Promise.resolve();
  constructor(private readonly store: Store, private readonly root: string, private readonly allowedRoot?: string) {}
  create(input: CreateProjectSession, key: string): Promise<ProjectSession> {
    const result = this.creates.then(async () => {
      const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const existing = await this.store.sessionByKey(key);
      if (existing) {
        if (existing.hash !== hash) throw new OfficeError('IDEMPOTENCY_CONFLICT', 'Key tạo phiên đã dùng với nội dung khác.', 409);
        return existing.session;
      }
      const workspace = await validateWorkspace(input.workspace, this.root, this.allowedRoot);
      return this.store.createSession({ id: randomUUID(), name: input.name, workspace, createdAt: new Date().toISOString(), ...(input.workflowId ? { workflowId: input.workflowId } : {}) }, key, hash);
    });
    this.creates = result.catch(() => {}); return result;
  }
}
