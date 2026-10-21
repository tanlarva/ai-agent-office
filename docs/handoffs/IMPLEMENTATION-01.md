# Bàn giao IMPLEMENTATION-01 — MVP Codex local

Ngày: 20/10/2026. Baseline: ADR-0001, stack A được người dùng chọn.

## Kết quả

Đã triển khai React/Vite/TypeScript, văn phòng 3D bằng React Three Fiber, Fastify,
SQLite worker và Codex App Server stdio dùng account type chatgpt.
Ba vai trò chạy tuần tự trong ba thread riêng. UI hiển thị task, command, exit code, usage, approvals và lịch sử thật.
Read-only mặc định; quyền ghi opt-in. Không tạo API key hoặc chuyển billing khi lỗi/hết quota.

## File/nhóm thay đổi

- package.json, package-lock.json: dependency và lệnh chạy.
- tsconfig.server.json, tsconfig.web.json, vite.config.ts, eslint.config.js, .gitignore: toolchain.
- src/shared/contracts.ts: validation, DTO, structured outputs.
- src/server/app.ts, index.ts, doctor.ts: API, session, CSRF, realtime và startup.
- src/server/rpc.ts, codex.ts: CLI resolution, JSON-RPC, billing, model, lifecycle và approvals.
- src/server/runtime.ts: pipeline, state, evidence gates, idempotency và cancellation.
- src/server/store.ts, store-worker.ts: async bridge, SQLite transactions và replay.
- src/server/workspace.ts, instance-lock.ts, errors.ts: scope, lock, error/redaction.
- src/web/: dashboard, form, 3D/2D, transport, styles và frontend tests.
- tests/runtime.test.mjs: backend/regression tests.
- README, AGENTS, DECISIONS, CONTRACTS, TESTING, TASKS, ADR-0001 và handoffs: tài liệu cập nhật.

## Kiểm chứng đã chạy

| Kiểm chứng | Kết quả |
| --- | --- |
| npm run check | PASS |
| npm run lint | PASS |
| npm test | 26/26 PASS, không skip |
| npm run build | PASS; cảnh 3D lazy chunk khoảng 918 KB minified |
| npm audit --omit=dev --audit-level=moderate | 0 vulnerabilities tại lần chạy |
| doctor với Codex CLI 0.144.6 | ChatGPT / plus, catalog và rate-limit response có thật |
| Prompt structured output ngắn, không tool | PASS |
| Browser live pipeline chỉ đọc README mẫu | Ba vai trò succeeded, 48 events |
| Browser desktop/mobile, toggle 2D/3D | Đã kiểm tra trực tiếp; sửa nhãn 2D sau kiểm tra |
| Live ghi hai file + node:test trong fixture riêng | Chưa xác minh: provider trả 429 Too Many Requests |

Run chỉ đọc thành công: 846e1f94-e55c-4e45-986f-5bac52293712.
Tổng usage hiển thị lần này là 100.000 tokens từ provider; chưa phân tách cache billing hay quy đổi chi phí.
Kiểm tra trước đó thất bại khi chọn model theo config; đã đổi mặc định sang catalog thực tế và luồng sau succeeded.

## Review và sửa lỗi

Reviewer độc lập chỉ đọc source; frontend worker giữ phạm vi src/web riêng.
Đã sửa memory mutation trước durable save, workspace ancestor escape, duplicate-process recovery,
cancel-finalization race, test evidence khi file được ghi qua shell và PowerShell wrapper matching.
Regression tests cover transaction failure, cancellation race, single-instance và scope.

## Giới hạn và rủi ro

- Nhánh ghi/test thật còn cần chạy lại khi provider cho phép; fake tests không thay live sandbox validation.
- Exit-code matching xác nhận execution, không chứng minh test có chất lượng đầy đủ.
- Prompt không thay quyền sandbox OS. Review scope trước khi bật ghi và duyệt command cụ thể.
- Pipeline luôn ba vai trò; tác vụ nhỏ có thể tốn token hơn một agent. Chưa benchmark tiết kiệm.
- Chưa có Claude, parallel runtime workers, worktree manager, auto-repair, artifact download hoặc cloud.
- UI lấy 30 run gần nhất; backend có cursor. Log UI giữ 200 event gần nhất.
- Chunk renderer lớn dù đã lazy load; cần đo trên máy yếu trước khi thêm asset.

## Cách kiểm tra lại

README hướng dẫn npm ci, npm run doctor, npm run build, npm start và http://127.0.0.1:4310.
Chọn workspace mẫu không có secret, giao nhiệm vụ chỉ đọc và xem ba handoff.
Với ghi file, bật quyền ghi ở run mới, dùng repo thử và xem diff/test evidence sau khi hoàn tất.
Hết quota hoặc 429: đợi provider cho phép; app không tự retry model hay chuyển API.

## Bước tiếp có giá trị

Thử lại live write/cancel/approval khi hết rate limit; thêm chế độ một agent cho việc nhỏ,
sau đó worktree manager trước parallel writer và adapter Claude khi được yêu cầu.
