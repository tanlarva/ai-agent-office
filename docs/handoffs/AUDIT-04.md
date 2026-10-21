# Bàn giao v0.3.1 — Quy trình kiểm toán

Ngày 20/10/2026. Project: E:/Projects/ai-agent-office.

## Thay đổi

Thêm template audit gồm Orchestrator → Chuyên viên rủi ro → Kiểm tra bằng chứng →
Lập báo cáo kiểm toán → Soát xét độc lập. Template tự xuất hiện trong form và đội hình 2D/3D
qua catalog hiện có; giữ snapshot/default phiên và lịch sử tương thích.

Prompt yêu cầu phạm vi/kỳ/loại kiểm toán/tiêu chí được cung cấp, truy vết nguồn, ghi rõ giới hạn và
phân biệt quan sát, suy luận, thiếu hồ sơ. Chỉ audit-reporter được ghi khi run bật quyền;
các vai trò khác chỉ đọc. Báo cáo ghi ở audit-output theo hướng dẫn prompt, sandbox vẫn cấp phạm vi
toàn workspace cho người viết, chưa cưỡng chế thư mục con. Không tự sửa bút toán, ký hoặc phát hành ý kiến đảm bảo.

Sai lệch kiểm toán có bằng chứng được trình bày trong báo cáo. Review.approved đánh giá chất lượng
báo cáo; review.findings là lỗi báo cáo cần sửa, không phải toàn bộ danh sách sai lệch của đối tượng kiểm toán.

## File sửa / thêm

- src/shared/workflows.ts: thêm audit và bốn role chuyên môn.
- src/web/NewRunDialog.tsx: gợi ý khai báo đầu vào kiểm toán.
- tests/workflows.test.mjs: dispatch audit, session mặc định/phân quyền, bàn giao sai lệch và từ chối claim thiếu nguồn.
- package.json, package-lock.json, src/server/codex.ts, src/web/App.tsx: version 0.3.1; không thêm dependency.
- README.md, docs/WORKFLOWS.md, CONTRACTS.md, DECISIONS.md, TASKS.md, TESTING.md và báo cáo này.

## Kiểm chứng và cách thử

check/lint/test/build đã qua; 53/53 test, không skip, dùng provider giả và hồ sơ giả.
Không chạy inference live cho audit hoặc gửi hồ sơ kiểm toán thật trong QA tính năng.
Kiểm tra UI thật: chọn Kiểm toán, xem chuỗi năm vai trò và quyền từng vai trò.

Mở http://127.0.0.1:4310 → Giao việc mới → Quy trình làm việc → Kiểm toán.
Nêu loại kiểm toán, phạm vi/kỳ, tiêu chí và hồ sơ nguồn trong mục tiêu; chọn workspace tương ứng.
Mặc định chỉ đọc để phân tích/báo cáo trong summary. Bật ghi khi cần file báo cáo local.
Lưu phiên chưa chạy AI để giữ mặc định audit mà không gọi model.

Chạy từ project: npm run check; npm run lint; npm test; npm run build.

## Giới hạn / rủi ro / tiếp theo

Chỉ công cụ Codex và hồ sơ local; không có kết nối ngân hàng/phần mềm kế toán, cập nhật chuẩn mực
hoặc bảo đảm đọc mọi định dạng Excel/PDF. Hồ sơ không đọc được phải báo thiếu bằng chứng.
Kết quả là hỗ trợ kiểm toán, cần người có chuyên môn soát xét; không phải ý kiến kiểm toán được ký.
Chạy đủ năm lượt tuần tự có thể dùng thêm token. Inference live chưa xác minh.
Bước tiếp theo thực tế là kiểm thử bằng bộ hồ sơ mẫu nhỏ, tiêu chí rõ và đối chiếu kết quả với chuyên viên.

Source/data được sao lưu trước cập nhật tại work/before-audit-update của chat.
Không có SQL migration hoặc đổi output schema. Không hoàn nguyên database bằng cách ghi đè công việc mới.
