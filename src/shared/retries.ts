import type { Run } from './contracts.js';
import { getWorkflow } from './workflows.js';

export function isRateLimitFailure(run: Run): boolean {
  return ['PROVIDER_RATE_LIMIT', 'PROVIDER_LIMIT'].includes(run.failureCode ?? '') ||
    (!run.failureCode && /\b429\b|too many requests/i.test(run.error ?? ''));
}
export function resumableTaskIndex(run: Run): number {
  if (run.state !== 'failed' || !isRateLimitFailure(run)) return -1;
  const index = run.tasks.findIndex(task => task.state === 'failed');
  const workflow = run.workflow ?? getWorkflow();
  if (index < 0 || run.tasks.length !== workflow.steps.length ||
    run.tasks.some((task, i) => task.role !== workflow.steps[i]?.role) ||
    run.tasks.slice(0, index).some(task => task.state !== 'succeeded') ||
    run.tasks.slice(index).some(task => task.observedWrites)) return -1;
  // Resume never replays a writer or grants writes to any remaining stage.
  if (run.mode === 'workspace-write' && workflow.steps.slice(index).some(step => step.writable)) return -1;
  return index;
}
