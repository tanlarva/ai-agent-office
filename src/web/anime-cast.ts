export interface CastMember {
  id: string;
  name: string;
  file: string;
  height: number;
  author: string;
  source: string;
}

export const animeCast: readonly CastMember[] = [
  { id: 'yori', name: 'Yori', file: '/models/local/yori.vrm', height: 1.95, author: '躑躅屋 / 有島リツ', source: 'https://booth.pm/ja/items/3721509' },
  ...[1, 2, 3, 4].map(type => ({ id: `amane-${type}`, name: `Amane ${String(type).padStart(2, '0')}`, file: `/models/local/amane-${type}.vrm`, height: 1.85, author: 'yousoron-shop', source: 'https://booth.pm/ja/items/4911831' })),
];

export function castForRole(role: string, index: number): CastMember {
  return role === 'orchestrator' ? animeCast[0]! : animeCast[1 + ((Math.max(1, Math.floor(index)) - 1) % 4)]!;
}

export const maxModelBytes = 64 * 1024 * 1024;

// Only self-contained VRM/GLB assets are accepted; author metadata is data, never instructions.
export function validateVrmContainer(buffer: ArrayBuffer): void {
  if (buffer.byteLength < 20 || buffer.byteLength > maxModelBytes) throw new Error('Kích thước model không hợp lệ.');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw new Error('Model phải là tệp VRM/GLB 2 hợp lệ.');
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || jsonLength > buffer.byteLength - 20 || jsonLength % 4 !== 0) throw new Error('Phần mô tả model không hợp lệ.');
  const data: unknown = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  if (!data || typeof data !== 'object' || !('extensions' in data) || !data.extensions || typeof data.extensions !== 'object' || !('VRM' in data.extensions || 'VRMC_vrm' in data.extensions)) throw new Error('Tệp không chứa nhân vật VRM.');
  for (const field of ['buffers', 'images'] as const) {
    const entries: unknown = field in data ? data[field as keyof typeof data] : undefined;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && typeof entry === 'object' && 'uri' in entry && (typeof entry.uri !== 'string' || !entry.uri.startsWith('data:'))) throw new Error('Model tham chiếu tài nguyên ngoài; cần tệp VRM tự chứa.');
    }
  }
}
