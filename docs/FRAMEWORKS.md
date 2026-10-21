# So sánh framework và khuyến nghị

Ngày đánh giá: 20/10/2026. Đây là nhận định thiết kế cho dự án này.
Đặc tính nền tảng tham chiếu [nguồn chính thức](SOURCES.md); không phải benchmark đã đo trên máy người dùng.

## A — React / Vite + Node.js / Fastify — đề xuất

- Frontend: React + TypeScript + Vite; Three.js qua React Three Fiber.
- Backend local: Node.js + TypeScript + Fastify; worker là child process hoặc SDK được hỗ trợ.
- Dữ liệu: SQLite, migrations nhỏ; chọn driver sau khi kiểm tra runtime và Windows.
- Realtime: HTTP commands + WebSocket events với xác thực; chỉ thêm plugin cần thiết.
- Build/test dự kiến: một package manager, lockfile duy nhất; Vitest cho TS business logic, Playwright cho luồng trình duyệt sau khi đã scaffold.

Lý do: chia sẻ schema/DTO trong hệ TypeScript, phù hợp bridge tới công cụ AI và một UI SPA.
Fastify là lớp HTTP; business logic điều phối nằm ở module riêng, không nằm trong route handler.

Đánh đổi: cần quản lý process tree, cancellation, async error và giới hạn buffer cẩn thận trên Windows.
Không dùng tính đồng nhất TypeScript để cho frontend import module chứa secret hoặc filesystem.

## B — React / Vite + ASP.NET Core — lựa chọn tốt khi thích C#

- Frontend 3D giữ như A.
- Backend: ASP.NET Core, application service qua DI; BackgroundService cho scheduler.
- Realtime: SignalR, cần cấu hình resume/replay theo contract của ứng dụng.
- Dữ liệu: SQLite; cân nhắc EF Core nếu lợi ích migrations/conventions đáng giá.
- Adapter: ưu tiên protocol CLI/App Server được hỗ trợ; chỉ thêm bridge Node nếu SDK bắt buộc.
- Kiểm thử: framework test .NET theo scaffold, test frontend tương tự A.

Lý do: phù hợp conventions C#, cancellation và hosted service rõ ràng.
Đánh đổi: hai hệ type/build; cần OpenAPI/code generation hoặc contract test để ngăn DTO lệch.
Việc bọc SDK TypeScript có thể cần process bổ sung; không mặc định mọi tính năng có SDK .NET tương đương.

## C — Next.js + worker riêng — khi đã có mục tiêu web public

Next.js có Server/Client Components. Scene 3D vẫn cần chạy phía client.
Worker local hoặc service dài hạn vẫn tách riêng để giữ process, filesystem và session provider.
Đánh đổi: thêm ranh giới server/client, deployment và worker transport; MVP local chưa có nhu cầu SSR/SEO rõ ràng.
Không coi serverless request handler là nơi thích hợp để giữ agent process dài hạn.

## So sánh cho nhu cầu hiện tại

| Tiêu chí | A: TS / Fastify | B: .NET | C: Next.js + worker |
| --- | --- | --- | --- |
| Số hệ ngôn ngữ chính | Một | Hai | Một |
| Chia sẻ DTO frontend/backend | Trực tiếp qua package/schema | Qua OpenAPI/schema | Qua package/schema |
| Backend theo conventions .NET | Không | Có | Không |
| Phù hợp app local có 3D | Đề xuất | Phù hợp | Có thêm phần chưa cần |
| Cần dịch vụ sống dài cho agent | Có | Có | Có |
| Tiết kiệm token tự động | Không | Không | Không |

## Những dependency chưa nên thêm

Chưa cần Redis, Kafka, Kubernetes, vector database, microservices hoặc framework multi-agent lớn.
MVP dùng scheduler có state machine và adapter nhỏ, kiểm chứng được.
Chỉ thêm thư viện orchestration khi có yêu cầu cụ thể về workflow durable/phức tạp mà mã hiện có không giải quyết tốt.

## Quy tắc chọn phiên bản

Chọn release ổn định còn hỗ trợ tại thời điểm scaffold; ghi runtime/package chính trong README và lockfile.
Kiểm tra cặp React / React Three Fiber tương thích; không mặc định dùng bản alpha hoặc WebGPU.
Đo trên máy mục tiêu trước khi chốt chất lượng đồ họa hay số worker đồng thời.
