# Bàn giao MERGE-09 — Integrator

- Ngày: 29/10/2026. Baseline sau pull: f3af053 (main/origin/main), v0.6.0.
- Yêu cầu: “merge lại tôi vừa pull code vè”.
- Trạng thái: completed, xung đột được ghép và stage; không tạo commit mới.

## Kết quả

Bảy file conflict do stash apply sau fast-forward: README, TASKS, App, OfficeAgent, OfficeFurniture, OfficeScene, styles.
Đã lưu bản conflict và ba Git stage ở work/merge-f3af053 trước khi sửa. Không reset/abort/drop stash hoặc thay commit upstream.
App/scene/robot dùng phiên bản v0.6 làm nền rồi ghép lại anime có chủ đích;
README/TASKS/CSS giữ cả nội dung Claude lẫn anime. Source model/binary tải trước pull vẫn giữ.

Giữ đầy đủ hai provider, hộp thư/câu hỏi, chen ngang, thông báo, quick assign, debug/focus vai trò,
OrbitControls, adaptive DPR, bảng tên, màn hình lệnh thật, damping và geometry/material dùng chung.
Anime dùng chung state/controller với robot, vẫn có chọn nhân viên để mở debug.
Thêm pose VRM giơ tay khi waiting_input, ăn mừng và nhịp gõ chậm khi thinking.
Mẫu Solo mới không có Orchestrator nên dùng Amane; test không giả định mọi workflow đều có planner.

## File sửa trong bước merge

- README.md, docs/TASKS.md: giữ tài liệu cả hai phía.
- src/web/App.tsx: ghép theme/avatar/credits vào UI v0.6, giữ các event/focus/attention handler.
- src/web/OfficeAgent.tsx: giữ controller v0.6 và phụ kiện robot; lắp model/fallback và motion ref.
- src/web/OfficeFurniture.tsx: chỉ thêm màu má hồng vào bản geometry/material pool của upstream.
- src/web/OfficeScene.tsx: giữ camera/ticker/LOD/screens/picking, thêm VRM và trạng thái nạp.
- src/web/styles.css: giữ styles v0.6 và lớp Anime.
- src/web/agent-pose.ts, tests/anime-cast.test.mjs: tích hợp trạng thái mới và Solo.
- package-lock.json: lấy lock HEAD đã sửa dependency Fastify, chỉ thêm 14 entry pixiv; đồng bộ version 0.6.0.
- docs/DECISIONS.md, docs/decisions/ADR-0003-local-anime-cast.md: ghi ngoại lệ model ngoài theo yêu cầu người dùng.
- Bàn giao này; docs/handoffs/ANIME-CAST-08-integrator.md được bổ sung kết quả sau merge.

Các file model/loader/theme mới đã có trước pull vẫn được giữ; xem bàn giao ANIME-CAST-08 để có danh sách đầy đủ.

## Kiểm chứng

- npm run check, npm run lint, npm run build: pass.
- npm test ngoài sandbox (test junction Windows): 111/111 pass, gồm Claude giả, hỏi/steer/cancel, runtime security, model validation/pose/mapping.
- npm ci --dry-run --ignore-scripts: pass, không thay node_modules. Bản offline đầu tiên không đủ npm cache, không phải lỗi lock.
- Giữ bản sửa @fastify/merge-json-schemas ^0.2.0 của upstream, không khôi phục metadata lỗi ^0.4.0 của baseline cũ.
- Browser 127.0.0.1:4311 với provider giả và DB riêng: QuickAssign, hai provider, hộp thư/badge, câu hỏi, chen ngang, debug,
  trạng thái waiting_input và năm model thật hiển thị đồng thời; chọn đáp án và gửi trả lời tiếp tục workflow.
- Không bật thông báo OS hoặc gọi model AI thật. Ảnh: work/anime-merge-v06.jpg.

## Rủi ro và cách thử

Asset VRM khoảng 86.4 MiB, chưa benchmark GPU; giữ 2D/Cổ điển. Không commit binary hoặc phát hành build public có model.
Vẫn giữ giới hạn live Claude/Codex upstream đã ghi; kiểm tra merge dùng fake provider.

Chạy npm start, mở http://127.0.0.1:4310. Thử Anime/Cổ điển, tham quan/Solo và chọn vai trò xem debug.
Khi muốn chạy việc thật, chọn đúng provider đã đăng nhập và workspace như README; merge không tự tạo run thật.
