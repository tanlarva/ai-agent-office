import { z } from 'zod';
import type { InquiryQuestion, ProviderId, ProviderStatus, Role, TurnResult } from '../shared/contracts.js';

export interface QuestionAnswer { answers: string[]; response?: string }
export interface Execution {
  cwd: string; role: Role; prompt: string; writable: boolean; model?: string;
  /** May ask the user to approve shell commands; only true for check steps in writable runs. */
  verifyCommands?: boolean;
  schema: Record<string, unknown>; signal: AbortSignal;
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>;
  onApproval: (method: string, description: string) => Promise<'accept' | 'decline'>;
  /** Live clarifying questions. null means the user chose to let the agent decide. */
  onQuestion?: (questions: InquiryQuestion[]) => Promise<QuestionAnswer | null>;
  /** A provider able to receive user guidance mid-turn registers a sender; null unregisters it. */
  registerSteer?: (send: ((text: string) => boolean) | null) => void;
}
export interface Provider {
  readonly id?: ProviderId;
  status(): Promise<ProviderStatus>;
  execute(options: Execution): Promise<TurnResult>;
}
export type ProviderMap = Partial<Record<ProviderId, Provider>>;

export function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const result = z.toJSONSchema(schema) as Record<string, unknown>;
  delete result.$schema;
  // Defaults only keep older outputs parseable; strict provider schemas may reject the keyword.
  const strip = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(strip); return; }
    if (!value || typeof value !== 'object') return;
    delete (value as Record<string, unknown>).default;
    Object.values(value).forEach(strip);
  };
  strip(result);
  return result;
}
