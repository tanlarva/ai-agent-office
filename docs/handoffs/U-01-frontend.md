# Bàn giao U-01 — frontend

- Ngày: 20/10/2026.
- Trạng thái: completed trong phạm vi frontend; chờ Integrator kiểm chứng trình duyệt với backend.
- Baseline: `src/shared/contracts.ts` schemaVersion 1 do Orchestrator cung cấp.
- Workspace: staging `work/implementation`; không thay manifest, lockfile, backend hay contract.
- Áp dụng frontend skill; lựa chọn A và triển khai đã được người dùng duyệt, thay trạng thái pending cũ trong AGENTS.

## Kết quả và lý do

React control room tiếng Việt, màu graphite/amber, CSS semantic tokens, không tải font/asset từ mạng. Sidebar chọn 30 run mới nhất, kết nối Codex, quota thực nếu có, biểu mẫu giao việc qua native dialog, mặc định chỉ đọc. Việc sửa file cần tick đồng ý rõ ràng. Backend vẫn kiểm tra đường dẫn/quyền; frontend không là ranh giới bảo mật.

Ba vai trò có trạng thái, nhiệm vụ và summary thật từ run. Procedural office 3D được lazy load riêng, có camera responsive và animation nhẹ khi runtime thật đang chạy; không gọi model từ animation. Có nút chuyển sang 2D, Canvas error boundary và fallback; bảng agent luôn dùng được bằng bàn phím. Tôn trọng prefers-reduced-motion.

Session/CSRF dùng HTTP same-origin. Tạo run giữ Idempotency-Key khi retry cùng nội dung, đổi key khi người dùng sửa yêu cầu. WS reconnect có backoff 1–15 giây và cleanup; HTTP replay có pagination, kể cả backlog lớn hơn 200 sự kiện khi kết nối lại; dedup theo sequence, buffer tối đa 200. Snapshot cập nhật theo version để response cũ không ghi đè run mới. Request của lựa chọn cũ bị abort khi đổi run. Approval dùng version hiện hành, không tự lặp thao tác chấp thuận khi gặp conflict; tải lại snapshot để người dùng xem lại.

Không có demo data hoặc phần trăm tiến độ giả. Token không đầy đủ hiển thị chưa có dữ liệu, không thay bằng 0. Hủy run chờ backend xác nhận trạng thái. Lỗi hủy gắn với đúng run ban đầu.

## File thay đổi

- `src/web/index.html`, `main.tsx`: entry Vite tiếng Việt, semantic metadata.
- `src/web/App.tsx`: dashboard, history, bảng agent, nhật ký, approval/cancel và 3D boundary.
- `src/web/NewRunDialog.tsx`: biểu mẫu mục tiêu/workspace/model/quyền.
- `src/web/OfficeScene.tsx`: office/bot/desk/plant tự tạo bằng Three geometry.
- `src/web/useOffice.ts`: bootstrap, selection và WS/replay lifecycle.
- `src/web/api.ts`: typed transport và bounded event merge.
- `src/web/labels.ts`: nhãn trạng thái/vai trò và định dạng thời gian/token.
- `src/web/styles.css`: semantic tokens, dark UI, responsive và reduced motion.
- `src/web/events.test.mjs`: 5 test về replay ordering, dedup, giới hạn bộ đệm, session/CSRF/idempotency và lỗi API/cancellation signal.
- Bàn giao này.

## Kiểm chứng đã chạy

| Lệnh | Kết quả |
| --- | --- |
| `node_modules/.bin/tsc.cmd -p tsconfig.web.json` | Pass |
| `node --test src/web/events.test.mjs` | 5/5 pass |
| `node_modules/.bin/vite.cmd build` | Pass; lazy Three chunk có cảnh báo kích thước |

Build cuối: main JS ~343 KB / gzip 106 KB; Three scene chunk ~918 KB / gzip 244 KB; CSS ~24 KB / gzip 6 KB. Cảnh 3D chỉ load khi bật, dpr tối đa 1.5, frameloop demand lúc không có agent chạy. Không thêm dependency.

## Review và giới hạn

Đã xem xét stale fetch, version conflict, reconnect gap, request lặp, event memory cap, keyboard dialog, provider chưa đăng nhập, unknown quota/token, no WebGL và reduced motion trong source. Chưa chạy browser QA hoặc live Codex trong phạm vi worker này; Integrator đang chịu trách nhiệm browser/live smoke test, không nên coi bản build là bằng chứng provider thật hoạt động.

UI chỉ hiển thị 30 run gần nhất và 200 sự kiện gần nhất; chưa có UI phân trang lịch sử cũ. Kích thước Three renderer tương đối lớn nhưng được lazy load. Không có orbit controls trong bản đơn giản này. Nên xem lại độ tương phản/khả năng đọc ở thiết bị thực, nhất là nhãn nhỏ.

## Cách kiểm tra lại

1. Chạy root build/start, mở `http://127.0.0.1:4310`.
2. Kiểm tra empty state; không có agent giả đang làm việc.
3. Mở Giao việc, thử Escape/tab/focus, xem read-only mặc định. Chỉ chạy thực khi provider ready và đã chọn đúng thư mục thử nghiệm.
4. Tạo run thật; so role states, event log và kết quả với backend. Thử đổi run khi đang nhận sự kiện.
5. Ngắt backend và kết nối lại: UI báo đang reconnect, không tự hoàn thành; replay nhật ký không lặp.
6. Thử approval, stale version, từ chối/hủy. Không chấp thuận lại tự động.
7. Chuyển 2D, giả lập WebGL không khả dụng, bật reduced motion; kiểm tra viewport 390/768/1440 và bàn phím.

## Bàn giao cho Integrator

Thêm `src/web/events.test.mjs` vào npm test nếu muốn suite chính chạy luôn 5 test này. Browser QA và live smoke test thuộc bước tích hợp. Không cần đổi contract/dependency.
