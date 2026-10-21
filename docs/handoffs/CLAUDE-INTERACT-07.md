# Bàn giao CLAUDE-INTERACT-07 — Orchestrator/Integrator (Claude Code)

- Ngày/giờ: 22/10/2026.
- Trạng thái: completed với provider giả; partial cho live Claude (chưa chạy lượt model thật).
- Baseline commit: 27a8663 (v0.5). Phiên bản sau thay đổi: 0.6.0.
- Branch / worktree: main, working tree trực tiếp (một agent, không có worker song song).
- Phạm vi: yêu cầu người dùng ngày 21/10/2026 — tích hợp Claude, nâng hiệu năng/animation 3D, giao việc dễ hơn, agent hỏi lại + nơi trả lời + thông báo, chen ngang, màn hình debug của nhân viên/bước đang làm.

## Kết quả và lý do

- **Provider Claude** (`src/server/claude.ts`): Claude Code CLI headless stream-json + control protocol. Không thêm dependency (SDK chính thức nặng ~330 MB/105 gói; ADR-0002). Chỉ chấp nhận thuê bao Claude.ai, chặn API key, không nạp hooks/settings/MCP của workspace, công cụ tối thiểu theo quyền bước.
- **Đa provider** (`src/server/provider.ts`, `runtime.ts`, `app.ts`): run có `provider`; điều tiết SQLite theo khóa provider (bảng cũ đã có cột provider, không migration). `/api/providers` trả cả hai, `/api/scheduling?provider=`.
- **Hỏi lại**: trạng thái `waiting_input`, `Inquiry` trong run. Claude: AskUserQuestion giữa lượt. Mọi provider: trường `questions` trong structured output ⇒ hỏi, chạy lại vai trò (≤ 2 vòng); bỏ qua ⇒ giữ kết quả, không tốn thêm lượt. Đồng hồ 20 phút tạm dừng khi chờ người, tối đa 2 giờ chờ.
- **Chen ngang**: `POST /api/runs/:id/notes` với `steer` (live nếu provider hỗ trợ, ngược lại lượt sau), `queued`, `interrupt` (dừng lượt, làm lại bước; ≤ 5 lần/bước). Kết quả của lượt bị chen ngang luôn bị bỏ, kể cả khi provider vẫn trả về.
- **Thông báo**: `GET /api/attention`, WebSocket gửi `attention` tới mọi socket; UI hộp thư, chuông, toast + âm, badge tiêu đề, Notification (opt-in).
- **Màn hình nhân viên** (`DebugConsole.tsx`, `debugFeed.ts`): lệnh, exit code, output rút gọn, diff Edit, file đã sửa, text agent đang soạn, checklist (TodoWrite/Codex `turn/plan/updated`), lịch sử trả lời/chen ngang. Codex adapter thêm output lệnh (`aggregatedOutput`) và đường dẫn file.
- **3D**: geometry/material dùng chung (trước: mỗi khối tạo BoxGeometry + material riêng), shadow chỉ cho khối đủ lớn, LED dùng chung một material, ticker 20 fps khi rảnh, giảm DPR khi khung hình chậm, camera OrbitControls có giới hạn. Robot: damping, chớp mắt, hướng về người dùng khi hỏi, giơ tay + dấu ?, gõ chân khi chờ duyệt, ăn mừng khi bàn giao, buồn khi lỗi, phụ kiện theo loại bước, đèn ngực theo provider, bảng tên; màn hình bàn hiện lệnh thật. Bấm robot ⇒ màn hình debug.
- **Giao việc nhanh** (`QuickAssign.tsx`, `suggest.ts`): một ô, nhớ dự án/provider/quyền (localStorage chỉ là tiện ích), gợi ý quy trình bằng từ khoá, mẫu câu, Ctrl+Enter, phím /. Hộp thoại đầy đủ có chọn provider và nhận nháp từ ô nhanh. Quy trình `solo` (T-02).
- **Lockfile**: `package-lock.json` có dòng `fast-json-stringify → @fastify/merge-json-schemas ^0.4.0` không tồn tại trên registry làm `npm ci` lỗi ETARGET; sửa về `^0.2.0` đúng metadata registry của fast-json-stringify@7.1.2. Không đổi phiên bản nào được cài.

## File thay đổi

- Mới: `src/server/claude.ts`, `src/server/provider.ts`, `src/shared/suggest.ts`, `src/web/{QuickAssign,InquiryCard,InterjectPanel,DebugConsole}.tsx`, `src/web/{debugFeed,useAttention}.ts`, `tests/claude.test.mjs`, `tests/interaction.test.mjs`, `tests/fixtures/fake-claude.mjs`, `docs/decisions/ADR-0002-…`, file này.
- Sửa: `src/shared/{contracts,workflows,office-scene}.ts`, `src/server/{runtime,codex,rpc,app,index,doctor,scheduling,store,store-worker}.ts`, `src/web/{App,NewRunDialog,OfficeScene,OfficeAgent,OfficeFurniture,api,labels,useOffice,styles.css,events.test.mjs}`, `tests/workflows.test.mjs` (bỏ giả định mọi mẫu bắt đầu bằng Orchestrator; thêm test riêng cho bất biến này + solo), `package.json` (0.6.0), `package-lock.json`, README, DECISIONS, TASKS, WORKFLOWS.

## Kiểm chứng

| Lệnh / bước | Kết quả | Đã chạy hay chỉ đề xuất |
| --- | --- | --- |
| npm ci | pass sau khi sửa lockfile (Node 26.2 cảnh báo engines 24.x) | đã chạy |
| npm run check | pass | đã chạy |
| npm run lint | pass | đã chạy |
| npm test | 104/104 pass; test mới chạy lặp 3 lần không flaky | đã chạy |
| npm run build | pass; chunk 3D ~956 KB (trước ~925 KB) | đã chạy |
| node dist/server/doctor.js | Claude: handshake thật OK, catalog 5 model, `signed_out` (môi trường chưa đăng nhập). Codex: không có CLI trên máy này | đã chạy |
| Trình duyệt: backend thật + provider giả (scratch, không commit) | giao việc nhanh, chọn Claude, 3D/zoom, màn hình nhân viên, steer live, câu hỏi + hộp thư + toast + badge, trả lời, chen ngang khi đang hỏi | đã chạy; phát hiện và sửa 4 lỗi (dưới) |
| Lượt model live Claude/Codex | — | chưa chạy |

Lỗi tìm thấy khi kiểm tra trình duyệt và đã sửa: ghi chú xếp hàng không tới vai trò kế tiếp; lệnh chen ngang bị mất nếu provider vẫn trả kết quả sau khi bị dừng; trạng thái kẹt `waiting_input` sau khi câu hỏi hết hạn; toast không tự tắt. Có test hồi quy cho hai lỗi runtime.

## Review

- Bảo mật: chỉ dẫn người dùng không mở rộng quyền; route mới qua cùng Host/Origin/cookie/CSRF; body giới hạn bởi zod; text đi qua `safeText`. Không ghi token/secret. Claude không thấy ANTHROPIC_API_KEY.
- Đồng thời: câu hỏi/phê duyệt gắn với AbortSignal của lượt; dừng lượt ⇒ từ chối/hết hạn, không để request treo.
- Hiệu năng: buffer sự kiện client 800 (trước 200); feed dựng bằng useMemo; giới hạn sự kiện mỗi run 6000 (trước 4000) do có thêm output lệnh.
- Còn mở: `inquiryAnswerSchema` không yêu cầu version (trạng thái pending là chốt chặn); bảng tên/màn hình dùng CanvasTexture, mỗi lần đổi trạng thái vẽ lại một canvas nhỏ.

## Rủi ro và giới hạn

- Giao thức stream-json/control của CLI là bề mặt của Agent SDK; CLI nâng cấp có thể đổi. Test dùng CLI giả nên không bắt được thay đổi đó.
- Exit code Bash của Claude suy ra từ `is_error` + “Exit code N”, không phải trường số chính thức.
- Codex: chưa có câu hỏi giữa lượt/steer; tên notification `turn/plan/updated` và `aggregatedOutput` chưa xác minh trên máy này (xử lý phòng thủ, thiếu thì bỏ qua).
- Một run tại một thời điểm vẫn giữ nguyên.

## Cách kiểm tra lại

1. `npm ci`, `npm run check`, `npm run lint`, `npm test`, `npm run build`.
2. `claude auth login` (thuê bao Pro/Max), `npm run doctor` ⇒ Claude `ready`, billingMode `claude_subscription`.
3. `npm start`, mở http://127.0.0.1:4310, chọn Claude, giao một việc **chỉ đọc** nhỏ trong workspace mẫu, ví dụ “Giải thích cấu trúc dự án; nếu cần chọn phạm vi hãy hỏi tôi”.
4. Trong lúc chạy: thử Gửi ngay, Dừng & làm lại, trả lời câu hỏi; bấm robot để mở màn hình nhân viên.
5. Bật thông báo, chuyển sang tab khác, chờ câu hỏi ⇒ có thông báo Windows.

## Bàn giao cho bước tiếp

- P-02-L: live test Claude (đọc, ghi có approval, hỏi, steer, interrupt, cancel, hết hạn mức) và ghi bằng chứng.
- P-01-S: xác minh App Server hỗ trợ hỏi người dùng/steer cho Codex rồi bật `interaction.steer`.
- Cân nhắc tách chunk 3D (three ~ 950 KB) nếu cần tải nhanh hơn.
