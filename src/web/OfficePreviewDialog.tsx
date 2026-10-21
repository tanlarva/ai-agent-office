import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, LoaderCircle, RotateCcw, X } from 'lucide-react';
import type { Run } from '../shared/contracts';
import { officeThemes } from '../shared/office-scene';
import { getWorkflow, workflows, type WorkflowId } from '../shared/workflows';
import { stateLabels } from './labels';
import { SceneBoundary } from './SceneBoundary';

const OfficeScene = lazy(() => import('./OfficeScene'));
export function OfficePreviewDialog({ initialTheme, reducedMotion, onClose }: { initialTheme: WorkflowId; reducedMotion: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [themeId, setThemeId] = useState(initialTheme), [progress, setProgress] = useState(0), [epoch, setEpoch] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const workflow = getWorkflow(themeId), theme = officeThemes[themeId];
  // A local illustration only: never sent to the runtime, persisted, or counted as AI work.
  const preview: Run = {
    id: `preview-${themeId}-${epoch}`, goal: 'DEMO chuyển động', workspace: '', mode: 'read-only', state: progress >= workflow.steps.length ? 'succeeded' : 'running',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 1, lastSequence: 0, approvals: [], error: null, workflow,
    tasks: workflow.steps.map((step, index) => ({ id: `preview-task-${index}`, role: step.role, title: step.name, state: index < progress ? 'succeeded' : index === progress ? 'running' : 'queued', summary: '', inputTokens: null, outputTokens: null })),
  };
  function reset() { setProgress(0); setEpoch(value => value + 1); }
  return <dialog ref={dialog} className="new-run-dialog office-preview-dialog" aria-labelledby="preview-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="dialog-top"><span className="eyebrow">THAM QUAN · KHÔNG GỌI AI</span><button className="icon-button" aria-label="Đóng tham quan" onClick={onClose}><X size={19} /></button></div>
    <h2 id="preview-title">Mỗi đội, một không gian.</h2>
    <p className="preview-intro">Đây là minh hoạ cục bộ. Không tạo công việc, không đọc dự án và không dùng token.</p>
    <label htmlFor="preview-workflow">Chọn văn phòng</label>
    <select id="preview-workflow" value={themeId} onChange={event => { setThemeId(event.target.value as WorkflowId); reset(); }}>{workflows.map(item => <option key={item.id} value={item.id}>{officeThemes[item.id].name} · {item.steps.length} vai trò</option>)}</select>
    <div className="preview-room"><div className="preview-room-heading"><strong>{theme.name}</strong><span>DEMO</span></div><div className="preview-canvas" aria-hidden="true"><SceneBoundary key={themeId}><Suspense fallback={<div className="scene-fallback"><LoaderCircle size={24} className="spinner" />Đang mở phòng…</div>}><OfficeScene run={preview} reducedMotion={reducedMotion || paused} /></Suspense></SceneBoundary></div></div>
    <p className="preview-caption">{theme.description}. Bấm bàn giao để thấy nhân vật đi qua lối trống, chuyển hồ sơ rồi trở về.</p>
    <div className="preview-actions"><button className="button primary" onClick={() => setProgress(value => Math.min(value + 1, workflow.steps.length))} disabled={progress >= workflow.steps.length}>Bàn giao bước tiếp<ArrowUpRight size={15} /></button><button className="button secondary" onClick={reset}><RotateCcw size={14} />Làm lại</button><button className="text-button" disabled={reducedMotion} onClick={() => setPaused(value => !value)}>{reducedMotion ? 'Theo chế độ giảm chuyển động' : paused ? 'Bật chuyển động' : 'Dừng chuyển động'}</button></div>
    <ol className="preview-roster" aria-label="Các bước minh hoạ">{preview.tasks.map((task, index) => <li key={task.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{workflow.steps[index]!.name}</strong><small>{stateLabels[task.state]}</small></li>)}</ol>
  </dialog>;
}
