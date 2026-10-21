import type { OfficeEvent } from '../shared/contracts';

export type FeedEntry =
  | { kind: 'command'; id: number; tool: string; command: string; detail?: string; exitCode?: number | null; output?: string; running: boolean; at: string }
  | { kind: 'text'; id: number; text: string; at: string }
  | { kind: 'status'; id: number; tone: 'info' | 'warn' | 'user' | 'ok' | 'error'; text: string; at: string };

const str = (value: unknown) => typeof value === 'string' ? value : '';
type Tone = Extract<FeedEntry, { kind: 'status' }>['tone'];
const statusText: Record<string, (payload: Record<string, unknown>) => { tone: Tone; text: string } | null> = {
  'capacity.dispatched': payload => ({ tone: 'info', text: `Bắt đầu lượt ${String(payload.attempt ?? 1)}${payload.notes ? ` · kèm ${String(payload.notes)} chỉ dẫn của bạn` : ''}` }),
  'capacity.waiting': payload => ({ tone: 'warn', text: payload.reason === 'rate_limit' ? 'Chờ provider cho phép gọi tiếp (429)' : 'Giãn lượt gọi theo bộ điều tiết' }),
  'capacity.retry_scheduled': () => ({ tone: 'warn', text: 'Đã lên lịch thử lại do giới hạn tạm thời' }),
  'provider.retry': payload => ({ tone: 'warn', text: `Provider thử lại lần ${String(payload.attempt ?? '?')} (${str(payload.error) || 'lỗi tạm thời'})` }),
  'provider.limit': payload => payload.status === 'allowed' ? null : ({ tone: 'warn', text: `Hạn mức ${str(payload.window)}: ${str(payload.status)}` }),
  'approval.requested': payload => ({ tone: 'user', text: 'Chờ bạn phê duyệt: ' + str(payload.description).split('\n')[0] }),
  'approval.resolved': payload => ({ tone: 'user', text: payload.decision === 'accept' ? 'Bạn đã cho phép' : 'Bạn đã từ chối' }),
  'inquiry.requested': payload => ({ tone: 'user', text: 'Agent hỏi bạn: ' + str(payload.summary) }),
  'inquiry.answered': payload => ({ tone: 'user', text: payload.skipped ? 'Bạn để agent tự quyết' : 'Bạn đã trả lời' }),
  'user.note': payload => ({ tone: 'user', text: `${payload.mode === 'interrupt' ? 'Bạn chen ngang' : 'Bạn gửi chỉ dẫn'}: ${str(payload.text)}` }),
  'task.redirected': () => ({ tone: 'warn', text: 'Đã dừng lượt hiện tại để làm lại theo chỉ dẫn' }),
  'artifact.created': payload => ({ tone: 'ok', text: 'Đã sửa file' + (Array.isArray(payload.paths) && payload.paths.length ? ': ' + payload.paths.map(str).join(', ') : '') }),
  'task.state_changed': payload => payload.state === 'succeeded' ? { tone: 'ok', text: 'Đã bàn giao bước này' } : payload.reason === 'USER_ANSWERED' ? { tone: 'info', text: 'Làm lại bước với câu trả lời của bạn' } : null,
  'run.completed': payload => ({ tone: payload.state === 'succeeded' ? 'ok' : 'error', text: payload.state === 'succeeded' ? 'Công việc hoàn tất' : str(payload.message) || 'Công việc kết thúc với lỗi' }),
};

/** Turns raw runtime events of one task into a terminal-like transcript. Pure and bounded. */
export function buildFeed(events: readonly OfficeEvent[], taskId: string | null, limit = 300): FeedEntry[] {
  const feed: FeedEntry[] = [];
  const open = new Map<string, Extract<FeedEntry, { kind: 'command' }>>();
  for (const event of events) {
    if (taskId && event.taskId !== taskId && event.type !== 'run.completed') continue;
    const { payload } = event;
    if (event.type === 'tool.started') {
      const entry: FeedEntry = { kind: 'command', id: event.sequence, tool: str(payload.kind), command: str(payload.command), ...(str(payload.detail) ? { detail: str(payload.detail) } : {}), running: true, at: event.occurredAt };
      open.set(entry.tool + '\u0000' + entry.command, entry); feed.push(entry);
    } else if (event.type === 'tool.completed') {
      const key = str(payload.kind) + '\u0000' + str(payload.command);
      const entry = open.get(key) ?? (() => { const created: Extract<FeedEntry, { kind: 'command' }> = { kind: 'command', id: event.sequence, tool: str(payload.kind), command: str(payload.command), running: true, at: event.occurredAt }; feed.push(created); return created; })();
      open.delete(key);
      entry.running = false; entry.exitCode = typeof payload.exitCode === 'number' ? payload.exitCode : null;
      if (str(payload.output)) entry.output = str(payload.output);
    } else if (event.type === 'agent.message_delta') {
      const last = feed.at(-1);
      if (last?.kind === 'text') last.text = (last.text + str(payload.text)).slice(-4000);
      else feed.push({ kind: 'text', id: event.sequence, text: str(payload.text), at: event.occurredAt });
    } else {
      const status = statusText[event.type]?.(payload);
      if (status) feed.push({ kind: 'status', id: event.sequence, ...status, at: event.occurredAt });
    }
  }
  return feed.slice(-limit);
}
