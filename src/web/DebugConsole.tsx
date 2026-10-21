import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CheckCircle2, Circle, LoaderCircle, Maximize2, Minimize2, MonitorDot, Pin, PinOff } from 'lucide-react';
import { providerNames, terminalStates, type OfficeEvent, type Run, type Task } from '../shared/contracts';
import { buildFeed, type FeedEntry } from './debugFeed';
import { formatTime, formatTokens, rolesForRun, stateLabels } from './labels';

function liveTask(run: Run): Task | undefined {
  // Running/asking role first; after the run, the failed role or the last one that did work.
  return run.tasks.find(task => !terminalStates.has(task.state) && task.state !== 'queued') ?? run.tasks.find(task => task.state === 'failed') ?? [...run.tasks].reverse().find(task => task.state !== 'queued');
}
function Entry({ entry }: { entry: FeedEntry }) {
  if (entry.kind === 'text') return <div className="feed-text"><span className="feed-time">{formatTime(entry.at)}</span><p className="pre-wrap">{entry.text}</p></div>;
  if (entry.kind === 'status') return <div className={`feed-status tone-${entry.tone}`}><span className="feed-time">{formatTime(entry.at)}</span><span>{entry.text}</span></div>;
  const state = entry.running ? 'running' : entry.exitCode === 0 ? 'ok' : entry.exitCode == null ? 'unknown' : 'failed';
  return <div className={`feed-command command-${state}`}>
    <div className="feed-command-line"><span className="feed-time">{formatTime(entry.at)}</span><span className="feed-prompt">{entry.tool === 'Bash' || entry.tool === 'commandExecution' ? '$' : '›'}</span><code>{entry.command || entry.tool}</code>
      <span className="feed-exit">{entry.running ? <LoaderCircle size={12} className="spinner" /> : entry.exitCode == null ? '—' : `exit ${entry.exitCode}`}</span></div>
    {entry.detail && <pre className="feed-detail">{entry.detail}</pre>}
    {entry.output && <details open={state === 'failed'}><summary>Output</summary><pre>{entry.output}</pre></details>}
  </div>;
}

/** Live "employee screen": what one role is doing right now, built only from recorded runtime events. */
export function DebugConsole({ run, events, focusTaskId, onFocus }: { run: Run; events: OfficeEvent[]; focusTaskId: string | null; onFocus: (taskId: string | null) => void }) {
  const roles = rolesForRun(run);
  const [follow, setFollow] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const auto = liveTask(run);
  const task = (follow ? auto : undefined) ?? run.tasks.find(item => item.id === focusTaskId) ?? auto ?? run.tasks[0];
  const index = task ? run.tasks.indexOf(task) : -1;
  const feed = useMemo(() => buildFeed(events, task?.id ?? null), [events, task?.id]);
  const screen = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => { if (screen.current && pinned.current) screen.current.scrollTop = screen.current.scrollHeight; }, [feed]);
  useEffect(() => { if (focusTaskId) setFollow(false); }, [focusTaskId]);
  if (!task) return null;
  const role = roles[index];
  const todos = task.todos ?? [];
  const done = todos.filter(todo => todo.status === 'completed').length;
  return <section className={`debug-console ${expanded ? 'expanded' : ''}`} aria-labelledby="debug-title" style={{ '--role-color': role?.color } as CSSProperties}>
    <div className="debug-heading">
      <h2 id="debug-title"><MonitorDot size={17} />Màn hình nhân viên</h2>
      <div className="debug-controls">
        <button className="text-button" aria-pressed={follow} onClick={() => { setFollow(value => !value); onFocus(null); }} title="Tự chuyển sang vai trò đang làm">{follow ? <Pin size={14} /> : <PinOff size={14} />}{follow ? 'Theo dõi tự động' : 'Đang xem cố định'}</button>
        <button className="text-button" aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{expanded ? 'Thu nhỏ' : 'Phóng to'}</button>
      </div>
    </div>
    <div className="debug-tabs" role="tablist" aria-label="Chọn vai trò">
      {run.tasks.map((item, i) => <button key={item.id} role="tab" aria-selected={item.id === task.id} className={`debug-tab state-${item.state}`} style={{ '--role-color': roles[i]?.color } as CSSProperties} onClick={() => { setFollow(false); onFocus(item.id); }}>
        <span className="status-dot" />{roles[i]?.name ?? item.role}
      </button>)}
    </div>
    <div className="debug-body">
      <div className="debug-screen-wrap">
        <div className="debug-screen-bar"><span className="dots"><i /><i /><i /></span><strong>{role?.name}</strong><span>bước {index + 1}/{run.tasks.length} · {stateLabels[task.state]}</span></div>
        <div className="debug-screen" ref={screen} role="log" aria-live="polite" aria-label={`Hoạt động của ${role?.name}`}
          onScroll={event => { const el = event.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
          {feed.length ? feed.map(entry => <Entry key={entry.kind + entry.id} entry={entry} />) : <p className="feed-empty">{task.state === 'queued' ? 'Vai trò này chưa đến lượt.' : task.inheritedFromTaskId ? 'Kế thừa bàn giao từ lượt trước; không có hoạt động mới.' : 'Chưa có hoạt động được ghi lại cho vai trò này.'}</p>}
          {task.activity && task.state === 'running' && <div className="feed-cursor"><span className="caret" />{task.activity}</div>}
        </div>
      </div>
      <aside className="debug-side">
        <div><h3>ĐANG LÀM</h3><p>{task.state === 'waiting_input' ? 'Chờ bạn trả lời câu hỏi' : task.state === 'waiting_approval' ? 'Chờ bạn phê duyệt' : task.activity ?? stateLabels[task.state]}</p></div>
        <div><h3>CHECKLIST CỦA AGENT {todos.length ? `· ${done}/${todos.length}` : ''}</h3>
          {todos.length ? <ol className="todo-list">{todos.map((todo, i) => <li key={i} className={`todo-${todo.status}`}>{todo.status === 'completed' ? <CheckCircle2 size={13} /> : todo.status === 'in_progress' ? <LoaderCircle size={13} className="spinner" /> : <Circle size={13} />}<span>{todo.text}</span></li>)}</ol>
            : <p className="field-help">Agent chưa báo checklist. {run.provider === 'claude' ? '' : 'Codex chỉ gửi khi có cập nhật kế hoạch.'}</p>}
        </div>
        <dl className="debug-meta">
          <div><dt>Provider</dt><dd>{providerNames[task.provider ?? run.provider ?? 'codex']}</dd></div>
          <div><dt>Lượt gọi</dt><dd>{task.usageAttempts?.length ?? 0}{task.interruptions ? ` · ${task.interruptions} lần chen ngang` : ''}</dd></div>
          <div><dt>Token vào/ra</dt><dd>{formatTokens(task.inputTokens)} / {formatTokens(task.outputTokens)}</dd></div>
          {task.threadId && <div><dt>Phiên provider</dt><dd className="mono">{task.threadId.slice(0, 18)}</dd></div>}
        </dl>
      </aside>
    </div>
  </section>;
}
