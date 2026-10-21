import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, SlidersHorizontal, Wand2 } from 'lucide-react';
import { providerNames, type ProjectSession, type ProviderId, type ProviderStatus, type Run } from '../shared/contracts';
import { getWorkflow, workflows, type WorkflowId } from '../shared/workflows';
import { suggestWorkflow } from '../shared/suggest';
import { api, errorMessage } from './api';

const templates = [
  { label: 'Sửa lỗi', text: 'Sửa lỗi: <mô tả lỗi, cách tái hiện>. Tiêu chí xong: lỗi không còn và có test chứng minh.' },
  { label: 'Thêm tính năng', text: 'Thêm tính năng: <mô tả>. Tiêu chí xong: <hành vi mong đợi>. Không đổi API hiện có.' },
  { label: 'Review code', text: 'Review code trong thư mục này: tìm lỗi, rủi ro bảo mật và đề xuất cải thiện. Chỉ đọc.' },
  { label: 'Viết test', text: 'Viết test cho <module/hàm>, gồm trường hợp biên và lỗi; chạy test và báo kết quả.' },
  { label: 'Giải thích', text: 'Giải thích kiến trúc và luồng chính của dự án này cho người mới.' },
];
const memory = {
  read(): { sessionId?: string; provider?: ProviderId; writable?: boolean } { try { return JSON.parse(localStorage.getItem('office.quick') ?? '{}') as never; } catch { return {}; } },
  write(value: object) { try { localStorage.setItem('office.quick', JSON.stringify(value)); } catch { /* Convenience only. */ } },
};

/** One-box assignment: remembers project, provider and permission; suggests a workflow locally. */
export function QuickAssign({ providers, sessions, preferredSessionId, busyRun, onCreated, onOpenFull }: {
  providers: ProviderStatus[]; sessions: ProjectSession[]; preferredSessionId?: string; busyRun: boolean;
  onCreated: (run: Run) => void; onOpenFull: (draft: { goal: string; provider: ProviderId; workflowId: WorkflowId; writable: boolean }) => void;
}) {
  const saved = useRef(memory.read()).current;
  const [goal, setGoal] = useState('');
  const [sessionId, setSessionId] = useState(saved.sessionId ?? preferredSessionId ?? '');
  const [provider, setProvider] = useState<ProviderId>(saved.provider ?? 'codex');
  const [writable, setWritable] = useState(saved.writable ?? false);
  const [workflowId, setWorkflowId] = useState<WorkflowId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(crypto.randomUUID());
  const input = useRef<HTMLTextAreaElement>(null);
  const suggested = useMemo(() => suggestWorkflow(goal), [goal]);
  const chosenWorkflow = workflowId ?? suggested;
  const session = sessions.find(item => item.id === sessionId) ?? sessions.find(item => item.id === preferredSessionId) ?? sessions[0];
  const status = providers.find(item => item.id === provider);
  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') && !target?.isContentEditable) { event.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', focus); return () => window.removeEventListener('keydown', focus);
  }, []);
  function changed() { key.current = crypto.randomUUID(); setError(null); }
  async function submit() {
    if (busy || goal.trim().length < 5) return;
    if (!session) { onOpenFull({ goal, provider, workflowId: chosenWorkflow, writable }); return; }
    setBusy(true); setError(null);
    try {
      const result = await api.create({ goal: goal.trim(), workspace: session.workspace, sessionId: session.id, workflowId: chosenWorkflow, mode: writable ? 'workspace-write' : 'read-only', provider }, key.current);
      memory.write({ sessionId: session.id, provider, writable });
      setGoal(''); setWorkflowId(null); key.current = crypto.randomUUID();
      onCreated(result.data);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="quick-assign" aria-labelledby="quick-title">
    <div className="quick-heading"><h2 id="quick-title"><Wand2 size={16} />Giao việc nhanh</h2><span className="field-help">Nhấn <kbd>/</kbd> để gõ · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> để giao</span></div>
    <label className="visually-hidden" htmlFor="quick-goal">Mục tiêu công việc</label>
    <textarea id="quick-goal" ref={input} rows={2} maxLength={6000} value={goal} disabled={busy} placeholder={session ? `Giao cho đội ở “${session.name}”… Ví dụ: Sửa lỗi đăng nhập và thêm test` : 'Mô tả việc cần làm… (lần đầu sẽ hỏi thư mục dự án)'}
      onChange={event => { setGoal(event.target.value); changed(); }} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void submit(); } }} />
    <div className="quick-templates" aria-label="Mẫu nhanh">{templates.map(item => <button type="button" key={item.label} className="chip" disabled={busy} onClick={() => { setGoal(item.text); changed(); input.current?.focus(); }}>{item.label}</button>)}</div>
    <div className="quick-controls">
      <label className="quick-field"><span>Dự án</span><select value={session?.id ?? ''} disabled={busy || !sessions.length} onChange={event => { setSessionId(event.target.value); changed(); }}>
        {!sessions.length && <option value="">Chưa có phiên</option>}
        {sessions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label className="quick-field"><span>Quy trình{workflowId ? '' : ' · gợi ý'}</span><select value={chosenWorkflow} disabled={busy} onChange={event => { setWorkflowId(event.target.value as WorkflowId); changed(); }}>
        {workflows.map(item => <option key={item.id} value={item.id}>{item.name} · {item.steps.length}</option>)}
      </select></label>
      <div className="quick-field" role="radiogroup" aria-label="Provider"><span>Nhân viên AI</span><div className="segmented">
        {(['codex', 'claude'] as const).map(id => { const item = providers.find(entry => entry.id === id); return <button type="button" key={id} role="radio" aria-checked={provider === id} disabled={busy || !item} aria-describedby='quick-provider-help' onClick={() => { setProvider(id); changed(); }}>
          <span className={`status-dot ${item?.state === 'ready' ? 'ready' : 'unready'}`} />{providerNames[id]}</button>; })}
      </div></div>
      <label className="quick-toggle"><input type="checkbox" checked={writable} disabled={busy} onChange={event => { setWritable(event.target.checked); changed(); }} /><span>Cho sửa file</span></label>
      <button type="button" className="text-button" onClick={() => onOpenFull({ goal, provider, workflowId: chosenWorkflow, writable })} disabled={busy}><SlidersHorizontal size={14} />Tuỳ chọn đầy đủ</button>
      <button type="button" className="button primary" disabled={busy || goal.trim().length < 5 || busyRun || (session && status?.state !== 'ready')} onClick={() => void submit()}>{busy ? 'Đang giao…' : session ? 'Giao việc' : 'Chọn dự án & giao'}<ArrowUpRight size={16} /></button>
    </div>
    <p className="visually-hidden" id="quick-provider-help">{status?.message}</p>
    <p className="field-help quick-path">{getWorkflow(chosenWorkflow).steps.map(step => step.name).join(' → ')}{writable ? ' · chỉ vai trò thực hiện được sửa file' : ' · chỉ đọc'}</p>
    {busyRun && <p className="field-help" role="status">Đang có công việc chạy. Bạn có thể chen ngang bên phải, hoặc đợi xong để giao việc mới.</p>}
    {status && status.state !== 'ready' && session && <p className="form-error" role="status">{status.message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
