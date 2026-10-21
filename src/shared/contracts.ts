import { z } from 'zod';
import { workflowIdSchema, type WorkflowDefinition, type WorkflowId, type Role } from './workflows.js';
export { roleSchema, type Role } from './workflows.js';

export const stateSchema = z.enum(['queued', 'running', 'waiting_approval', 'waiting_capacity', 'succeeded', 'failed', 'canceling', 'canceled', 'interrupted']);
export type State = z.infer<typeof stateSchema>;
export const terminalStates: ReadonlySet<State> = new Set(['succeeded', 'failed', 'canceled', 'interrupted']);
export const createRunSchema = z.object({
  goal: z.string().trim().min(5).max(6000),
  workspace: z.string().trim().min(3).max(500),
  model: z.string().trim().max(100).optional(),
  sessionId: z.string().uuid().optional(),
  workflowId: workflowIdSchema.optional(),
  mode: z.enum(['read-only', 'workspace-write']).default('read-only'),
}).strict();
export type CreateRun = z.infer<typeof createRunSchema>;
export const createProjectSessionSchema = z.object({ name: z.string().trim().min(1).max(80), workspace: z.string().trim().min(3).max(500), workflowId: workflowIdSchema.optional() }).strict();
export type CreateProjectSession = z.infer<typeof createProjectSessionSchema>;
export interface ProjectSession {
  id: string; name: string; workspace: string; createdAt: string; workflowId?: WorkflowId;
}
export interface FolderEntry { name: string; path: string; selectable: boolean }
export interface FolderPage {
  root: string; path: string; entries: FolderEntry[]; nextCursor: string | null; truncated: boolean;
}
export interface Task {
  id: string; role: Role; title: string; state: State;
  summary: string; threadId?: string; turnId?: string;
  inputTokens: number | null; outputTokens: number | null;
  handoff?: string; inheritedFromTaskId?: string; observedWrites?: boolean;
  usageAttempts?: { inputTokens: number | null; outputTokens: number | null }[];
}
export interface Approval {
  id: string; taskId: string; method: string; description: string;
  requestedAt: string; state: 'pending' | 'accepted' | 'declined' | 'expired';
}
export interface Run {
  id: string; goal: string; workspace: string; mode: CreateRun['mode'];
  model?: string; state: State; version: number;
  sessionId?: string; sessionName?: string;
  workflow?: WorkflowDefinition;
  createdAt: string; updatedAt: string;
  tasks: Task[]; approvals: Approval[]; error: string | null;
  lastSequence: number;
  failureCode?: string; retryOfRunId?: string;
  waiting?: { reason: 'spacing' | 'rate_limit'; until: string; attempt: number };
}
export interface OfficeEvent {
  schemaVersion: 1; eventId: string; runId: string; taskId: string | null;
  sequence: number; occurredAt: string; type: string;
  payload: Record<string, unknown>;
}
export interface ProviderStatus {
  id: 'codex'; state: 'ready' | 'signed_out' | 'unavailable' | 'billing_mismatch';
  billingMode: 'chatgpt' | 'apiKey' | 'unknown';
  plan: string | null; message: string;
  models: { id: string; name: string; isDefault: boolean }[];
  limits: { usedPercent: number | null; resetsAt: number | null } | null;
  limitWindows?: { usedPercent: number; resetsAt: number | null; name: string }[];
}
export interface SchedulingState { nextAllowedAt: number; rateLimitStreak: number }
export interface SchedulingStatus { minGapMs: number; maxRetries: number; cooldownUntil: string | null; rateLimitStreak: number }
export const retryRunSchema = z.object({ version: z.number().int().positive() }).strict();
export interface Page<T> { data: T[]; meta: { traceId: string; nextCursor: string | null } }
export interface Envelope<T> { data: T; meta: { traceId: string } }
export const approvalDecisionSchema = z.object({
  decision: z.enum(['accept', 'decline']), version: z.number().int().positive(),
}).strict();

export const planOutputSchema = z.object({ summary: z.string().max(4000), steps: z.array(z.string().max(1000)).min(1).max(8) }).strict();
export const buildOutputSchema = z.object({
  summary: z.string().max(8000), blocked: z.boolean(),
  files: z.array(z.string().max(500)).max(100),
  tests: z.array(z.object({ command: z.string().max(2000), passed: z.boolean(), evidence: z.string().max(2000) }).strict()).max(20),
}).strict();
export const reviewOutputSchema = z.object({ approved: z.boolean(), summary: z.string().max(6000), findings: z.array(z.string().max(2000)).max(20) }).strict();
export const checkOutputSchema = reviewOutputSchema.extend({ tests: buildOutputSchema.shape.tests });
export interface ToolResult { command: string; exitCode: number | null }
export interface TurnResult { text: string; tools: ToolResult[]; changedFiles: boolean }
