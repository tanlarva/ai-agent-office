# BALANCE-05 — Điều tiết Codex v0.4.0

Ngày 20/10/2026. Yêu cầu: giảm lỗi 429 khi các vai trò gọi Codex liên tiếp.

## Thay đổi và lý do

Một worker vẫn điều phối tuần tự. ProviderGovernor lưu cooldown trong SQLite, giãn ít nhất 15 giây sau một lượt; 429 tạm thời chỉ tự thử lại bước chỉ đọc tối đa hai lần. Backoff cơ sở 60/120 giây, cộng jitter 0..20%; chuỗi lỗi tăng tiếp nhưng không chiếm worker chờ quá ngân sách 5 phút. Tổng run vẫn giới hạn 20 phút, gồm thời gian chờ.

Quota rõ ràng hoặc cửa sổ tài khoản được báo hết sẽ dừng, không tự retry hay chuyển API billing. Kiểm tra trước mỗi role/attempt, không chỉ lúc tạo run. Thời gian reset nếu có dùng để kéo dài cooldown; không suy ra giờ reset khi thiếu dữ liệu. App Server stdio không cung cấp HTTP Retry-After nên app không giả xử lý header này.

Writer và bước có bằng chứng fileChange không tự replay. Run lỗi 429 có phần còn lại chỉ đọc được tạo lượt tiếp tục mới; giữ prefix thành công và handoff, không gọi lại Developer. Run nguồn bất biến. Checkpoint được truyền như dữ liệu không đáng tin; QA/Reviewer vẫn phải kiểm tra workspace và bằng chứng thực tế. Lượt tiếp tục không đảm bảo workspace chưa đổi từ lần trước.

UI có policy, trạng thái chờ, giờ thử sớm nhất, số attempt và nút chạy tiếp từ role lỗi. Usage cộng các attempt khi đầy đủ; thiếu số liệu giữ null. Prefix kế thừa ghi 0 token cho run mới, không xóa chi phí lịch sử.

## File thay đổi

- src/server/scheduling.ts, provider-errors.ts, provider-limits.ts: gate, phân loại lỗi, cửa sổ quota.
- src/server/runtime.ts, codex.ts: bounded dispatch/retry, checkpoint, parser lỗi provider.
- src/server/store.ts, store-worker.ts: SQLite migration v3 chỉ thêm provider_cooldowns.
- src/server/app.ts; src/shared/contracts.ts, retries.ts: API và ranh giới tiếp tục an toàn.
- src/web/api.ts, useOffice.ts, App.tsx, labels.ts, styles.css: điều tiết/chờ/chạy tiếp.
- tests/scheduling.test.mjs; runtime.test.mjs, sessions.test.mjs, workflows.test.mjs: logic mới, cấu hình test không chờ thật, migration.
- README.md, docs/CONTRACTS.md, DECISIONS.md, TASKS.md, TESTING.md, bàn giao này; package.json/package-lock.json tăng 0.4.0. Không dependency mới.

## Kiểm chứng

npm run check, npm run lint, npm test: 72/72 pass, npm run build pass.
Provider giả kiểm tra backoff/jitter/cap/ngân sách, quota đa cửa sổ, restart, cancel/timeout, không replay writer, usage, idempotency và tiếp tục từ QA không gọi Developer.
UI tại môi trường riêng port 4311 bằng provider giả: bấm chạy tiếp từ QA, quan sát waiting_capacity và hủy trong lúc chờ. Không chèn dữ liệu giả vào database live. Không inference Codex thật cho thay đổi này.

Build vẫn cảnh báo chunk 3D lớn (~918 KB minified); scene đã lazy load. Không liên quan điều tiết và không thêm asset/dependency.

## Cách thử

1. npm start tại E:/Projects/ai-agent-office, mở http://127.0.0.1:4310. Sidebar hiển thị 15 giây / tối đa 2 lần thử lại.
2. Chọn run demo game cũ lỗi 429 ở QA: có nút Chạy tiếp từ QA / Tester. Bấm sẽ dùng hạn mức thật, tạo run mới giữ nguyên prefix; không phải fake success.
3. Khi gặp 429, quan sát Chờ điều tiết và thời điểm sớm nhất; Dừng công việc vẫn dùng được. Quota hết rõ ràng thì chờ reset.
4. Có thể đặt OFFICE_CALL_GAP_MS (1000..120000) và OFFICE_RATE_RETRIES (0..2) trước start. Không có cấu hình vượt cap retry từ browser.

## Rủi ro, phục hồi và giới hạn

App Server có retry nội bộ; mức hai lần là bổ sung và vẫn có thể tiêu hao hạn mức. Gate chỉ điều tiết các turn Agent Office gửi, không các client Codex khác hoặc request nội bộ một turn. Không đảm bảo hết 429 hoặc giảm token. Chưa có benchmark tiết kiệm.
Mọi bucket được provider báo hết đều làm app dừng một cách bảo thủ; chưa ánh xạ bucket vào model cụ thể. Hạn mức không có dữ liệu vẫn là chưa biết.
Restart đánh dấu run dở interrupted, giữ cooldown, không tự resume. Muốn rollback: dừng app, phục hồi source và toàn bộ data từ backup trước cập nhật, build lại; không copy DB khi process đang chạy. Backup local của lần cập nhật được lưu riêng trong workspace công việc trước khi ghi E drive.

Follow-up hữu ích: chế độ một agent cho tác vụ nhỏ để giảm số lượt, đo token thực tế trước khi tuyên bố tối ưu.

Nguồn: [OpenAI exponential backoff](https://developers.openai.com/api/docs/guides/rate-limits), [Codex App Server errors và account rate limits](https://learn.chatgpt.com/docs/app-server). Không coi ngưỡng API là hạn mức thuê bao ChatGPT.
