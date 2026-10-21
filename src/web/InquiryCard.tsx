import { useState, type CSSProperties } from 'react';
import { MessageCircleQuestion, Send, Sparkles } from 'lucide-react';
import type { Inquiry, Run } from '../shared/contracts';
import { api, errorMessage } from './api';
import { rolesForRun } from './labels';

export function InquiryCard({ inquiry, run, onUpdated }: { inquiry: Inquiry; run: Run; onUpdated: (run: Run) => void }) {
  const [choices, setChoices] = useState<string[][]>(() => inquiry.questions.map(() => []));
  const [custom, setCustom] = useState<string[]>(() => inquiry.questions.map(() => ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const index = run.tasks.findIndex(task => task.id === inquiry.taskId);
  const role = rolesForRun(run)[index];
  const answers = inquiry.questions.map((_, i) => [...choices[i]!, custom[i]!.trim()].filter(Boolean).join(', '));
  async function submit(skip: boolean) {
    setBusy(true); setError(null);
    try { onUpdated((await api.answer(inquiry.id, skip ? { answers: [], skip: true } : { answers })).data); }
    catch (failure) {
      setError(errorMessage(failure));
      try { onUpdated((await api.run(run.id)).data); } catch { /* Keep the original error visible. */ }
    } finally { setBusy(false); }
  }
  function toggle(question: number, label: string, multi: boolean) {
    setChoices(current => current.map((selected, i) => i !== question ? selected : multi ? (selected.includes(label) ? selected.filter(item => item !== label) : [...selected, label]) : selected[0] === label ? [] : [label]));
  }
  return <section className="inquiry-card" aria-label="Câu hỏi từ agent" style={{ '--role-color': role?.color } as CSSProperties}>
    <span className="eyebrow"><MessageCircleQuestion size={14} /> {role?.name ?? 'Agent'} ĐANG HỎI BẠN</span>
    <p className="field-help">{inquiry.source === 'live' ? 'Agent đang tạm dừng giữa chừng để chờ bạn.' : 'Agent đã xong lượt và cần bạn trả lời để làm lại cho đúng.'} Thời gian chờ không tính vào giới hạn 20 phút.</p>
    <form onSubmit={event => { event.preventDefault(); void submit(false); }}>
      {inquiry.questions.map((question, i) => <fieldset key={i} className="inquiry-question">
        <legend>{question.header && <span className="inquiry-header">{question.header}</span>}{question.question}</legend>
        {question.options.length > 0 && <div className="inquiry-options" role={question.multiSelect ? 'group' : 'radiogroup'}>
          {question.options.map(option => {
            const selected = choices[i]!.includes(option.label);
            return <button type="button" key={option.label} className={`inquiry-option ${selected ? 'selected' : ''}`} aria-pressed={selected} disabled={busy} onClick={() => toggle(i, option.label, question.multiSelect)}>
              <strong>{option.label}</strong>{option.description && <small>{option.description}</small>}
            </button>;
          })}
        </div>}
        <label className="visually-hidden" htmlFor={`answer-${inquiry.id}-${i}`}>Câu trả lời của bạn</label>
        <textarea id={`answer-${inquiry.id}-${i}`} rows={2} maxLength={2000} disabled={busy} placeholder={question.options.length ? 'Hoặc nhập câu trả lời khác…' : 'Nhập câu trả lời…'} value={custom[i]} onChange={event => setCustom(current => current.map((value, n) => n === i ? event.target.value : value))}
          onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void submit(false); } }} />
      </fieldset>)}
      <div className="approval-buttons">
        <button type="button" className="button secondary" disabled={busy} onClick={() => void submit(true)} title="Agent tự chọn và ghi rõ giả định"><Sparkles size={15} />Để agent tự quyết</button>
        <button type="submit" className="button primary" disabled={busy || !answers.some(Boolean)}><Send size={15} />{busy ? 'Đang gửi…' : 'Gửi trả lời'}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  </section>;
}
