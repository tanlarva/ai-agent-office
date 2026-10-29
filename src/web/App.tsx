import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Activity, ArrowUpRight, Bell, BellOff, BellRing, Bot, Box, Check, ChevronRight, Circle, Code2, Cpu, FileCheck2, Flower2, FolderOpen, History, Layers3, LoaderCircle, MessageCircleQuestion, Plus, Pause, Play, Radio, RefreshCw, ShieldCheck, Sparkles, Square, Terminal, TriangleAlert, WifiOff, X } from 'lucide-react';
import { providerNames, terminalStates, type Approval, type AttentionItem, type OfficeEvent, type ProviderStatus, type Run, type SchedulingStatus, type State } from '../shared/contracts';
import { api, errorMessage } from './api';
import { formatDate, formatTime, formatTokens, rolesForRun, stateLabels } from './labels';
import { officeThemeForRun } from '../shared/office-scene';
import { resumableTaskIndex } from '../shared/retries';
import { SceneBoundary } from './SceneBoundary';
import { OfficePreviewDialog } from './OfficePreviewDialog';
import { NewRunDialog, type RunDraft } from './NewRunDialog';
import { QuickAssign } from './QuickAssign';
import { InquiryCard } from './InquiryCard';
import { InterjectPanel } from './InterjectPanel';
import { DebugConsole } from './DebugConsole';
import { useOffice } from './useOffice';
import { useAttention } from './useAttention';
import { useAppearance } from './useAppearance';
import { AnimePortrait } from './AnimePortrait';
import { AnimeCastCredits } from './AnimeCastCredits';

const OfficeScene = lazy(() => import('./OfficeScene'));

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = () => setReduced(query.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  return reduced;
}

function StateBadge({ state }: { state: State }) {
  return <span className={`state-badge state-${state}`}><span className="status-dot" />{stateLabels[state]}</span>;
}

function ApprovalCard({ approval, run, onUpdated }: { approval: Approval; run: Run; onUpdated: (run: Run) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function decide(decision: 'accept' | 'decline') {
    setBusy(true); setError(null);
    try { const result = await api.decide(approval.id, decision, run.version); onUpdated(result.data); }
    catch (failure) {
      setError(errorMessage(failure));
      // A stale approval version must be reviewed again; never retry acceptance automatically.
      try { const current = await api.run(run.id); onUpdated(current.data); }
      catch (refreshFailure) { setError(`${errorMessage(failure)} Không thể đồng bộ lại: ${errorMessage(refreshFailure)}`); }
    }
    finally { setBusy(false); }
  }
  return <section className="approval-card" aria-label="Yêu cầu phê duyệt">
    <span className="eyebrow"><ShieldCheck size={14} /> CẦN QUYẾT ĐỊNH CỦA BẠN</span>
    <h3>Agent đang chờ phê duyệt</h3>
    <p className="pre-wrap">{approval.description}</p>
    <dl className="approval-details"><div><dt>Thao tác</dt><dd>{approval.method}</dd></div><div><dt>Thư mục</dt><dd>{run.workspace}</dd></div></dl>
    <div className="approval-buttons"><button className="button secondary" disabled={busy} onClick={() => void decide('decline')}><X size={15} />Từ chối</button><button className="button primary" disabled={busy} onClick={() => void decide('accept')}><Check size={15} />{busy ? 'Đang gửi…' : 'Cho phép'}</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}

function RetryRun({ run, onCreated }: { run: Run; onCreated: (run: Run) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(crypto.randomUUID());
  const index = resumableTaskIndex(run);
  if (index < 0) return null;
  const role = rolesForRun(run)[index];
  async function retry() {
    setBusy(true); setError(null);
    try { onCreated((await api.retry(run.id, run.version, key.current)).data); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="retry-panel"><p>Giữ bàn giao các bước đã xong. Chạy tiếp các bước còn lại ở chế độ chỉ đọc, theo thời gian chờ của bộ điều tiết.</p><button className="button secondary full-width" disabled={busy} onClick={() => void retry()}>{busy ? 'Đang chuẩn bị…' : 'Chạy tiếp từ ' + role?.name}</button>{error && <p className="form-error" role="alert">{error}</p>}</section>;
}

function RoleBoard({ run, onFocus, anime }: { run: Run | null; onFocus: (taskId: string) => void; anime: boolean }) {
  const roles = rolesForRun(run);
  return <div className="role-board" aria-label="Bảng trạng thái agent">
    {roles.map((role, index) => {
      const tasks = run?.tasks.filter(task => task.role === role.id) ?? [];
      const task = tasks.find(item => !terminalStates.has(item.state)) ?? tasks.at(-1);
      const Icon = role.id === 'orchestrator' ? Layers3 : ['developer', 'builder'].includes(role.id) ? Code2 : FileCheck2;
      const live = task && ['running', 'waiting_input', 'waiting_approval'].includes(task.state);
      return <article key={role.id} className={`role-card ${live ? 'is-active' : ''} ${task?.state === 'waiting_input' ? 'is-asking' : ''}`} style={{ '--role-color': role.color } as CSSProperties}>
        <div className="role-card-heading"><span className={`role-avatar ${anime ? 'portrait-avatar' : ''}`}>{anime ? <AnimePortrait variant={index} /> : <Icon size={21} />}</span><span><h3>{role.name}</h3><small>{role.specialty}</small></span><span className="role-number">0{index + 1}</span></div>
        <div className="role-state">{task ? <StateBadge state={task.state} /> : <span className="idle-state"><Circle size={11} />Chưa có nhiệm vụ</span>}</div>
        {task?.activity && task.state === 'running' && <p className="role-activity" title={task.activity}><span className="caret" />{task.activity}</p>}
        {task && <button className="text-button role-screen-button" onClick={() => onFocus(task.id)}><Terminal size={13} />Xem màn hình</button>}
        {tasks.length ? tasks.map(item => <details key={item.id} className="task-detail"><summary>{item.title}<ChevronRight size={14} /></summary><p className="pre-wrap">{item.summary || 'Chưa có kết quả từ agent.'}</p><span className="task-tokens">{item.inheritedFromTaskId ? 'Kế thừa bàn giao từ lượt trước · ' : ''}{item.usageAttempts?.length ? `Lượt gọi: ${item.usageAttempts.length} · ` : ''}Token vào: {formatTokens(item.inputTokens)}<br />Token ra: {formatTokens(item.outputTokens)}</span></details>) : <p className="role-placeholder">{run ? 'Sẽ nhận việc khi đến lượt trong kế hoạch.' : 'Sẵn sàng khi bạn giao công việc đầu tiên.'}</p>}
      </article>;
    })}
  </div>;
}

const eventNames: Record<string, string> = {
  'capacity.waiting': 'Chờ bộ điều tiết', 'capacity.dispatched': 'Đã đến lượt gọi', 'capacity.retry_scheduled': 'Đã lên lịch thử lại',
  'run.created': 'Đã nhận mục tiêu', 'run.started': 'Bắt đầu công việc', 'run.completed': 'Kết thúc công việc',
  'run.succeeded': 'Đã hoàn thành', 'run.failed': 'Công việc gặp lỗi', 'run.canceled': 'Đã hủy công việc',
  'task.started': 'Agent bắt đầu làm việc', 'task.completed': 'Agent đã bàn giao', 'task.updated': 'Cập nhật nhiệm vụ',
  'approval.requested': 'Đang chờ phê duyệt', 'approval.decided': 'Đã nhận quyết định',
  'agent.assigned': 'Đã kết nối agent', 'agent.turn_started': 'Agent bắt đầu xử lý', 'agent.todos': 'Agent cập nhật checklist',
  'usage.updated': 'Cập nhật mức sử dụng', 'tool.started': 'Bắt đầu công cụ', 'tool.completed': 'Công cụ đã kết thúc',
  'artifact.created': 'Có thay đổi trong workspace', 'approval.resolved': 'Đã nhận quyết định',
  'agent.message_delta': 'Cập nhật từ agent', 'task.state_changed': 'Cập nhật nhiệm vụ', 'run.state_changed': 'Cập nhật công việc',
  'inquiry.requested': 'Agent hỏi bạn', 'inquiry.answered': 'Bạn đã trả lời', 'user.note': 'Bạn gửi chỉ dẫn', 'task.redirected': 'Làm lại theo chỉ dẫn',
  'request.expired': 'Yêu cầu đã hết hạn', 'provider.retry': 'Provider thử lại', 'provider.limit': 'Thông tin hạn mức',
};
function EventItem({ event }: { event: OfficeEvent }) {
  const summary = ['summary', 'message', 'title', 'description', 'text', 'command'].map(key => event.payload[key]).find(value => typeof value === 'string');
  return <li className="event-item"><span className="event-marker" /><div><div className="event-meta"><span>{eventNames[event.type] ?? event.type}</span><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></div>{typeof summary === 'string' && <p>{summary.slice(0, 400)}</p>}<details><summary>Chi tiết sự kiện #{event.sequence}</summary><pre>{JSON.stringify(event.payload, null, 2)}</pre></details></div></li>;
}

function ProviderCard({ provider, scheduling, id, onRefresh, loading }: { provider: ProviderStatus | undefined; scheduling: SchedulingStatus | undefined; id: 'codex' | 'claude'; onRefresh: () => void; loading: boolean }) {
  return <div className="provider-card"><div className="provider-top"><span className={`provider-logo provider-${id}`}>{id === 'claude' ? <Sparkles size={17} /> : <Terminal size={17} />}</span><div><strong>{providerNames[id]}</strong><small>{provider?.plan ?? (provider ? 'Tài khoản trên máy' : 'Chưa bật')}</small></div><span className={`status-dot ${provider?.state === 'ready' ? 'ready' : 'unready'}`} /></div>
    <p>{provider?.message ?? `Đang kiểm tra ${providerNames[id]}…`}</p>
    {provider?.limits?.usedPercent != null && <div className="usage"><div><span>Hạn mức đã dùng</span><strong>{Math.round(provider.limits.usedPercent)}%</strong></div><progress value={provider.limits.usedPercent} max={100} aria-label={`Hạn mức ${providerNames[id]} đã dùng`} /></div>}
    {scheduling?.cooldownUntil && <p className="field-help">Thử sớm nhất: {formatDate(scheduling.cooldownUntil)}</p>}
    <div className="provider-footer"><span><Cpu size={12} />{provider?.billingMode === 'chatgpt' ? 'Phiên ChatGPT' : provider?.billingMode === 'claude_subscription' ? 'Thuê bao Claude' : provider?.billingMode === 'apiKey' ? 'API key · bị chặn' : 'Chưa rõ loại phiên'}{scheduling ? ` · giãn ${scheduling.minGapMs / 1000}s` : ''}</span><button className="text-button" onClick={onRefresh} disabled={loading} aria-label={`Làm mới trạng thái ${providerNames[id]}`}><RefreshCw size={14} /></button></div></div>;
}

export default function App() {
  const office = useOffice();
  const { appearance, setAppearance } = useAppearance();
  const anime = appearance === 'anime';
  const [newRun, setNewRun] = useState<RunDraft | null>(null);
  const [view3D, setView3D] = useState(true);
  const [motionPaused, setMotionPaused] = useState(false);
  const [showOfficePreview, setShowOfficePreview] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [actionFailure, setActionFailure] = useState<{ runId: string; message: string } | null>(null);
  const reducedMotion = useReducedMotion();
  const missionRef = useRef<HTMLElement>(null);
  const debugRef = useRef<HTMLDivElement>(null);
  const run = office.run;
  const attention = useAttention(item => openAttention(item));
  const runProvider = office.providers.find(item => item.id === (run?.provider ?? 'codex'));
  const roles = rolesForRun(run);
  const officeTheme = officeThemeForRun(run);
  const actionError = actionFailure?.runId === run?.id ? actionFailure?.message : null;
  const activeTasks = run?.tasks.filter(task => task.state === 'running').length ?? 0;
  const completedTasks = run?.tasks.filter(task => task.state === 'succeeded').length ?? 0;
  const tokensKnown = !!run?.tasks.length && run.tasks.every(task => task.inputTokens !== null && task.outputTokens !== null);
  const totalTokens = tokensKnown && run ? run.tasks.reduce((total, task) => total + task.inputTokens! + task.outputTokens!, 0) : null;
  const pendingApprovals = run?.approvals.filter(item => item.state === 'pending') ?? [];
  const pendingInquiries = run?.inquiries?.filter(item => item.state === 'pending') ?? [];
  const busyRun = office.runs.some(item => !terminalStates.has(item.state));

  // Keep the inbox in sync when the selected run changes state (answers, expiries).
  useEffect(() => { void attention.refresh(); }, [run?.version]);

  function openAttention(item: AttentionItem) {
    if (office.selectedId !== item.runId) office.selectRun(item.runId);
    attention.dismissToast();
    setTimeout(() => missionRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' }), 60);
  }
  function focusTask(taskId: string) {
    setFocusTaskId(taskId);
    setTimeout(() => debugRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' }), 30);
  }
  async function cancelRun() {
    if (!run || cancelBusy) return;
    setCancelBusy(true); setActionFailure(null);
    try { const result = await api.cancel(run.id); office.upsertRun(result.data); }
    catch (failure) { setActionFailure({ runId: run.id, message: errorMessage(failure) }); }
    finally { setCancelBusy(false); }
  }

  const connectionLabel = office.loading ? 'Đang kết nối' : office.error ? 'Mất kết nối backend' : office.connection === 'live' ? 'Đang đồng bộ trực tiếp' : office.connection === 'reconnecting' ? 'Đang kết nối lại' : office.connection === 'connecting' ? 'Đang đồng bộ' : 'Backend đã kết nối';
  const readyProviders = office.providers.filter(item => item.state === 'ready').length;

  return <div className="app-shell" data-appearance={appearance}>
    <a className="skip-link" href="#main">Chuyển đến nội dung chính</a>
    <aside className="sidebar" aria-label="Lịch sử và kết nối">
      <a className="brand" href="#main" aria-label="AI Agent Office"><span className="brand-icon"><Box size={24} strokeWidth={1.5} /></span><span>agent<span className="brand-light">office</span><small>YOUR LOCAL AI WORKSPACE</small></span></a>
      <button className="button new-task-button" onClick={() => setNewRun({ goal: '' })} disabled={office.loading || !!office.error}><Plus size={18} />Giao việc mới<span className="button-key">↗</span></button>
      {attention.items.length > 0 && <section className="inbox" aria-labelledby="inbox-title">
        <div className="sidebar-label" id="inbox-title"><MessageCircleQuestion size={14} />CẦN BẠN TRẢ LỜI<span className="inbox-count">{attention.items.length}</span></div>
        {attention.items.map(item => <button key={item.id} className={`inbox-item kind-${item.kind}`} onClick={() => openAttention(item)}><strong>{item.role} {item.kind === 'inquiry' ? 'hỏi' : 'xin phép'}</strong><span>{item.title}</span><small>{formatTime(item.requestedAt)} · {providerNames[item.provider]}</small></button>)}
      </section>}
      <div className="project-session-filter"><label htmlFor="history-session">PHIÊN DỰ ÁN</label><select id="history-session" value={office.sessionFilter} onChange={event => office.filterSession(event.target.value)} disabled={office.loading}><option value="">Tất cả phiên</option>{office.sessions.map(session => <option key={session.id} value={session.id}>{session.name}</option>)}</select>{office.sessionCursor && <button type="button" className="text-button" onClick={() => void office.loadMoreSessions()}>Tải thêm phiên</button>}</div><div className="sidebar-label"><History size={14} />CÔNG VIỆC GẦN ĐÂY<span>{office.runs.length}</span></div>
      <nav className="run-history" aria-label="Chọn công việc">
        {office.loading && <p className="history-empty">Đang tải lịch sử…</p>}
        {!office.loading && !office.runs.length && <div className="history-empty"><span className="empty-history-icon"><Layers3 size={23} /></span><p>Mọi ý tưởng bắt đầu<br />từ một công việc.</p></div>}
        {office.runs.map(item => <button key={item.id} className={`history-item ${item.id === office.selectedId ? 'selected' : ''}`} aria-current={item.id === office.selectedId ? 'true' : undefined} onClick={() => office.selectRun(item.id)}><span className={`history-dot state-${item.state}`} /><span><strong>{item.goal}</strong><small>{formatDate(item.createdAt)}<span>{providerNames[item.provider ?? 'codex']} · {stateLabels[item.state]}</span></small></span></button>)}
      </nav>
      {(['codex', 'claude'] as const).map(id => <ProviderCard key={id} id={id} provider={office.providers.find(item => item.id === id)} scheduling={office.scheduling[id]} onRefresh={office.refresh} loading={office.loading} />)}
      <div className="local-note"><span className="status-dot ready" />LOCAL WINDOWS<span>v0.6</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div><span className="breadcrumb">Không gian làm việc<ChevronRight size={14} /><strong>Tổng quan</strong></span><h1>Văn phòng AI của bạn<span className="header-dot">.</span></h1></div>
        <div className="appearance-switch" role="group" aria-label="Phong cách giao diện">
          <button type="button" aria-pressed={anime} onClick={() => setAppearance('anime')}><Flower2 size={14} aria-hidden="true" />Anime</button>
          <button type="button" aria-pressed={!anime} onClick={() => setAppearance('classic')}>Cổ điển</button>
        </div>
        <button className="button primary mobile-new" onClick={() => setNewRun({ goal: '' })} disabled={office.loading || !!office.error}><Plus size={17} /><span>Giao việc</span></button>
        <div className="connection-controls">
          <button className={`bell ${attention.items.length ? 'has-items' : ''}`} onClick={() => attention.items[0] && openAttention(attention.items[0])} aria-label={attention.items.length ? `${attention.items.length} yêu cầu cần bạn trả lời` : 'Không có câu hỏi đang chờ'} title="Câu hỏi và phê duyệt đang chờ">{attention.items.length ? <BellRing size={15} /> : <Bell size={15} />}{attention.items.length > 0 && <span>{attention.items.length}</span>}</button>
          {attention.notifications.supported && <button className="text-button" aria-pressed={attention.notifications.enabled} onClick={() => attention.notifications.enabled ? attention.notifications.disable() : void attention.notifications.enable()} title="Thông báo của Windows khi agent hỏi lúc bạn ở tab khác">{attention.notifications.enabled ? <BellRing size={14} /> : <BellOff size={14} />}{attention.notifications.enabled ? 'Đã bật thông báo' : 'Bật thông báo'}</button>}
          <span className={`connection ${office.connection === 'live' ? 'connected' : ''}`} role="status">{office.error || office.connection === 'reconnecting' ? <WifiOff size={14} /> : <Radio size={14} />}{connectionLabel}</span><button className="text-button" aria-label="Đồng bộ lại kết nối và provider" title="Đồng bộ lại kết nối và provider" disabled={office.loading} onClick={office.refresh}><RefreshCw size={14} /></button></div>
      </header>
      <main id="main" tabIndex={-1}>
        {office.error && <div className="error-banner" role="alert"><TriangleAlert size={19} /><div><strong>Không thể kết nối văn phòng</strong><p>{office.error}</p></div><button className="button secondary" onClick={office.refresh}>Thử lại</button></div>}
        <div className={`overview-heading ${anime ? 'anime-welcome' : ''}`}><div><span className="eyebrow">{anime ? <><Sparkles size={13} aria-hidden="true" />SAKURA STUDIO</> : 'MISSION CONTROL'}</span><h2>{run ? 'Đội ngũ đang ở đây.' : anime ? 'Cùng đội nhỏ, làm điều lớn.' : 'Ý tưởng của bạn. Đội ngũ của bạn.'}</h2><p>{run ? 'Theo dõi công việc thực tế, trả lời câu hỏi và chen ngang khi cần.' : 'Gõ việc cần làm bên dưới; đội AI lập kế hoạch, làm và tự kiểm tra.'}</p></div><div className="overview-meta">{anime && <div className="welcome-portrait"><AnimePortrait /></div>}<span><span className="status-dot ready" />{readyProviders}/{office.providers.length || 2} PROVIDER SẴN SÀNG</span><span>{roles.length} VAI TRÒ</span></div></div>
        {!office.loading && !office.error && <QuickAssign providers={office.providers} sessions={office.sessions} preferredSessionId={office.sessionFilter || run?.sessionId} busyRun={busyRun} onCreated={office.showCreated} onOpenFull={setNewRun} />}
        <div className="control-layout">
          <div className="office-column">
            <section className="office-view" aria-labelledby="office-title"><div className="scene-topbar"><div><span className="status-dot" /><h3 id="office-title">{officeTheme.name}</h3><span className="scene-label">{run ? 'TRẠNG THÁI THỰC' : 'CHƯA CÓ CÔNG VIỆC'}</span></div><div className="view-switch" aria-label="Chế độ xem"><button aria-pressed={view3D} onClick={() => setView3D(true)}><Box size={14} />3D</button><button aria-pressed={!view3D} onClick={() => setView3D(false)}><Layers3 size={14} />2D</button></div></div>
              {view3D ? <div className="scene-canvas"><SceneBoundary><Suspense fallback={<div className="scene-fallback"><LoaderCircle size={24} className="spinner" />Đang mở văn phòng…</div>}>{!showOfficePreview && <OfficeScene run={run} events={office.events} anime={anime} reducedMotion={reducedMotion || motionPaused} focusTaskId={focusTaskId} onSelectTask={focusTask} />}</Suspense></SceneBoundary><div className="scene-corner">{officeTheme.id.toUpperCase()} <span>0{roles.length}</span></div><div className="scene-hint">Kéo để xoay · cuộn để phóng · bấm nhân viên để xem màn hình</div></div> : <div className="office-map" aria-label="Sơ đồ văn phòng 2D">{roles.map((role, index) => { const task = run?.tasks[index]; return <button type="button" className={`map-station state-${task?.state ?? 'idle'}`} key={role.id} style={{ '--role-color': role.color } as CSSProperties} disabled={!task} onClick={() => task && focusTask(task.id)}><span>{anime ? <AnimePortrait variant={index} /> : <Bot size={34} />}</span><strong>{role.name}</strong><small>{task ? stateLabels[task.state] : 'Chờ nhiệm vụ'}</small>{task?.activity && <em>{task.activity}</em>}</button>; })}<div className="map-caption">Mỗi vai trò là một bước trong quy trình; bấm để xem màn hình làm việc.</div></div>}
              <div className="scene-controls"><div><strong>{officeTheme.description}</strong><p>Gõ phím khi làm · giơ tay khi hỏi bạn · mang hồ sơ đi bàn giao khi xong.</p></div><div className="scene-control-buttons"><button className="text-button" onClick={() => setShowOfficePreview(true)}>Tham quan văn phòng<ArrowUpRight size={13} /></button><button className="text-button motion-toggle" disabled={reducedMotion || !view3D} aria-pressed={motionPaused || reducedMotion} onClick={() => setMotionPaused(value => !value)}>{motionPaused || reducedMotion ? <Play size={14} /> : <Pause size={14} />}{reducedMotion ? 'Giảm chuyển động theo thiết bị' : motionPaused ? 'Bật chuyển động' : 'Dừng chuyển động'}</button></div></div>{anime && <AnimeCastCredits />}<div className="scene-footer"><span><span className="status-dot ready" />Dữ liệu từ runtime trên máy</span><span>{activeTasks} đang làm<span className="footer-separator">/</span>{completedTasks} đã xong</span></div>
            </section>
            {run && <div ref={debugRef}><DebugConsole run={run} events={office.events} focusTaskId={focusTaskId} onFocus={setFocusTaskId} /></div>}
            <div className="section-title"><h2><Bot size={17} />Đội ngũ của bạn</h2><span>{roles.length} vai trò · {run?.workflow?.name ?? (run ? 'Tổng quát' : 'Phát triển phần mềm')}</span></div>
            <RoleBoard run={run} onFocus={focusTask} anime={anime} />
            <section className="activity-panel" aria-labelledby="activity-title"><div className="section-title"><h2 id="activity-title"><Activity size={17} />Nhật ký hoạt động</h2><span>{office.events.length ? `${office.events.length} sự kiện gần nhất` : 'Chưa có sự kiện'}</span></div>{office.eventError && <p className="inline-warning" role="alert"><TriangleAlert size={15} />{office.eventError}<button className="text-button" onClick={office.refresh}>Đồng bộ lại</button></p>}{office.detailLoading ? <p className="empty-activity">Đang đồng bộ công việc…</p> : office.events.length ? <ol className="event-list">{[...office.events].reverse().filter(event => event.type !== 'agent.message_delta').slice(0, 150).map(event => <EventItem key={event.eventId} event={event} />)}</ol> : <div className="empty-activity"><Radio size={22} /><p>{run ? 'Sự kiện sẽ hiển thị khi runtime có cập nhật.' : 'Các bước làm việc sẽ xuất hiện ở đây.'}</p><span>Không có hoạt động mô phỏng.</span></div>}</section>
          </div>
          <aside className="mission-panel" aria-label="Chi tiết công việc" ref={missionRef}>{run ? <><div className="mission-title"><span className="eyebrow">CÔNG VIỆC ĐƯỢC CHỌN</span><StateBadge state={run.state} /></div><h2>{run.goal}</h2><div className="mission-path"><FolderOpen size={15} /><span>{run.workspace}</span></div>
            {pendingInquiries.map(inquiry => <InquiryCard key={inquiry.id} inquiry={inquiry} run={run} onUpdated={office.upsertRun} />)}
            {pendingApprovals.map(approval => <ApprovalCard key={approval.id} approval={approval} run={run} onUpdated={office.upsertRun} />)}
            <InterjectPanel run={run} provider={runProvider} onUpdated={office.upsertRun} />
            <dl className="mission-details"><div><dt>Phiên dự án</dt><dd>{run.sessionName ?? 'Chưa gắn phiên'}</dd></div><div><dt>Quy trình</dt><dd>{run.workflow?.name ?? 'Tổng quát · phiên cũ'}</dd></div><div><dt>Nhân viên AI</dt><dd>{providerNames[run.provider ?? 'codex']}</dd></div><div><dt>Quyền truy cập</dt><dd>{run.mode === 'read-only' ? 'Chỉ đọc' : 'Được sửa file'}</dd></div><div><dt>Model</dt><dd>{run.model ?? 'Mặc định'}</dd></div><div><dt>Bắt đầu</dt><dd>{formatDate(run.createdAt)}</dd></div><div><dt>Token vào + ra</dt><dd>{formatTokens(totalTokens)}</dd></div></dl>{totalTokens === null && <p className="field-help token-note">Chỉ hiện số liệu provider trả về; chưa đủ dữ liệu để tính tổng.</p>}{run.waiting && <div className="capacity-notice" role="status"><strong>{run.waiting.reason === 'rate_limit' ? `Đang chờ ${providerNames[run.provider ?? 'codex']} cho phép gọi tiếp` : 'Đang giãn lượt gọi'}</strong><p>Lượt {run.waiting.attempt}. Thử sớm nhất: {formatTime(run.waiting.until)}. Bạn vẫn có thể dừng công việc.</p></div>}{run.retryOfRunId && <p className="field-help">Lượt tiếp tục giữ bàn giao từ run {run.retryOfRunId.slice(0, 8)}; các bước đã xong không gọi lại model.</p>}{run.error && <p className="run-error" role="alert">{run.error}</p>}<RetryRun key={run.id} run={run} onCreated={office.showCreated} /><div className="workflow"><h3>QUY TRÌNH LÀM VIỆC</h3>{roles.map((role, index) => { const task = run.tasks[index]; const state = task?.state; return <button type="button" className="workflow-step" key={role.id} onClick={() => task && focusTask(task.id)}><span className={`workflow-step-icon ${state === 'succeeded' ? 'done' : state === 'running' ? 'active' : state === 'waiting_input' ? 'asking' : ''}`}>{state === 'succeeded' ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span><span><strong>{role.name}</strong><small>{state ? stateLabels[state] : 'Chưa bắt đầu'}</small></span></button>; })}</div>{!terminalStates.has(run.state) && <button className="button cancel-button" onClick={() => void cancelRun()} disabled={cancelBusy || run.state === 'canceling'}><Square size={13} />{cancelBusy || run.state === 'canceling' ? 'Đang yêu cầu dừng…' : 'Dừng công việc'}</button>}{actionError && <p role="alert" className="form-error">{actionError}</p>}<p className="run-identifier">RUN / {run.id}</p></> : <><span className="eyebrow">BẮT ĐẦU TỪ MỘT MỤC TIÊU</span><div className="empty-mission-art">{anime ? <AnimePortrait variant={1} /> : <><Layers3 size={42} strokeWidth={1} /><span className="orbit orbit-one" /><span className="orbit orbit-two" /></>}</div><h2>Một người giao việc.<br />Cả đội cùng giải quyết.</h2><p className="empty-mission-copy">Bạn giữ tầm nhìn. Các agent Codex hoặc Claude chia nhau lập kế hoạch, thực hiện và review — ngay trong dự án trên máy.</p><button className="button primary full-width" onClick={() => setNewRun({ goal: '' })} disabled={office.loading || !!office.error}>Giao việc đầu tiên<ArrowUpRight size={17} /></button><div className="getting-started"><h3>CÁCH VĂN PHÒNG HOẠT ĐỘNG</h3><p><span>01</span>Chọn thư mục dự án và mô tả mục tiêu.</p><p><span>02</span>Agent hỏi lại khi thiếu thông tin — bạn trả lời ngay tại đây.</p><p><span>03</span>Xem màn hình từng nhân viên, chen ngang nếu sai hướng.</p></div><div className="local-first"><ShieldCheck size={21} /><div><strong>Bạn kiểm soát quyền truy cập</strong><p>Mặc định chỉ đọc. Việc sửa file cần được bạn cho phép khi giao việc.</p></div></div></>}</aside>
        </div>
        <footer className="page-footer"><span>AI AGENT OFFICE <span className="footer-separator">/</span> PERSONAL EDITION</span><span>3D quan sát công việc. Không tạo thêm lời gọi AI.</span></footer>
      </main>
    </div>
    {attention.toast && <div className="attention-toast" role="alert"><MessageCircleQuestion size={18} /><div><strong>{attention.toast.role} {attention.toast.kind === 'inquiry' ? 'đang hỏi bạn' : 'cần bạn phê duyệt'}</strong><p>{attention.toast.title}</p></div><button className="button primary" onClick={() => openAttention(attention.toast!)}>Trả lời</button><button className="icon-button" aria-label="Đóng thông báo" onClick={attention.dismissToast}><X size={16} /></button></div>}
    {showOfficePreview && <OfficePreviewDialog anime={anime} initialTheme={officeTheme.id} reducedMotion={reducedMotion} onClose={() => setShowOfficePreview(false)} />}
    {newRun && <NewRunDialog providers={office.providers} draft={newRun} initialSessionId={office.sessionFilter || run?.sessionId} onClose={() => { setNewRun(null); office.refresh(); }} onCreated={created => { office.showCreated(created); setNewRun(null); }} />}
  </div>;
}
