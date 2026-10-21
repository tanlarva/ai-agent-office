import { z } from 'zod';

export const roleSchema = z.enum(['orchestrator', 'builder', 'reviewer', 'business-analyst', 'developer', 'qa', 'researcher', 'strategist', 'copywriter', 'editor', 'ux', 'designer', 'design-reviewer', 'analyst', 'writer', 'audit-risk', 'audit-evidence', 'audit-reporter', 'audit-reviewer']);
export type Role = z.infer<typeof roleSchema>;
export const workflowIdSchema = z.enum(['software', 'marketing', 'design', 'business', 'research', 'content', 'audit', 'quick']);
export type WorkflowId = z.infer<typeof workflowIdSchema>;
export interface WorkflowStep {
  role: Role; name: string; specialty: string; kind: 'plan' | 'work' | 'check' | 'review';
  writable: boolean; instructions: string;
}
export interface WorkflowDefinition { id: WorkflowId; version: 1; name: string; description: string; steps: WorkflowStep[] }
const planner: WorkflowStep = { role: 'orchestrator', name: 'Orchestrator', specialty: 'Phạm vi, kế hoạch & tiêu chí bàn giao', kind: 'plan', writable: false,
  instructions: 'Inspect only as needed. Define scope, assumptions, acceptance criteria and a short plan. Do not modify files or run builds/tests in this planning phase.' };
function step(role: Role, name: string, specialty: string, kind: WorkflowStep['kind'], writable: boolean, instructions: string): WorkflowStep {
  return { role, name, specialty, kind, writable, instructions };
}
export const workflows: readonly WorkflowDefinition[] = [
  { id: 'software', version: 1, name: 'Phát triển phần mềm', description: 'Phân tích yêu cầu → code → QA độc lập → review.', steps: [planner,
    step('business-analyst', 'Business Analyst', 'Yêu cầu & tình huống chấp nhận', 'work', false, 'Clarify requirements from the goal and workspace. Specify acceptance scenarios, edge cases and missing information. Do not invent business rules; mark blocking ambiguity.'),
    step('developer', 'Developer', 'Triển khai code & unit test', 'work', true, 'Implement the requested change using existing conventions. Write meaningful tests where needed and run checks. Address the acceptance scenarios. Do not claim QA approval.'),
    step('qa', 'QA / Tester', 'Kiểm thử độc lập từ yêu cầu', 'check', false, 'Derive tests independently from the ORIGINAL goal and acceptance criteria. Inspect actual code, run relevant existing tests, check negative and boundary cases. Do not merely repeat the developer claim. Do not modify files. For a writable run require observed successful test commands. Missing required coverage or failed checks must block approval.'),
    step('reviewer', 'Code Reviewer', 'Diff, chất lượng & bàn giao', 'review', false, 'Independently inspect code, available diff, security, maintainability and QA evidence. Approve only when the original goal and required tests are satisfied.'),
  ] },
  { id: 'marketing', version: 1, name: 'Chiến dịch marketing', description: 'Nghiên cứu → chiến lược → nội dung → biên tập.', steps: [planner,
    step('researcher', 'Market Researcher', 'Khách hàng & bằng chứng thị trường', 'work', false, 'Analyze local supplied market and customer material. Distinguish facts, assumptions and missing sources. Do not fabricate statistics or imply live web research.'),
    step('strategist', 'Marketing Strategist', 'Thông điệp, kênh & KPI', 'work', false, 'Define audience, positioning, message, channels, campaign sequence and measurable KPIs from the brief. Treat budgets as proposals, never spend or publish.'),
    step('copywriter', 'Copywriter', 'Nội dung & biến thể chiến dịch', 'work', true, 'Draft campaign copy and variants aligned with strategy and brand material. Deliver local text/Markdown artifacts when writing is enabled. Do not publish or invent claims.'),
    step('editor', 'Brand Editor', 'Thông điệp, nguồn & biên tập', 'review', false, 'Check brief coverage, audience, brand voice, unsupported claims, consistency and usable deliverables. Flag missing sources or misleading claims.'),
  ] },
  { id: 'design', version: 1, name: 'Thiết kế sản phẩm', description: 'UX → thiết kế giao diện → kiểm tra bàn giao.', steps: [planner,
    step('ux', 'UX Researcher', 'Người dùng & luồng thao tác', 'work', false, 'Analyze supplied user evidence and constraints. Define user flows, empty/error/loading states and accessibility requirements. Label assumptions; do not invent user interviews.'),
    step('designer', 'UI Designer', 'Bố cục, component & đặc tả', 'work', true, 'Produce design specifications, UI code or local SVG/HTML artifacts as requested, reusing existing design tokens and components. No image-generation tool is available; do not claim rendered assets without evidence.'),
    step('design-reviewer', 'Design Reviewer', 'Khả dụng, accessibility & bàn giao', 'review', false, 'Check consistency, responsive behavior, accessibility and coverage of UX scenarios against actual local artifacts. Clearly distinguish code inspection from visual/browser testing that was not performed.'),
  ] },
  { id: 'business', version: 1, name: 'Phân tích nghiệp vụ', description: 'BA → mô hình quy trình → kiểm tra tính nhất quán.', steps: [planner,
    step('business-analyst', 'Business Analyst', 'Yêu cầu, bên liên quan & quy tắc', 'work', false, 'Extract requirements, stakeholder needs, business rules, constraints and open questions from supplied documents. Preserve source references and identify contradictions.'),
    step('analyst', 'Process Analyst', 'Quy trình, dữ liệu & tiêu chí chấp nhận', 'work', true, 'Model current/proposed processes, data definitions, exceptions and acceptance criteria. Produce traceable local specifications. Unconfirmed rules must remain explicit questions.'),
    step('reviewer', 'Business Reviewer', 'Truy vết & nhất quán nghiệp vụ', 'review', false, 'Check requirements traceability, rule consistency, exception flows and acceptance criteria. Block contradictory or fabricated requirements. Do not present legal/financial conclusions as professional approval.'),
  ] },
  { id: 'research', version: 1, name: 'Nghiên cứu & báo cáo', description: 'Thu thập tài liệu → phân tích → kiểm chứng.', steps: [planner,
    step('researcher', 'Researcher', 'Nguồn tài liệu & độ tin cậy', 'work', false, 'Inventory relevant supplied local sources and extract evidence with references. State coverage and date limitations. No live browsing is available; do not invent sources.'),
    step('analyst', 'Research Analyst', 'Phân tích & soạn báo cáo', 'work', true, 'Synthesize evidence into a local report, distinguish observations from inference, document methods and uncertainties. Never fabricate measurements or citations.'),
    step('reviewer', 'Evidence Reviewer', 'Nguồn, lập luận & sai lệch', 'review', false, 'Verify key claims against supplied sources, inspect calculations/methods and uncertainty. Missing support for material claims must block approval.'),
  ] },
  { id: 'content', version: 1, name: 'Biên soạn nội dung', description: 'Tư liệu → bản thảo → biên tập chất lượng.', steps: [planner,
    step('researcher', 'Content Researcher', 'Độc giả, tư liệu & dàn ý', 'work', false, 'Identify audience, purpose, supplied references and outline. Flag missing factual sources and avoid invented quotations.'),
    step('writer', 'Writer', 'Bản thảo & tài liệu', 'work', true, 'Write requested content with clear structure, appropriate voice and traceable facts. Save local text/Markdown artifacts only when writing is enabled. Do not publish.'),
    step('editor', 'Editor', 'Độ chính xác, văn phong & bàn giao', 'review', false, 'Review factual support, readability, tone, structure and full brief coverage. Verify actual local deliverables where present; flag unsupported claims.'),
  ] },
  { id: 'audit', version: 1, name: 'Kiểm toán', description: 'Phạm vi → rủi ro → bằng chứng → báo cáo → soát xét độc lập.', steps: [
    { ...planner, instructions: planner.instructions + ' For audit support, establish the audit type (internal, financial or compliance), entity/process, period, supplied evaluation criteria and intended output. Do not assume a jurisdiction, reporting standard, materiality or sampling threshold. Record missing scope and criteria as open questions.' },
    step('audit-risk', 'Chuyên viên rủi ro', 'Rủi ro & kiểm soát nội bộ', 'work', false, 'Assess risks and controls using only supplied local documents and user-provided criteria. Produce a risk-control-procedure matrix with source references, risk rationale and proposed procedures. Distinguish missing evidence from an established control failure. Do not invent legal requirements, thresholds, interviews or performed procedures.'),
    step('audit-evidence', 'Kiểm tra bằng chứng', 'Đối chiếu chứng từ & sai lệch', 'work', false, 'Independently inspect supplied records against the ORIGINAL goal and risk matrix. Reconcile totals, recalculate and examine anomalies where supported by available local tools. Cite file/sheet/row/page references where available, record exact executed commands, sample selection, population and coverage limits. No local spreadsheet/document tool is guaranteed: report unreadable formats rather than pretending to inspect them. Preserve original records; never adjust entries. Separate observed exceptions, suspected issues and missing evidence; an anomaly alone is not proof of fraud.'),
    step('audit-reporter', 'Lập báo cáo kiểm toán', 'Hồ sơ phát hiện & kiến nghị', 'work', true, 'Prepare an audit-support report and findings register: supplied criterion, observed condition, evidence reference, cause only if supported, potential impact, recommendation, open questions and scope limitations. Report genuine audit exceptions and missing evidence explicitly. Use local Markdown deliverables when writing is enabled, in a separate audit-output folder; never edit source records, accounting entries or signed reports. Verify report structure and references with observed commands after writing. Do not issue, sign or imply a professional assurance opinion, statutory certification or a conclusion that the entity is free of fraud. In read-only mode return the report in the summary.'),
    step('audit-reviewer', 'Soát xét độc lập', 'Truy vết bằng chứng & chất lượng báo cáo', 'review', false, 'Independently trace report claims to actual supplied records and the original scope. Check calculations, source references, coverage limits and distinction between fact, inference and missing evidence. This approval assesses report quality only, never the audited entity or professional assurance. Genuine audit exceptions properly documented in the report do not themselves block completion. Use findings to block unsupported report claims, concealed limitations, altered evidence or missing requested deliverables. Preserve source records and do not sign, certify or publish.'),
  ] },
  { id: 'quick', version: 1, name: 'Tổng quát', description: 'Quy trình gọn tương thích phiên cũ: kế hoạch → thực hiện → review.', steps: [planner,
    step('builder', 'Builder', 'Thực hiện & kiểm chứng', 'work', true, 'Follow the plan and produce the requested result within the workspace. Run meaningful checks after any changes.'),
    step('reviewer', 'Reviewer', 'Đánh giá & bàn giao', 'review', false, 'Independently inspect the workspace and handoffs for correctness, security and incomplete goals. Approve only if goal and required checks are satisfied.'),
  ] },
];
export function getWorkflow(id: WorkflowId = 'quick'): WorkflowDefinition {
  const workflow = workflows.find(item => item.id === id);
  if (!workflow) throw new Error('Unknown workflow');
  return structuredClone(workflow);
}
