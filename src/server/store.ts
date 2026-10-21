import { Worker } from 'node:worker_threads';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { OfficeEvent, Run, ProjectSession, SchedulingState } from '../shared/contracts.js';

export class Store {
  private worker: Worker;
  private id = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private ready: Promise<void>;
  private closed = false;
  constructor(path: string) {
    this.worker = new Worker(new URL('./store-worker.js', import.meta.url), { workerData: { path } });
    this.ready = new Promise((resolve, reject) => {
      this.worker.once('error', reject);
      this.worker.on('message', (message: { ready?: boolean; id: number; result?: unknown; error?: string }) => {
        if (message.ready) { resolve(); return; }
        const waiter = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) waiter?.reject(new Error(message.error)); else waiter?.resolve(message.result);
      });
    });
    const rejectPending = () => {
      this.closed = true;
      for (const waiter of this.pending.values()) waiter.reject(new Error('DATABASE_CLOSED'));
      this.pending.clear();
    };
    this.worker.on('error', rejectPending);
    this.worker.on('exit', rejectPending);
  }
  static async open(path: string): Promise<Store> {
    await mkdir(dirname(path), { recursive: true });
    const store = new Store(path); await store.ready; return store;
  }
  private async call<T>(op: string, args: Record<string, unknown>): Promise<T> {
    await this.ready;
    if (this.closed) throw new Error('DATABASE_CLOSED');
    return new Promise<T>((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve: value => resolve(value as T), reject });
      this.worker.postMessage({ id, op, args });
    });
  }
  create(run: Run, key: string, hash: string): Promise<Run> { return this.call('create', { run, key, hash }); }
  save(run: Run, event: OfficeEvent): Promise<null> { return this.call('save', { run, event }); }
  get(id: string): Promise<Run | null> { return this.call('get', { id }); }
  byKey(key: string): Promise<{ run: Run; hash: string } | null> { return this.call('key', { key }); }
  list(limit: number, cursor?: string, sessionId?: string): Promise<Run[]> { return this.call('list', { limit, cursor, sessionId }); }
  getSession(id: string): Promise<ProjectSession | null> { return this.call('session_get', { id }); }
  sessionByKey(key: string): Promise<{ session: ProjectSession; hash: string } | null> { return this.call('session_key', { key }); }
  createSession(session: ProjectSession, key: string, hash: string): Promise<ProjectSession> { return this.call('session_create', { session, key, hash }); }
  sessions(limit: number, cursor?: string): Promise<ProjectSession[]> { return this.call('session_list', { limit, cursor }); }
  events(id: string, after: number, limit: number): Promise<OfficeEvent[]> { return this.call('events', { id, after, limit }); }
  active(): Promise<Run[]> { return this.call('active', {}); }
  scheduling(): Promise<SchedulingState | null> { return this.call('scheduling_get', {}); }
  saveScheduling(value: SchedulingState): Promise<null> { return this.call('scheduling_save', { value }); }
  async close(): Promise<void> { await this.worker.terminate(); }
}
