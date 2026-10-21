import { OfficeError, safeText } from './errors.js';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
export function providerTurnError(value: unknown): OfficeError {
  const error = record(value), info = error.codexErrorInfo;
  const description = JSON.stringify(info ?? '');
  const message = safeText(typeof error.message === 'string' ? error.message : 'Lượt Codex chưa hoàn tất.', 1200);
  if (/UsageLimitExceeded|insufficient_quota|quota.{0,20}exhausted/i.test(description + ' ' + message))
    return new OfficeError('PROVIDER_LIMIT', 'Codex báo đã chạm hạn mức. Đợi reset hoặc kiểm tra tài khoản; không tự thử lại.', 429);
  // Match only provider error data, never the goal or agent-generated content.
  if (/"httpStatusCode"\s*:\s*429/.test(description) || /\b429\b|too many requests|rate_limit_exceeded/i.test(message))
    return new OfficeError('PROVIDER_RATE_LIMIT', 'Codex đang giới hạn yêu cầu (429). Bộ điều tiết sẽ chờ trước lượt tiếp theo.', 429);
  return new OfficeError('TURN_FAILED', `Codex không hoàn thành: ${message}`, 503);
}
