import type { Run, State } from './contracts.js';
import type { WorkflowId } from './workflows.js';

export type Point = readonly [number, number];
export interface OfficeTheme {
  id: WorkflowId; name: string; description: string;
  background: string; floor: string; wall: string; edge: string;
  accent: string; secondary: string; desk: string; rug: string;
  stations: readonly Point[];
  feature: 'servers' | 'campaign' | 'swatches' | 'process' | 'library' | 'editorial' | 'records' | 'lounge';
}
const five: readonly Point[] = [[-4.2, -3.3], [0, -3.3], [4.2, -3.3], [-4.2, 0.7], [4.2, 0.7]];
const four: readonly Point[] = [[-3.6, -3.3], [3.6, -3.3], [-4.2, 0.7], [4.2, 0.7]];
export const officeThemes: Record<WorkflowId, OfficeTheme> = {
  software: { id: 'software', name: 'Xưởng phần mềm', description: 'Trạm code · khu QA · máy chủ', background: '#101e23', floor: '#1d3036', wall: '#243d46', edge: '#446775', accent: '#7ed7df', secondary: '#b5a5ec', desk: '#c3c8b9', rug: '#244c58', stations: five, feature: 'servers' },
  marketing: { id: 'marketing', name: 'Phòng chiến dịch', description: 'Bảng ý tưởng · chiến lược · sáng tạo', background: '#261b24', floor: '#3a2934', wall: '#503446', edge: '#81536b', accent: '#f4a3bb', secondary: '#e9c97d', desk: '#dfc6b3', rug: '#704354', stations: [[-4.2, -3.3], [0, -3.3], [4.2, -3.3], [-3.7, 0.9], [3.7, 0.9]], feature: 'campaign' },
  design: { id: 'design', name: 'Studio thiết kế', description: 'Bàn vẽ · bảng màu · mẫu hình khối', background: '#202038', floor: '#333347', wall: '#45415c', edge: '#716c94', accent: '#c3b0fa', secondary: '#e9ac88', desk: '#d6d0c4', rug: '#55516f', stations: four, feature: 'swatches' },
  business: { id: 'business', name: 'Phòng quy trình', description: 'Sơ đồ nghiệp vụ · bàn thảo luận', background: '#172524', floor: '#293c37', wall: '#36514a', edge: '#5f7d6c', accent: '#acd2a4', secondary: '#e8c88b', desk: '#c9c7ab', rug: '#3d5b4c', stations: [[-4.1, -3.3], [3.6, -3.3], [-3.7, 0.9], [4.1, 0.9]], feature: 'process' },
  research: { id: 'research', name: 'Thư viện nghiên cứu', description: 'Nguồn tài liệu · phân tích · đối chiếu', background: '#17212e', floor: '#29384a', wall: '#35465b', edge: '#5c7593', accent: '#9dc5ec', secondary: '#d6bb8d', desk: '#c0c4c7', rug: '#38516d', stations: four, feature: 'library' },
  content: { id: 'content', name: 'Toà soạn nội dung', description: 'Bản thảo · tư liệu · bàn biên tập', background: '#29231b', floor: '#40372c', wall: '#574938', edge: '#8a7658', accent: '#e9c88b', secondary: '#a9c5ad', desk: '#d6c2a1', rug: '#65553e', stations: [[-3.6, -3.3], [4.1, -3.3], [-4.1, 0.9], [3.6, 0.9]], feature: 'editorial' },
  audit: { id: 'audit', name: 'Phòng kiểm toán', description: 'Hồ sơ · bằng chứng · soát xét độc lập', background: '#17252b', floor: '#293e46', wall: '#35505b', edge: '#617e89', accent: '#9ed1cc', secondary: '#d5bd8d', desk: '#c7c5b8', rug: '#375760', stations: five, feature: 'records' },
  quick: { id: 'quick', name: 'Phòng cộng tác', description: 'Lập kế hoạch · thực hiện · bàn giao', background: '#19231e', floor: '#2c3930', wall: '#3b4d3e', edge: '#687a60', accent: '#c5d5a5', secondary: '#e8bd83', desk: '#d0c7ad', rug: '#4c6047', stations: [[0, -3.3], [-4.2, 0.7], [4.2, 0.7]], feature: 'lounge' },
};
export function officeThemeForRun(run: Run | null): OfficeTheme {
  return officeThemes[run?.workflow?.id ?? (run ? 'quick' : 'software')];
}
export function stationFor(theme: OfficeTheme, index: number): Point {
  return theme.stations[index] ?? [0, -3.3];
}
export function dockFor(station: Point): Point { return [station[0], station[1] + 1.35]; }

// Aisles run in front of each desk row, down an outside edge, then into the delivery zone.
// No diagonal shortcut crosses a workstation or the central collaboration table.
export function handoffPath(station: Point, index: number): readonly Point[] {
  const home = dockFor(station), side = (station[0] < 0 || (station[0] === 0 && index % 2 === 0)) ? -1 : 1;
  return [home, [home[0], home[1] + 0.85], [side * 6.5, home[1] + 0.85], [side * 6.5, 4.8], [side * 0.65, 4.8]];
}
export function pathLength(points: readonly Point[]): number {
  return points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - points[i]![0], point[1] - points[i]![1]), 0);
}
export function samplePath(points: readonly Point[], distance: number): { position: Point; heading: number; finished: boolean } {
  if (!points.length) return { position: [0, 0], heading: 0, finished: true };
  let remaining = Math.max(0, distance), heading = 0;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!, to = points[i]!, dx = to[0] - from[0], dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    if (!length) continue;
    heading = Math.atan2(dx, dz);
    if (remaining < length) return { position: [from[0] + dx * remaining / length, from[1] + dz * remaining / length], heading, finished: false };
    remaining -= length;
  }
  return { position: points.at(-1)!, heading, finished: true };
}
export function isLivePose(state: State | undefined): boolean {
  return state === 'running' || state === 'waiting_approval' || state === 'waiting_capacity';
}
// Only a transition witnessed in this mounted run causes a handoff, never a historical snapshot.
export function shouldHandoff(previous: State | undefined, current: State | undefined): boolean {
  return previous !== undefined && isLivePose(previous) && current === 'succeeded';
}
