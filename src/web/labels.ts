import type { Role, Run, State } from '../shared/contracts';
import { getWorkflow } from '../shared/workflows';

export const stateLabels: Record<State, string> = {
  queued: 'Đang chờ', running: 'Đang làm việc', waiting_approval: 'Chờ phê duyệt',
  waiting_capacity: 'Chờ điều tiết',
  succeeded: 'Hoàn thành', failed: 'Có lỗi', canceling: 'Đang dừng', canceled: 'Đã hủy', interrupted: 'Bị gián đoạn',
};
const roleColors = ['#eebc73', '#80cbbb', '#b6a3e7', '#7bb9df', '#dea48e'];
export function rolesForRun(run: Run | null): { id: Role; name: string; specialty: string; color: string }[] {
  return (run?.workflow ?? getWorkflow(run ? 'quick' : 'software')).steps.map((step, index) => ({ id: step.role, name: step.name, specialty: step.specialty, color: roleColors[index % roleColors.length]! }));
}
export const formatTime = (date: string) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(date));
export const formatDate = (date: string) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
export const formatTokens = (value: number | null) => value === null ? 'Chưa có dữ liệu' : new Intl.NumberFormat('vi-VN').format(value);
