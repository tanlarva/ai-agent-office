export class OfficeError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}
export function safeText(value: string, max = 8000): string {
  return value.replace(/\bsk-[\w-]{10,}/g, '[REDACTED]')
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b([\w]*(?:TOKEN|SECRET|PASSWORD|API_KEY)[\w]*)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, max);
}
export function publicError(error: unknown): string {
  return error instanceof OfficeError ? error.message : 'Không thể hoàn tất thao tác. Xem mã lỗi và thử lại.';
}
