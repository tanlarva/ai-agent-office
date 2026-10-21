# Bảng công việc

Single writer: Orchestrator / Integrator. Baseline được người dùng chốt ngày 20/10/2026.
Frontend worker và reviewer đã bàn giao; không có worker đang giữ quyền sửa file.

## SESSION-WORKSPACE-02 — hoàn tất

Theo lựa chọn mới của người dùng: phiên dự án có tên/workspace, chọn lại phiên, cây thư mục và lọc lịch sử.
Source/schema, SQLite migration v2, HTTP API, frontend và tests đã cập nhật; 35 tests pass.
Kiểm tra trình duyệt tạo phiên không gọi AI và khóa workspace theo phiên.
Xem [SESSION-WORKSPACE-02](handoffs/SESSION-WORKSPACE-02.md) để biết file và cách thử.

| ID | Đầu ra | Trạng thái | Ownership / bằng chứng |
| --- | --- | --- | --- |
| DOC-00 | Tài liệu khởi tạo | done | Bộ tài liệu ban đầu |
| D-00 | Stack A, local Windows, Codex trước, live + 3D | done | DECISIONS, ADR-0001 |
| S-01 | Toolchain, source layout, dependency lock, scripts | done | Integrator; build/check/lint |
| C-01 | Schema run/task/event/structured outputs | done | src/shared/contracts.ts; contract tests |
| R-01 | Pipeline tuyến tính, state, quota, cancel, SQLite | done cho MVP | Integrator; regression tests |
| U-01 | UI thật, approvals/history/events/session | done | Frontend worker; handoff U-01 |
| V-01 | Cảnh 3D đơn giản và 2D fallback | done | Frontend worker; browser QA |
| P-01 | App Server/auth/catalog/turn và luồng đọc thật | partial | Live read passed; live write gặp 429 |
| I-01 | UI -> runtime -> provider -> review thật | done cho read-only | Bằng chứng trong IMPLEMENTATION-01 |
| Q-01 | Review độc lập, test lỗi và browser QA | done cho phạm vi đã kiểm | 26 tests + handoff reviewer |
| P-01-W | Live write/test/cancel/approval trên Windows | blocked hiện tại | Provider 429; thử lại khi hạn chế được gỡ |
| T-02 | Chế độ một agent cho task nhỏ | planned | Chưa triển khai |
| R-02 | DAG tùy biến, nhiều attempts và worktree manager | planned | Isolation trước parallel writer |
| P-02 | Adapter Claude | planned | Sau Codex và khi người dùng yêu cầu |
| M-01 | Benchmark single-agent và nhiều agent | planned | Chưa có bằng chứng tiết kiệm |

R-01 hiện chạy các template 3–5 vai trò tuần tự, không phải generic DAG scheduler.
I-01 không khẳng định nhánh ghi file live đã pass.
Chi tiết lệnh đã chạy, lỗi provider và phạm vi chưa xác minh ở [IMPLEMENTATION-01](handoffs/IMPLEMENTATION-01.md).

## Phối hợp lần sau

Integrator giữ contracts/manifest/lockfile và bảng này; worker chỉ sửa phạm vi được giao.
Đọc manifest/source trước khi đề xuất framework mới.
Mỗi task mới cần acceptance criteria, ownership và handoff; dùng [PARALLEL-WORK](PARALLEL-WORK.md).

## WORKFLOWS-03 — done

Bảy template, phiên mặc định/run snapshot, Developer/QA độc lập, phân quyền và đội 2D/3D.
49/49 tests với provider giả; check/lint/build pass. Chưa xác minh model live cho các mẫu mới.
Chi tiết: [WORKFLOWS](WORKFLOWS.md) và [bàn giao](handoffs/WORKFLOWS-03.md).

## AUDIT-04 — done

Template kiểm toán năm vai trò, tách rủi ro/bằng chứng/báo cáo/soát xét.
53/53 test provider giả; check/lint/build và browser chọn workflow. Chưa inference live audit.
Xem [AUDIT-04](handoffs/AUDIT-04.md).

## BALANCE-05 — done

Theo yêu cầu điều tiết tránh 429: gate bền vững, bounded backoff, quota gate, checkpoint chỉ đọc và UI/API.
72 tests provider giả; check/lint/build và kiểm tra UI. Không inference live cho thay đổi này.
Chi tiết file, giới hạn, backup và cách thử: [BALANCE-05](handoffs/BALANCE-05.md).

## OFFICE-LIFE-06 — done

Tám không gian theo workflow, robot gõ phím/chờ/đi bàn giao, điều khiển chuyển động, tham quan DEMO không gọi AI.
76 test provider giả; check/lint/build; browser kiểm tra các phòng và handoff. Không thay database/API/quyền.
Xem [OFFICE-LIFE-06](handoffs/OFFICE-LIFE-06.md).
