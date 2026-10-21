import type { ProviderStatus } from '../shared/contracts.js';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
export function parseLimitWindows(value: unknown): NonNullable<ProviderStatus['limitWindows']> {
  const result = record(value), buckets = Object.entries(record(result.rateLimitsByLimitId));
  const selected = buckets.length ? buckets : [['codex', result.rateLimits] as const];
  return selected.flatMap(([id, bucket]) => ['primary', 'secondary'].flatMap(name => {
    const window = record(record(bucket)[name]);
    if (typeof window.usedPercent !== 'number' || !Number.isFinite(window.usedPercent)) return [];
    const reset = window.resetsAt;
    return [{ name: `${id}/${name}`, usedPercent: window.usedPercent,
      resetsAt: typeof reset === 'number' && Number.isFinite(reset) && reset > 0 && reset <= 8_640_000_000_000 ? reset : null }];
  }));
}
export function exhaustedWindows(status: ProviderStatus): { resetsAt: number | null }[] {
  const windows = status.limitWindows?.length ? status.limitWindows : status.limits ? [status.limits] : [];
  return windows.filter(window => window.usedPercent !== null && window.usedPercent >= 100);
}
export function quotaReset(status: ProviderStatus): number | null {
  const windows = exhaustedWindows(status);
  if (!windows.length || windows.some(window => window.resetsAt === null)) return null;
  return Math.max(...windows.map(window => window.resetsAt! * 1000));
}
