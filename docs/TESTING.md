# Kiểm chứng

Lệnh thật, chạy tại project root:

```powershell
npm run check
npm run lint
npm test
npm run build
npm run doctor
```

check kiểm tra TypeScript frontend/backend; lint dùng ESLint.
test compile backend rồi chạy node:test; không gọi model thật.
doctor kết nối App Server/account/model catalog/limits, không inference.
Live qua UI dùng quota ChatGPT; không nằm trong test mặc định.

## Coverage có ý nghĩa

- Contract validation và input boundary.
- Ba role theo thứ tự, usage, event sequence.
- Idempotency, một active run, model/quota/billing gate.
- Cancel lặp, timeout, cancel trong lúc final save.
- Approval stale/expired và từ chối approval cho read-only role.
- Test evidence khớp command/exit status và review gate.
- Atomic SQLite update/event, optimistic concurrency, transaction lỗi không làm lệch memory.
- Crash recovery không tự chạy lại, single-instance lock.
- Workspace root/ancestor/junction, Host/Origin/cookie/CSRF.
- Frontend replay/dedup, buffer bounded và mutation headers/idempotency.

Các test filesystem tạo thư mục tạm riêng. Windows có thể hạn chế tạo junction trong sandbox;
chạy dưới tài khoản có quyền tạo junction, không bỏ qua test để báo pass.
Test luôn cleanup thư mục tạm do chính test tạo.

## Kiểm tra thủ công/live

1. npm start, mở http://127.0.0.1:4310.
2. Tắt/bật 3D, kiểm tra bảng vai trò vẫn dùng được.
3. Giao tác vụ chỉ đọc cho workspace mẫu không có secret.
4. Kiểm tra từng role, terminal state, structured handoff và usage thực tế.
5. Reload trang: history/snapshot vẫn đúng, event replay không nhân bản.
6. Với task ghi được phép: kiểm tra file diff và test command thực tế trước khi tin kết quả.
7. Thử hủy và restart; không tự lặp side effect.

Bằng chứng lần chạy và giới hạn còn lại ở [IMPLEMENTATION-01](handoffs/IMPLEMENTATION-01.md).
Không coi việc catalog liệt kê model là bằng chứng tài khoản inference được model đó.

## Quy trình đa nghề v0.3

49 test tự động; workflows.test.mjs thêm 14 bài cho bảy template, quyền, snapshot, session default/override, QA và cancel.
Provider giả: không dùng hạn mức model; chưa có kết quả inference live cho mẫu mới.
Kiểm tra UI và giới hạn xem [WORKFLOWS](WORKFLOWS.md).

## Kiểm toán v0.3.1

53/53 test. Thêm nhánh audit trong bài dispatch mọi template và ba test: session mặc định + phân quyền;
sai lệch kiểm toán có bằng chứng vẫn bàn giao được; báo cáo thiếu nguồn bị soát xét từ chối.
Không dùng hồ sơ thật hoặc gọi model trong các test.

## Điều tiết v0.4

72/72 test provider giả; scheduling.test.mjs thêm 19 bài cho spacing, backoff/jitter, cap retry/budget, quota phụ/multi-bucket, cooldown bền vững, usage nhiều attempt, không replay writer, cancel/timeout, recovery, checkpoint từ QA và API auth/CSRF/idempotency.
Không inference thật để kiểm thử 429. Kết quả này chứng minh policy trong app, không chứng minh upstream sẽ hết 429.
Chạy npm run check, npm run lint, npm test, npm run build tại project root.
Kiểm tra UI: điều tiết ở sidebar; run 429 đủ điều kiện có nút Chạy tiếp từ vai trò lỗi; chờ có thời điểm gọi sớm nhất và vẫn hủy được.
Chỉ bấm chạy tiếp live khi chủ động dùng hạn mức tài khoản. Không sửa trạng thái lịch sử để giả kết quả thành công.

## Văn phòng sống động v0.5

76/76 test: bốn bài mới trong office-scene.test.mjs kiểm tra đủ trạm cho mọi workflow, legacy/empty mapping, đường đi nằm trong sàn và tránh bàn/cây với khoảng trống cho nhân vật, lấy mẫu tuyến đường và điều kiện chỉ bàn giao từ trạng thái live vừa quan sát.
Browser QA dùng preview provider giả tách DB ở 4311: tám phòng, chuyển task qua WebSocket, robot rời trạm, chờ, trở về; nút dừng chuyển động và bảng 2D.
Hộp tham quan: đổi phòng, bàn giao bước, reset, bật/tắt animation và đóng bằng Escape; không tạo run hoặc gọi inference.
Reduced motion được truyền vào cả scene live và tham quan; không ép bật lại khi hệ điều hành yêu cầu giảm chuyển động. Chưa có benchmark GPU/FPS đa thiết bị.
