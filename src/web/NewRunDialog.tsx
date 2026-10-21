import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, FolderOpen, LockKeyhole, X } from 'lucide-react';
import { providerNames, type ProjectSession, type ProviderId, type ProviderStatus, type Run } from '../shared/contracts';
import { api, errorMessage } from './api';
import { FolderPicker } from './FolderPicker';
import { getWorkflow, workflows, type WorkflowId } from '../shared/workflows';
import { suggestWorkflow } from '../shared/suggest';

export interface RunDraft { goal: string; provider?: ProviderId; workflowId?: WorkflowId; writable?: boolean }
export function NewRunDialog({ providers, initialSessionId, draft, onClose, onCreated }: { providers: ProviderStatus[]; initialSessionId?: string; draft?: RunDraft; onClose: () => void; onCreated: (run: Run) => void }) {
  const initialGoal = draft?.goal ?? '';
  const dialog = useRef<HTMLDialogElement>(null);
  const [goal, setGoal] = useState(initialGoal);
  const [providerId, setProviderId] = useState<ProviderId>(() => { if (draft?.provider) return draft.provider; try { return (JSON.parse(localStorage.getItem('office.quick') ?? '{}') as { provider?: ProviderId }).provider ?? 'codex'; } catch { return 'codex'; } });
  const provider = providers.find(item => item.id === providerId);
  const [workspace, setWorkspace] = useState('');
  const [model, setModel] = useState('');
  const [workflowId, setWorkflowId] = useState<WorkflowId>(() => draft?.workflowId ?? (initialGoal ? suggestWorkflow(initialGoal) : 'software'));
  const [writable, setWritable] = useState(draft?.writable ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ProjectSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionCursor, setSessionCursor] = useState<string | null>(null);
  const [showFolders, setShowFolders] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const sessionKey = useRef(crypto.randomUUID());
  const requestKey = useRef(crypto.randomUUID());

  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void api.projectSessions(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setSessions(result.data); setSessionCursor(result.meta.nextCursor);
      const initial = result.data.find(item => item.id === initialSessionId);
      if (initial) { setSessionId(initial.id); setWorkspace(initial.workspace); setWorkflowId(initial.workflowId ?? 'quick'); }
    }).catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setSessionsLoading(false); });
    return () => controller.abort();
  }, [initialSessionId]);

  function changed(resetSession = false) { requestKey.current = crypto.randomUUID(); if (resetSession) sessionKey.current = crypto.randomUUID(); setError(null); }
  function chooseWorkspace(path: string) {
    setWorkspace(path); setWritable(false); setShowFolders(false);
    if (!sessionName.trim()) setSessionName((path.split(/[\\/]/).filter(Boolean).at(-1) ?? 'Dự án mới').slice(0, 80));
    changed(true);
  }
  async function moreSessions() {
    if (!sessionCursor || sessionsLoading) return;
    setSessionsLoading(true);
    try { const result = await api.projectSessions(undefined, sessionCursor); setSessions(current => [...current, ...result.data]); setSessionCursor(result.meta.nextCursor); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setSessionsLoading(false); }
  }
  async function persistSession() {
    const created = await api.createProjectSession({ name: sessionName.trim(), workspace: workspace.trim(), workflowId }, sessionKey.current);
    setSessions(current => [created.data, ...current.filter(session => session.id !== created.data.id)]);
    setSessionId(created.data.id); setWorkspace(created.data.workspace); setShowFolders(false); setSessionSaved(true);
    return created.data;
  }
  async function saveSessionOnly() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await persistSession(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let targetSessionId = sessionId;
      let targetWorkspace = workspace.trim();
      if (!targetSessionId) {
        const created = await persistSession();
        targetSessionId = created.id;
        targetWorkspace = created.workspace;
      }
      const result = await api.create({ goal: goal.trim(), workspace: targetWorkspace, sessionId: targetSessionId, workflowId, mode: writable ? 'workspace-write' : 'read-only', provider: providerId, ...(model ? { model } : {}) }, requestKey.current);
      onCreated(result.data);
    } catch (failure) { setError(errorMessage(failure)); setBusy(false); }
  }

  return <dialog ref={dialog} className="new-run-dialog" aria-labelledby="new-run-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}>
    <div className="dialog-top"><span className="eyebrow">MỘT MỤC TIÊU. MỘT ĐỘI NGŨ.</span><button type="button" className="icon-button" aria-label="Đóng" onClick={onClose} disabled={busy}><X size={20} /></button></div>
    <h2 id="new-run-title">Giao việc cho đội AI</h2>
    <p className="muted">Chọn quy trình phù hợp. Các vai trò nhận việc và bàn giao lần lượt.</p>
    <form onSubmit={event => void submit(event)}>
      <label htmlFor="project-session">Phiên dự án (session)</label>
      <select id="project-session" value={sessionId} disabled={busy || sessionsLoading} onChange={event => {
        const id = event.target.value, selected = sessions.find(item => item.id === id);
        setSessionId(id); setWorkspace(selected?.workspace ?? ''); setWorkflowId(selected ? selected.workflowId ?? 'quick' : 'software'); setWritable(false); setShowFolders(false); setSessionSaved(false); changed(true);
      }}>
        <option value="">+ Tạo phiên dự án mới</option>
        {sessions.map(session => <option key={session.id} value={session.id}>{session.name} — {session.workspace}</option>)}
      </select>
      {sessionCursor && <button type="button" className="text-button" onClick={() => void moreSessions()} disabled={busy || sessionsLoading}>Tải thêm phiên</button>}
      {!sessionId && <><label htmlFor="session-name">Tên phiên</label><input id="session-name" required maxLength={80} value={sessionName} placeholder="Ví dụ: Website bán hàng" disabled={busy} onChange={event => { setSessionName(event.target.value); changed(true); }} /></>}
      <p className="field-help">Mỗi phiên gắn với một thư mục và gom lịch sử công việc của dự án. Đây là phiên của Agent Office.</p>
      <label htmlFor="workflow">Quy trình làm việc</label>
      <select id="workflow" value={workflowId} disabled={busy} onChange={event => { setWorkflowId(event.target.value as WorkflowId); changed(true); }}>
        {workflows.map(workflow => <option key={workflow.id} value={workflow.id}>{workflow.name} · {workflow.steps.length} vai trò</option>)}
      </select>
      <p className="field-help">{getWorkflow(workflowId).description} {sessionId ? 'Lựa chọn này áp dụng cho công việc mới; quy trình mặc định của phiên được giữ nguyên.' : 'Quy trình được lưu làm mặc định cho phiên mới.'}</p>
      <p className="workflow-path">{getWorkflow(workflowId).steps.map(step => step.name).join(' → ')}</p>
      <details className="workflow-team"><summary>Xem phân công và quyền của {getWorkflow(workflowId).steps.length} vai trò</summary><ol className="workflow-preview" aria-label="Vai trò trong quy trình">{getWorkflow(workflowId).steps.map(step => <li key={step.role}><strong>{step.name}</strong><span>{step.specialty}</span><small>{step.writable ? 'Có thể ghi khi bạn cho phép' : 'Chỉ đọc'}</small></li>)}</ol></details>
      {workflowId === 'audit' && <p className="field-help">Trong mục tiêu, ghi loại kiểm toán, kỳ/phạm vi, tiêu chí áp dụng và hồ sơ đã cung cấp. Đầu ra là báo cáo hỗ trợ với phát hiện, dẫn chứng và kiến nghị.</p>}
      <p className="field-help">Mỗi vai trò dùng một lượt model riêng. Quy trình nhiều bước có thể dùng nhiều token hơn. Các mẫu hiện dùng tài liệu local, chưa có tìm kiếm web hay đăng bài tự động.</p>
      <label htmlFor="goal">Bạn muốn hoàn thành điều gì?</label>
      <textarea id="goal" required minLength={5} maxLength={6000} rows={5} placeholder="Mô tả mục tiêu, tiêu chí hoàn thành và các giới hạn cần tuân thủ…" value={goal} onChange={event => { setGoal(event.target.value); changed(); }} disabled={busy} />
      <label htmlFor="workspace"><FolderOpen size={15} /> Thư mục làm việc trên máy</label>
      <div className="workspace-picker-row"><input id="workspace" required minLength={3} maxLength={500} placeholder="E:\Projects\my-project" spellCheck={false} value={workspace} onChange={event => { setWorkspace(event.target.value); setWritable(false); changed(true); }} disabled={busy} readOnly={!!sessionId} aria-describedby="workspace-help" /><button type="button" className="button secondary" disabled={busy || !!sessionId} onClick={() => setShowFolders(value => !value)} aria-expanded={showFolders}><FolderOpen size={16} />Chọn thư mục</button></div>
      <p className="field-help" id="workspace-help">{sessionId ? 'Workspace đã gắn với phiên này. Chọn tạo phiên mới để dùng thư mục khác.' : 'Chọn bằng cây thư mục hoặc nhập đường dẫn tuyệt đối. Backend kiểm tra phạm vi trước khi chạy.'}</p>
      {showFolders && !sessionId && <FolderPicker selected={workspace} onSelect={chooseWorkspace} onClose={() => setShowFolders(false)} />}
      {!sessionId && <button type="button" className="button secondary save-session-button" disabled={busy || !sessionName.trim() || workspace.trim().length < 3} onClick={() => void saveSessionOnly()}>Lưu phiên, chưa chạy AI</button>}
      {sessionSaved && <p className="field-help" role="status">Phiên đã lưu trên máy. Chỉ gọi AI khi bạn bấm Bắt đầu công việc.</p>}
      <label htmlFor="provider">Nhân viên AI (provider)</label>
      <div className="segmented provider-choice" role="radiogroup" aria-label="Provider" id="provider">{(['codex', 'claude'] as const).map(id => { const item = providers.find(entry => entry.id === id); return <button type="button" role="radio" key={id} aria-checked={providerId === id} disabled={busy || !item} onClick={() => { setProviderId(id); setModel(''); changed(); }}><span className={`status-dot ${item?.state === 'ready' ? 'ready' : 'unready'}`} />{providerNames[id]}{item?.plan ? ` · ${item.plan}` : ''}</button>; })}</div>
      <p className="field-help">{providerId === 'claude' ? 'Claude Code: agent hỏi lại bạn ngay giữa chừng và nhận chỉ dẫn trực tiếp khi đang làm.' : 'Codex: câu hỏi được gửi khi agent kết thúc lượt; chen ngang sẽ dừng và làm lại bước.'}</p>
      <label htmlFor="model">Model {providerNames[providerId]}</label>
      <select id="model" value={model} onChange={event => { setModel(event.target.value); changed(); }} disabled={busy}>
        <option value="">Mặc định theo cấu hình {providerNames[providerId]}</option>
        {provider?.models.map(item => <option key={item.id} value={item.id}>{item.name}{item.isDefault ? ' · mặc định' : ''}</option>)}
      </select>
      <label className="permission-option"><input type="checkbox" checked={writable} onChange={event => { setWritable(event.target.checked); changed(); }} disabled={busy} /><span><strong>Cho phép sửa file trong thư mục này</strong><small>{writable ? 'Chỉ vai trò thực hiện được sửa file; QA và người review chỉ đọc.' : 'Mặc định chỉ đọc: phân tích và đề xuất, không sửa file.'}</small></span></label>
      <p className="field-help privacy-note"><LockKeyhole size={14} /> Dùng phiên đăng nhập {providerNames[providerId]} trên máy (thuê bao). Không tự chuyển sang thanh toán API.</p>
      {provider?.state !== 'ready' && <p className="form-error" role="status">{provider?.message ?? 'Chưa xác minh kết nối provider. Đóng cửa sổ và làm mới kết nối trước.'}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Để sau</button><button className="button primary" type="submit" disabled={busy || sessionsLoading || provider?.state !== 'ready'}>{busy ? 'Đang giao việc…' : 'Bắt đầu công việc'}<ArrowUpRight size={17} /></button></div>
    </form>
  </dialog>;
}
