import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, LoaderCircle } from 'lucide-react';
import type { FolderEntry, FolderPage } from '../shared/contracts';
import { api, errorMessage } from './api';

export function FolderPicker({ selected, onSelect, onClose }: { selected: string; onSelect: (path: string) => void; onClose: () => void }) {
  const [page, setPage] = useState<FolderPage | null>(null);
  const [candidate, setCandidate] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void api.folders(undefined, undefined, controller.signal).then(result => { if (!controller.signal.aborted) setPage(result.data); })
      .catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)); });
    return () => controller.abort();
  }, []);
  return <section className="folder-picker" aria-label="Chọn workspace từ cây thư mục">
    <div className="folder-picker-heading"><strong>Cây thư mục dự án</strong><button type="button" className="text-button" onClick={onClose}>Đóng cây</button></div>
    {error ? <p className="form-error" role="alert">{error}</p> : !page ? <p className="field-help" role="status">Đang đọc thư mục…</p> : <>
      <p className="folder-root">{page.root}</p>
      <p className="field-help">Mở nhánh để duyệt; bấm tên thư mục để chọn workspace. Không đọc nội dung file.</p>
      <div className="folder-tree-scroll"><ul className="folder-tree" aria-label="Các thư mục dự án"><FolderNode entry={{ name: page.root, path: page.root, selectable: false }} initial={page} selected={candidate || selected} onChoose={setCandidate} /></ul></div>
      <div className="folder-picker-selection"><span>{candidate || 'Chưa chọn thư mục'}</span><button type="button" className="button secondary" disabled={!candidate} onClick={() => onSelect(candidate)}>Dùng thư mục này</button></div>
    </>}
  </section>;
}

function FolderNode({ entry, initial, selected, onChoose }: { entry: FolderEntry; initial?: FolderPage; selected: string; onChoose: (path: string) => void }) {
  const [expanded, setExpanded] = useState(!!initial);
  const [page, setPage] = useState<FolderPage | null>(initial ?? null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [moreCursor, setMoreCursor] = useState<string | undefined>();
  useEffect(() => {
    if (!expanded || (page && !moreCursor)) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    void api.folders(entry.path, moreCursor, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setPage(previous => moreCursor && previous ? { ...result.data, entries: [...previous.entries, ...result.data.entries] } : result.data);
      setLoading(false); setMoreCursor(undefined);
    }).catch(failure => { if (!controller.signal.aborted) { setError(errorMessage(failure)); setLoading(false); setMoreCursor(undefined); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [expanded, entry.path, moreCursor]);
  return <li>
    <div className={`folder-row ${selected === entry.path ? 'selected' : ''}`}>
      <button type="button" className="folder-toggle" aria-label={`${expanded ? 'Thu gọn' : 'Mở'} thư mục ${entry.name}`} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
      <button type="button" className="folder-select" disabled={!entry.selectable} aria-pressed={selected === entry.path} onClick={() => onChoose(entry.path)}>{expanded ? <FolderOpen size={16} /> : <Folder size={16} />}<span>{entry.name}</span></button>
    </div>
    {expanded && <>
      {loading && <p className="field-help folder-node-note" role="status"><LoaderCircle size={13} className="spinner" />Đang đọc…</p>}
      {error && <p className="form-error folder-node-note" role="alert">{error}</p>}
      {page && <ul>{page.entries.map(child => <FolderNode key={child.path} entry={child} selected={selected} onChoose={onChoose} />)}</ul>}
      {page && !page.entries.length && !loading && <p className="field-help folder-node-note">Không có thư mục con.</p>}
      {page?.nextCursor && <button type="button" className="text-button folder-node-note" disabled={loading} onClick={() => setMoreCursor(page.nextCursor!)}>Tải thêm thư mục</button>}
      {page?.truncated && <p className="field-help folder-node-note">Thư mục quá lớn để liệt kê hết. Bạn có thể nhập đường dẫn trực tiếp.</p>}
    </>}
  </li>;
}
