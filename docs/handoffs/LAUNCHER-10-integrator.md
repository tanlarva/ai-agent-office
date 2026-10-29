# Bàn giao LAUNCHER-10 — Integrator

- Ngày: 29/10/2026 (Asia/Saigon).
- Trạng thái: completed.
- Baseline: f3af053 cùng các thay đổi Anime/MERGE-09 đã có trong checkout; giữ nguyên staging của người dùng.
- Branch/worktree: checkout hiện tại, không tạo writer khác.
- Phạm vi: launcher Windows và đóng gói portable, lifecycle backend, kiểm thử và hướng dẫn.

## Kết quả và lý do

Người dùng yêu cầu bổ sung launcher sau khi chọn cách nhấp exe để mở app local.
Tạo `AI Agent Office.exe` ở root dùng Node hiện có; bản portable kèm Node.js 24.18.0 trong runtime/.
Launcher WinForms .NET Framework dùng compiler Windows sẵn có, không thêm dependency/npm library.
Backend chạy ẩn; sau khi listen thật, báo ready qua stdout, launcher mới mở browser.
Mutex/event theo thư mục giúp nhấp lại mở UI của owner và không tạo backend thứ hai.
Tray có mở UI và thoát/hủy công việc; stdin stop/EOF gọi app.close để hủy provider, đóng store và giải phóng lock.
Không thêm API shutdown, không mở quyền, không gọi inference để khởi động.

## File thay đổi

- `launcher/OfficeLauncher.cs`: native exe/tray, duplicate, startup/error/timeout, graceful stop và force-stop cây process do mình tạo.
- `scripts/build-launcher.ps1`: compile C# thành Windows GUI exe ở root.
- `scripts/build-portable.mjs`, `scripts/portable-files.mjs`: staging duy nhất, copy build/Node/LICENSE/production packages từ lock,
  không chạy install scripts/network khi đóng gói; loại database/log/credential và model riêng mặc định.
- `scripts/test-launcher.mjs`: kiểm thử exe thật trong bản copy có đường dẫn Unicode/space và database riêng.
- `src/server/index.ts`, `src/server/launcher-control.ts`: startup errors an toàn, ready và stop/EOF qua pipe riêng.
- `tests/launcher.test.mjs`: năm test cho lifecycle, lỗi pipe, callback lỗi và ranh giới đóng gói.
- `package.json`: build:launcher, build:portable, test:launcher.
- `package-lock.json`: sửa metadata version @pinojs/redact 0.5.0 → 0.4.0 để khớp resolved tarball/integrity vốn đã là 0.4.0;
  pino yêu cầu ^0.4.0. npm ci trước sửa vẫn cài 0.4.0, nên chỉ cài lại không giải quyết được metadata sai.
- `.gitignore`, `eslint.config.js`: bỏ qua binary/release output.
- `README.md`, `docs/PORTABLE.md`, `docs/TASKS.md`, handoff này: hướng dẫn và bằng chứng.

## Kiểm chứng

| Lệnh / bước | Kết quả thực tế |
| --- | --- |
| npm ci --ignore-scripts | Đồng bộ installed packages, 0 vulnerability được npm báo; chạy trước khi sửa metadata sai đã phát hiện |
| npm run check | Pass |
| npm run lint | Pass |
| npm test | 116/116 pass, không skip; ngoài sandbox để tạo junction Windows |
| npm run build:portable | Pass; build frontend/backend và tạo thư mục portable |
| npm run build:launcher | Pass sau sửa Dispose idempotent; cập nhật exe trong portable và xác minh SHA256 giống root |
| npm run test:launcher | Pass bảy nhóm: loại dữ liệu riêng, Node bundled/Unicode path, HTTP/UI/session/duplicate, stop/restart, trùng port, crash launcher, thiếu index.html |
| git diff --check | Pass |

Hai bài junction thất bại EPERM trong sandbox ở lần đầu; đã chạy lại thật ngoài sandbox, không bỏ test.
Native smoke phát hiện Windows dispose context nhiều lần khiến exit code 1 dù backend đã dừng;
đã sửa Dispose idempotent, sau đó smoke exit 0 và toàn bộ kiểm thử native pass.
Không mở browser thật trong bộ native test (dùng --no-browser/--smoke-test), không inference live, không sửa database người dùng.

## Artifact

- Root: `E:/Projects/ai-agent-office/AI Agent Office.exe` — dùng build/model/data hiện có tại project root.
- Portable: `E:/Projects/ai-agent-office/release/AI-Agent-Office-0.6.0-win-x64-1793248293467/`.
- Binary/release được ignore, cần build lại khi clone source.
- Bản portable không kèm VRM local; fallback hiện có được dùng. Cờ --include-local-models chỉ dành dùng riêng, chưa chạy bản opt-in này.

## Review, rủi ro và giới hạn

- Ready đến từ process do launcher tạo; không mở browser theo phản hồi HTTP của một dịch vụ bất kỳ trên port.
- Không lưu raw stdout/stderr provider trong launcher.log, chỉ mã lifecycle; giữ Host/Origin/session/CSRF như cũ.
- Log lifecycle giới hạn khoảng 256 KiB; output provider được drain liên tục, không giữ buffer vô hạn.
- Stop bình thường gọi đúng close hooks. Nếu quá 30 giây, taskkill /T /F có thể ngắt tác vụ đang ghi;
  lần sau runtime recovery xử lý interrupted theo cơ chế hiện có. Chưa ép thử nhánh force-kill trên run AI thật.
- Exe chưa ký số; Windows/SmartScreen có thể hỏi xác nhận. Cần .NET Framework 4.x và thư mục có quyền ghi.
- Node đi kèm theo kiến trúc máy build (bản đã tạo: Windows x64), provider CLI và login vẫn cần trên máy đích.
- Không thử trên máy Windows sạch khác, không thử browser mặc định/tray bằng tương tác GUI; native process/HTTP/lifecycle đã thử thực tế.
- Vite vẫn cảnh báo chunk 3D lớn (khoảng 1.145 MB minified), là giới hạn frontend hiện có.

## Cách kiểm tra lại

1. Tại source: npm run build, npm run build:launcher, nhấp đúp exe root. Nếu npm start/dev đang chạy, dừng trước.
2. Nhấp exe lần nữa để mở lại giao diện. Đóng tab vẫn giữ backend. Tray → Thoát và dừng công việc để dừng app.
3. npm run build:portable, rồi npm run test:launcher cho bộ native tự động không gọi AI.
4. Dừng cả hai app trước khi copy toàn bộ data/ từ source/bản cũ sang bản portable để giữ lịch sử.

## Follow-up thực sự

Ký số và kiểm thử trên Windows sạch nếu chuẩn bị phát hành cho người khác; chưa cần installer hoặc auto-update cho dùng cá nhân.
