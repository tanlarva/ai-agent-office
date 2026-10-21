import type { CreateRun, CreateProjectSession, ProjectSession, FolderPage, Envelope, OfficeEvent, Page, ProviderStatus, Run, SchedulingStatus } from '../shared/contracts';

let csrfToken: string | null = null;

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'X-Office-Client': 'browser',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.method && options.method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...options.headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const problem = body as { error?: { message?: string }; message?: string } | null;
    throw new Error(problem?.error?.message ?? problem?.message ?? `Yêu cầu thất bại (${response.status}).`);
  }
  return body as T;
}

export const api = {
  async session(signal?: AbortSignal) {
    const result = await request<Envelope<{ csrfToken: string }>>('/api/session', { signal });
    csrfToken = result.data.csrfToken;
  },
  providers: (signal?: AbortSignal) => request<Envelope<ProviderStatus[]>>('/api/providers', { signal }),
  scheduling: (signal?: AbortSignal) => request<Envelope<SchedulingStatus>>('/api/scheduling', { signal }),
  runs: (signal?: AbortSignal, sessionId?: string) => request<Page<Run>>(`/api/runs?limit=30${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`, { signal }),
  projectSessions: (signal?: AbortSignal, cursor?: string) => request<Page<ProjectSession>>(`/api/project-sessions?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal }),
  createProjectSession: (input: CreateProjectSession, key: string) => request<Envelope<ProjectSession>>('/api/project-sessions', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key } }),
  folders: (path?: string, cursor?: string, signal?: AbortSignal) => request<Envelope<FolderPage>>(`/api/workspace-folders?${new URLSearchParams({ ...(path ? { path } : {}), ...(cursor ? { cursor } : {}) })}`, { signal }),
  run: (id: string, signal?: AbortSignal) => request<Envelope<Run>>(`/api/runs/${encodeURIComponent(id)}`, { signal }),
  events: (id: string, after: number, signal?: AbortSignal) => request<Page<OfficeEvent>>(`/api/runs/${encodeURIComponent(id)}/events?after=${after}&limit=100`, { signal }),
  create: (input: CreateRun, idempotencyKey: string) => request<Envelope<Run>>('/api/runs', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': idempotencyKey } }),
  cancel: (id: string) => request<Envelope<Run>>(`/api/runs/${encodeURIComponent(id)}/cancellations`, { method: 'POST', body: '{}' }),
  retry: (id: string, version: number, key: string) => request<Envelope<Run>>(`/api/runs/${encodeURIComponent(id)}/retries`, { method: 'POST', body: JSON.stringify({ version }), headers: { 'Idempotency-Key': key } }),
  decide: (id: string, decision: 'accept' | 'decline', version: number) => request<Envelope<Run>>(`/api/approvals/${encodeURIComponent(id)}/decisions`, { method: 'POST', body: JSON.stringify({ decision, version }) }),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu.';
}

export function mergeEvents(current: OfficeEvent[], incoming: OfficeEvent[]): OfficeEvent[] {
  const items = new Map(current.map(event => [event.sequence, event]));
  for (const event of incoming) items.set(event.sequence, event);
  return [...items.values()].sort((a, b) => a.sequence - b.sequence).slice(-200);
}
