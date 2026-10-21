import type { WorkflowId } from './workflows.js';

// Local keyword heuristic for the quick-assign box. It only pre-selects a template the user can
// change; it never calls a model and never decides permissions.
const rules: readonly { id: WorkflowId; words: readonly string[] }[] = [
  { id: 'audit', words: ['kiem toan', 'audit', 'chung tu', 'doi chieu', 'kiem soat noi bo', 'so sach'] },
  { id: 'marketing', words: ['marketing', 'chien dich', 'quang cao', 'campaign', 'kenh ban', 'slogan', 'fanpage', 'seo'] },
  { id: 'design', words: ['thiet ke', 'giao dien', 'ui', 'ux', 'wireframe', 'mockup', 'figma', 'bo cuc'] },
  { id: 'research', words: ['nghien cuu', 'research', 'bao cao', 'tong hop tai lieu', 'phan tich du lieu', 'khao sat'] },
  { id: 'content', words: ['viet bai', 'noi dung', 'blog', 'ban thao', 'bien tap', 'tai lieu huong dan', 'content'] },
  { id: 'business', words: ['nghiep vu', 'quy trinh', 'yeu cau', 'brd', 'srs', 'use case', 'business'] },
  { id: 'software', words: ['code', 'bug', 'loi', 'api', 'test', 'refactor', 'tinh nang', 'feature', 'build', 'deploy', 'function', 'ham', 'component', 'database'] },
];
const smallTask = ['nho', 'nhanh', 'sua chinh ta', 'typo', 'doi ten', 'rename', 'mot dong', 'small', 'quick'];

export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}
function hits(text: string, words: readonly string[]): number {
  return words.reduce((count, word) => count + (new RegExp(`(^|[^a-z0-9])${word.replace(/ /g, '\\s+')}($|[^a-z0-9])`).test(text) ? 1 : 0), 0);
}
export function suggestWorkflow(goal: string): WorkflowId {
  const text = normalizeText(goal);
  if (!text.trim()) return 'software';
  let best: { id: WorkflowId; score: number } = { id: 'quick', score: 0 };
  for (const rule of rules) {
    const score = hits(text, rule.words);
    if (score > best.score) best = { id: rule.id, score };
  }
  // Short, explicitly small requests are cheaper with one agent.
  if (hits(text, smallTask) > 0 && text.length < 240) return 'solo';
  return best.id;
}
