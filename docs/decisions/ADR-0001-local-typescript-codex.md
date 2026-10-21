# ADR-0001 — Local Windows, TypeScript và Codex trước

- Trạng thái: accepted.
- Ngày: 20/10/2026.
- Người quyết định baseline: người dùng.
- Căn cứ: “Chọn A, chạy local Windows, tích hợp thật và 3D đơn giản, Codex trước.”

## Bối cảnh

Cần app cá nhân quan sát agent lập kế hoạch, viết code, test và review.
Ưu tiên tận dụng đăng nhập Codex bằng ChatGPT, kiểm soát hạn mức và cho các agent phát triển làm việc theo phạm vi file.

## Các phương án

A: React/Vite + Node/Fastify; B: React + ASP.NET Core/SignalR; C: Next.js + worker riêng.
Người dùng chọn A; xem FRAMEWORKS để đọc đánh đổi ban đầu.

## Quyết định

React + TypeScript + Vite và React Three Fiber cho UI; Fastify local trên Node 24.
SQLite built-in trong worker thread. App Server stdio là adapter Codex; không có raw API integration.
Backend kiểm tra account mode chatgpt và không truyền API key environment cho provider.
Source ban đầu gồm src/shared, src/server, src/web. Chưa cần workspace monorepo phức tạp.

## Giới hạn MVP có chủ ý

Ba role tuần tự trong thread riêng, task graph cố định, một run tại một thời điểm.
Workspace do người dùng chọn; read-only mặc định, Builder ghi chỉ khi được chọn.
Không tự worktree/merge/deploy; không thêm Claude cho tới khi Codex hoạt động và được đánh giá.
Node SQLite là I/O sync bên trong worker riêng, API gọi worker bằng Promise để giữ HTTP async.

## Kiểm chứng và hệ quả

Toolchain, test tự động, browser và kết quả live được ghi trong IMPLEMENTATION-01, không suy ra từ tên package.
Hạn mức subscription vẫn áp dụng. Chi phí thực tế cần benchmark; UI 3D không tạo model calls.
Chunk renderer lớn được lazy load; 2D fallback vẫn dùng được.
Sau khi có nhu cầu parallel writer, cần worktree manager và conflict policy trước khi tăng concurrency.

## Phối hợp triển khai

Integrator giữ contracts/manifest/lockfile/backend và tài liệu baseline.
Worker frontend chỉ sửa src/web và handoff riêng; reviewer chỉ đọc source, ghi handoff riêng.
Mọi nhánh tích hợp tuần tự; không khởi tạo chat mới để làm subtask.
