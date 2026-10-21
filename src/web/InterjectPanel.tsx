import { useState } from 'react';
import { Hand, MessageSquarePlus, RotateCcw } from 'lucide-react';
import { terminalStates, type ProviderStatus, type Run, type UserNote } from '../shared/contracts';
import { api, errorMessage } from './api';
import { formatTime, rolesForRun } from './labels';

const deliveryLabels: Record<UserNote['delivery'], string> = { pending: 'Chờ lượt kế tiếp', live: 'Đã tới agent ngay', prompt: 'Đã đưa vào lượt làm việc', discarded: 'Không dùng (run đã kết thúc)' };
const modeLabels: Record<UserNote['mode'], string> = { steer: 'Chỉ dẫn', interrupt: 'Chen ngang · làm lại', queued: 'Ghi chú' };

/** Lets the user correct an agent while it works instead of waiting for a wrong result. */
export function InterjectPanel({ run, provider, onUpdated }: { run: Run; provider: ProviderStatus | undefined; onUpdated: (run: Run) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<UserNote['mode'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = !terminalStates.has(run.state) && run.state !== 'canceling';
  const live = provider?.interaction?.steer === true;
  const roles = rolesForRun(run);
  const current = run.tasks.findIndex(task => !terminalStates.has(task.state) && task.state !== 'queued');
  async function send(mode: UserNote['mode']) {
    if (!text.trim() || busy) return;
    setBusy(mode); setError(null);
    try { onUpdated((await api.note(run.id, text.trim(), mode)).data); setText(''); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(null); }
  }
  const notes = run.notes ?? [];
  if (!active && !notes.length) return null;
  return <section className="interject-panel" aria-labelledby="interject-title">
    <div className="interject-heading"><h3 id="interject-title"><Hand size={15} />Chen ngang</h3>{current >= 0 && <span>Đang làm: {roles[current]?.name}</span>}</div>
    {active && <>
      <p className="field-help">{live ? 'Chỉ dẫn được gửi thẳng vào lượt đang chạy, agent đọc ngay ở bước kế tiếp.' : 'Provider này nhận chỉ dẫn ở lượt kế tiếp. Muốn sửa ngay, chọn Dừng & làm lại.'}</p>
      <label className="visually-hidden" htmlFor="interject-text">Chỉ dẫn cho agent</label>
      <textarea id="interject-text" rows={3} maxLength={4000} value={text} disabled={!!busy} placeholder="Ví dụ: Không sửa file cấu hình, chỉ thêm test cho hàm login…" onChange={event => setText(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void send('steer'); } }} />
      <div className="interject-actions">
        <button className="button secondary" disabled={!text.trim() || !!busy} onClick={() => void send('steer')} title="Ctrl+Enter"><MessageSquarePlus size={15} />{busy === 'steer' ? 'Đang gửi…' : live ? 'Gửi ngay' : 'Gửi cho lượt sau'}</button>
        <button className="button interrupt-button" disabled={!text.trim() || !!busy || current < 0} onClick={() => void send('interrupt')} title="Dừng lượt hiện tại và làm lại bước này theo chỉ dẫn"><RotateCcw size={15} />{busy === 'interrupt' ? 'Đang dừng…' : 'Dừng & làm lại'}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>}
    {notes.length > 0 && <ol className="note-list" aria-label="Chỉ dẫn đã gửi">{[...notes].reverse().slice(0, 6).map(note => <li key={note.id}>
      <div><strong>{modeLabels[note.mode]}</strong><time dateTime={note.createdAt}>{formatTime(note.createdAt)}</time></div>
      <p className="pre-wrap">{note.text}</p><small className={`delivery delivery-${note.delivery}`}>{deliveryLabels[note.delivery]}</small>
    </li>)}</ol>}
  </section>;
}
