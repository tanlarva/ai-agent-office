import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import type { SchedulingState, SchedulingStatus } from '../shared/contracts.js';
export { exhaustedWindows, quotaReset } from './provider-limits.js';
import type { Store } from './store.js';
import { OfficeError } from './errors.js';

export interface SchedulingOptions {
  minGapMs?: number; baseBackoffMs?: number; maxBackoffMs?: number; maxRetries?: number;
  maxWaitMs?: number; jitterRatio?: number;
  now?: () => number; random?: () => number; sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}
export function schedulingFromEnv(env: NodeJS.ProcessEnv): SchedulingOptions {
  return {
    minGapMs: z.coerce.number().int().min(1000).max(120_000).default(15_000).parse(env.OFFICE_CALL_GAP_MS),
    maxRetries: z.coerce.number().int().min(0).max(2).default(2).parse(env.OFFICE_RATE_RETRIES),
  };
}
export class ProviderGovernor {
  readonly minGapMs: number;
  readonly maxRetries: number;
  readonly maxWaitMs: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  constructor(private readonly store: Store, private readonly options: SchedulingOptions = {}) {
    this.minGapMs = options.minGapMs ?? 15_000; this.maxRetries = options.maxRetries ?? 2;
    this.maxWaitMs = options.maxWaitMs ?? 300_000;
    this.now = options.now ?? Date.now; this.random = options.random ?? Math.random;
    this.sleep = options.sleep ?? (async (ms, signal) => { await delay(ms, undefined, { signal }); });
  }
  private async state(): Promise<SchedulingState> { return await this.store.scheduling() ?? { nextAllowedAt: 0, rateLimitStreak: 0 }; }
  async status(): Promise<SchedulingStatus> {
    const state = await this.state();
    return { minGapMs: this.minGapMs, maxRetries: this.maxRetries, cooldownUntil: state.nextAllowedAt > this.now() ? new Date(state.nextAllowedAt).toISOString() : null, rateLimitStreak: state.rateLimitStreak };
  }
  async wait(signal: AbortSignal, onWait: (until: string, reason: 'spacing' | 'rate_limit') => Promise<void>): Promise<void> {
    const state = await this.state();
    const remaining = state.nextAllowedAt - this.now();
    if (signal.aborted) throw new OfficeError('CANCELED', 'Đã hủy công việc.', 409);
    if (remaining <= 0) return;
    if (remaining > this.maxWaitMs) throw new OfficeError('PROVIDER_RATE_LIMIT', `Codex đang được điều tiết. Thử lại sau ${new Date(state.nextAllowedAt).toLocaleString('vi-VN')}.`, 429);
    await onWait(new Date(state.nextAllowedAt).toISOString(), state.rateLimitStreak ? 'rate_limit' : 'spacing');
    // Recheck the clock after sleep; early wakeups must not issue inference before the gate.
    while (state.nextAllowedAt > this.now()) {
      await this.sleep(state.nextAllowedAt - this.now(), signal);
      if (signal.aborted) throw new OfficeError('CANCELED', 'Đã hủy công việc.', 409);
    }
  }
  async completed(success: boolean): Promise<void> {
    const state = await this.state();
    await this.store.saveScheduling({ nextAllowedAt: Math.max(state.nextAllowedAt, this.now() + this.minGapMs), rateLimitStreak: success ? 0 : state.rateLimitStreak });
  }
  async limited(resetAt: number | null = null): Promise<number> {
    const state = await this.state(), streak = Math.min(state.rateLimitStreak + 1, 20);
    const base = Math.min(this.options.maxBackoffMs ?? 300_000, (this.options.baseBackoffMs ?? 60_000) * 2 ** (streak - 1));
    const jitter = base * (this.options.jitterRatio ?? 0.2) * Math.max(0, Math.min(1, this.random()));
    const until = Math.max(state.nextAllowedAt, resetAt ?? 0, this.now() + Math.ceil(base + jitter));
    await this.store.saveScheduling({ nextAllowedAt: until, rateLimitStreak: streak });
    return until - this.now();
  }
}
