# Bàn giao SESSION-WORKSPACE-02

Ngày: 20/10/2026. Phiên bản: 0.2.0.
Người dùng đã chọn phiên theo dự án Agent Office, đặt tên, gắn workspace và gom lịch sử nhiệm vụ.

## Thay đổi và lý do

Form giao việc có bộ chọn phiên cũ/tạo phiên mới, tên phiên và cây thư mục.
Workspace phiên cũ được điền tự động và khóa; backend cũng kiểm tra binding để ngăn task ghi sang thư mục khác.
Có nút lưu phiên riêng, chưa gọi AI; chạy task tiếp tục dùng pipeline Codex cũ.
Lịch sử lọc theo phiên, chi tiết run hiện tên phiên. Legacy run được giữ nguyên.
Cây duyệt từng cấp trong root dự án, không đọc nội dung file hoặc quét toàn ổ đĩa.

## Files

- package.json, package-lock.json: version 0.2.0, không thêm dependency.
- src/shared/contracts.ts: ProjectSession, FolderPage, sessionId optional.
- src/server/project-sessions.ts: tạo phiên, validation workspace, idempotency.
- src/server/folders.ts: duyệt thư mục có scope, giới hạn và chống symlink/junction.
- src/server/store-worker.ts, store.ts: migration v2 và truy vấn phiên/filter.
- src/server/runtime.ts: gắn và kiểm tra session/workspace trước dispatch.
- src/server/app.ts: session/folder endpoints và run filter.
- src/server/codex.ts: client version metadata.
- src/web/FolderPicker.tsx: cây thư mục lazy load, chọn và phân trang.
- src/web/NewRunDialog.tsx: chọn/tạo/lưu phiên, workspace picker.
- src/web/api.ts, useOffice.ts, App.tsx: API, bộ lọc và hiển thị phiên.
- src/web/styles.css: layout picker responsive, dùng tokens hiện có.
- tests/sessions.test.mjs, src/web/events.test.mjs: tests mới.
- README.md, docs/CONTRACTS.md, DECISIONS.md, TASKS.md: tài liệu cập nhật.

## Kiểm chứng

- TypeScript, ESLint và build đã chạy thành công trên bản sửa.
- 35/35 node:test pass: session persistence, idempotency, scope binding, history filter,
  additive migration giữ legacy run, folder pagination/junction/traversal và API authentication.
- Browser: mở cây E:/Projects, chọn sample_project, tự điền tên/workspace, lưu phiên riêng,
  xác nhận workspace read-only khi chọn phiên cũ. Việc lưu chỉ tạo metadata trong DB kiểm thử.
- Không gửi prompt model trong kiểm thử tính năng mới.

## Cách thử

1. Mở app, bấm Giao việc mới.
2. Chọn Tạo phiên dự án mới, đặt tên.
3. Bấm Chọn thư mục, mở nhánh, bấm tên thư mục và Dùng thư mục này.
4. Bấm Lưu phiên, chưa chạy AI. Workspace được khóa với phiên vừa lưu.
5. Đóng form, chọn phiên ở bộ lọc lịch sử; mở form lại và chọn phiên đã lưu.
6. Giao mục tiêu khi muốn chạy AI; run sẽ thuộc phiên đã chọn.

## Giới hạn và rollback

Phiên dự án không resume conversation Codex; mỗi role vẫn có thread riêng.
Root cây mặc định là parent app (E:/Projects ở bản cài này); root khác qua OFFICE_WORKSPACE_ROOT.
Thư mục thay đổi trong khi phân trang có thể cần đóng/mở cây lại; không có filesystem snapshot.
Chưa có rename/delete phiên hoặc tự gắn run cũ vào phiên.
Migration chỉ thêm cột nullable/bảng/index. Sao lưu data khi app dừng trước nâng cấp.
Rollback source không cần xóa cột mới; không phục hồi DB cũ sau khi đã có dữ liệu mới mà chưa backup.
