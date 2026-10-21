# Tiêu chuẩn kỹ thuật

Tóm lược hướng dẫn full-stack người dùng đã cung cấp, bổ sung quy tắc phù hợp dự án.
Đọc cùng AGENTS.md; áp dụng theo stack thực tế sau khi được chọn.

## Trước khi sửa

Hiểu và diễn đạt lại yêu cầu; đọc README, manifest, config và code liên quan.
Theo conventions hiện có, tái sử dụng utility trước khi thêm dependency.
Với thay đổi đáng kể: nêu thiết kế, phụ thuộc, lỗi có thể xảy ra và cách kiểm chứng trước khi code.
Không rewrite code đang hoạt động nếu không nêu được vấn đề cụ thể.

## Cấu trúc và chất lượng

SOLID/DRY/KISS/YAGNI là nguyên tắc cân nhắc; không tạo interface/class chỉ để đủ tầng.
Composition, module nhỏ, type rõ ràng; dependency trỏ về domain ổn định.
Refactor chỗ trùng lặp/rối khi nó cản trở thay đổi đang làm; không tiện tay đổi toàn bộ repo.
Không dùng any để né kiểu; dữ liệu bên ngoài validate runtime trước khi dùng.

## Backend và database

Route/controller mỏng, DTO tại boundary, business logic trong application/domain.
I/O async; cancellation truyền xuống provider, HTTP, DB và process nếu có hỗ trợ.
Không catch rồi bỏ lỗi; central error mapping, machine-readable code, message an toàn.
Structured log có traceId, runId/taskId khi phù hợp và duration; không ghi secret/PII.
Query chỉ lấy cột cần, paginate list/log, tránh N+1; index theo query đo được.
Transaction ngắn cho state + event; optimistic concurrency cho ghi tranh chấp.
Migration ưu tiên additive, có backup/rollback và kiểm thử upgrade.
API dùng resource, status đúng, envelope và sort/filter whitelist theo CONTRACTS.

## Frontend và đồ họa

Component nhỏ; UI state cục bộ, server state có nguồn duy nhất.
Không memo hóa hàng loạt khi chưa có bằng chứng; tránh cập nhật React mỗi frame.
Semantic HTML, labels, focus rõ, thao tác bàn phím, contrast AA và reduced motion.
Dùng design tokens cho màu/spacing/theme; scale 4/8 px, responsive, bảng 2D thay thế 3D.
Không để scene giữ bản sao task state có thể lệch backend.
Error/loading/empty/disconnected là trạng thái được thiết kế và kiểm thử.

## Quyền truy cập máy

Backend mặc định chỉ bind loopback. Kiểm tra Host/Origin, session/pairing và CSRF cho mutation phù hợp.
CORS đơn thuần không thay thế authentication. Dev server cũng không được mở công cụ cho mọi origin.
Workspace phải canonicalize đường dẫn, kiểm tra symlink/junction và giới hạn root khi đọc/ghi.
Không nhận shell command tùy ý từ browser. Process executable/args kiểm soát qua adapter/tool policy.
Ưu tiên spawn với args riêng và shell tắt; Windows .cmd/.bat cần xử lý theo tài liệu runtime, không ghép chuỗi từ input.
Child process cần timeout, giới hạn output và dừng process tree; cửa sổ helper chạy ẩn.
Worktree không phải sandbox; quyền command/network và credential vẫn phải giới hạn.
File/repo/provider output không được quyền nâng scope hoặc tự phê duyệt thao tác.

## Bảo mật ứng dụng

Parameterized SQL; output encoding, tránh raw HTML; CSP phù hợp.
AuthZ tại mọi endpoint/artifact và WebSocket subscription; không chỉ ẩn nút UI.
Server-side fetch chỉ tới provider targets được cấu hình; chặn URL nội bộ/metadata nếu có fetch từ input.
Secret qua cơ chế chính thức/secret store, không log hoặc stream; data/auth/log nằm ngoài commit.
Không tự vô hiệu hóa permission gate để task chạy xong.
Dependency tối thiểu, phiên bản khóa, kiểm tra license tài sản và dependency khi thêm.

## Review và bàn giao

Kiểm tra bug, biên, retry/cancel, leak process, query/log vô hạn, quyền, hiệu năng và readability.
Business logic mới phải có test; test lỗi quan trọng hơn test lặp implementation.
Báo tóm tắt thay đổi, file, lệnh đã chạy, rủi ro và hướng dẫn test thực tế.
