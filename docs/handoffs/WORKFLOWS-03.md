# Bàn giao v0.3 — Nhiều quy trình và vai trò

Ngày 20/10/2026. Project: E:/Projects/ai-agent-office.

## Kết quả

Bổ sung sáu quy trình theo lĩnh vực: phần mềm, marketing, thiết kế sản phẩm, phân tích nghiệp vụ,
nghiên cứu/báo cáo và biên soạn nội dung. Giữ mẫu Tổng quát tương thích phiên/run cũ.
Đây là task và lượt provider thực sự theo template, không chỉ đổi tên nhân vật.
Quy trình phần mềm tách BA, Developer, QA và Reviewer sau Orchestrator.

Phiên lưu workflow mặc định, run cho phép override và lưu snapshot version 1.
Đội hình 2D/3D, số vai trò và bảng công việc theo snapshot. Mặc định chỉ đọc.
Backend kiểm soát quyền: chỉ người tạo artifact được ghi khi người dùng bật quyền cho run;
QA và người review chỉ đọc. QA của run ghi cần command kiểm thử thành công trong lượt QA.
Handoff có giới hạn từng bước để kết quả dài trước đó không loại bỏ bước QA gần nhất.

## File sửa / thêm

- src/shared/workflows.ts (mới): catalog bảy template, vai trò, chuyên môn và quyền.
- src/shared/contracts.ts: workflowId của request/session, snapshot Run, QA schema.
- src/server/runtime.ts: điều phối template, structured output, QA gate, quyền approval và handoff.
- src/server/project-sessions.ts: lưu workflow mặc định.
- src/server/codex.ts: client version 0.3.0.
- src/web/NewRunDialog.tsx: chọn workflow, xem phân công/quyền, mặc định phiên và override.
- src/web/labels.ts, App.tsx, OfficeScene.tsx, styles.css: đội hình, chi tiết và layout theo workflow.
- tests/workflows.test.mjs (mới): 14 test cho logic mới.
- package.json, package-lock.json: version 0.3.0; không thêm dependency.
- README.md, docs/WORKFLOWS.md (mới), CONTRACTS.md, DECISIONS.md, PRODUCT.md, TASKS.md, TESTING.md và báo cáo này.

## Kiểm chứng

check, lint, test, build đã qua. Tổng 49/49 test, không skip.
Test junction Windows chạy ngoài sandbox do sandbox không cho tạo junction fixture.
Các template đều được kiểm tra thứ tự và persistence với provider giả.
Kiểm tra session default/override, snapshot không bị client mutation, tương thích cũ,
quyền riêng Developer/QA, QA giả bằng chứng/findings và cancel giữa luồng.

Browser local: form đổi đội khi chọn marketing; lưu phiên chưa gọi AI; đóng/mở lại phiên
tự chọn đúng marketing và khóa workspace. Preview có DB riêng; không chép dữ liệu kiểm thử sang app chính.
Kiểm tra đội mặc định năm vai trò và cảnh 3D ở trạng thái chưa có công việc.
Không chạy inference live cho các template mới, không tiêu hao model trong QA tính năng này.

## Cách thử

1. Mở http://127.0.0.1:4310, tải lại trang, bấm Giao việc mới.
2. Tạo phiên, chọn quy trình và mở Xem phân công và quyền để xem từng chuyên môn.
3. Chọn workspace, lưu phiên chưa chạy AI; đóng rồi chọn lại phiên để xác minh mặc định.
4. Giao mục tiêu nhỏ trong workspace mẫu, giữ chỉ đọc để thử phân tích/đề xuất.
5. Xem các task/đội hình và tên quy trình; thử mẫu phần mềm để thấy Developer/QA riêng.
6. Bật ghi khi cần artifact thật; đọc command evidence, QA/review và lỗi nếu tiêu chí chưa đạt.

Chạy kiểm chứng từ project: npm run check; npm run lint; npm test; npm run build.
Live run sử dụng hạn mức tài khoản Codex.

## Giới hạn / rủi ro

Các mẫu dùng cùng Codex adapter và model của run, công cụ/tài liệu local. Chưa có web search,
image generation, đăng bài, kết nối nghiệp vụ hoặc lựa chọn tool riêng theo nghề.
Thiết kế hiện hỗ trợ đặc tả, UI code/SVG/HTML tùy nhiệm vụ; không tự nhận đã render hoặc test trình duyệt.
QA chỉ chạy/đánh giá kiểm thử có sẵn, chưa ghi file test mới. Thiếu coverage phải báo lỗi để người thực hiện sửa.
Command exit 0 chỉ là bằng chứng thực thi; chất lượng chuyên môn còn cần đọc review và nguồn.

Một run hoạt động toàn app, 3–5 lượt tuần tự. Chưa có role editor, model riêng vai trò,
DAG, agent song song hoặc tự rút gọn bước. Nhiều lượt có thể dùng nhiều token hơn.
Scene vẫn có chunk khoảng 918 KB minified, lazy load như trước.

Không có migration SQL mới; JSON thêm trường optional. Backup source/data trước cập nhật
ở thư mục work/before-workflow-update của chat; rollback bằng bản source v0.2 và build lại
khi app đã dừng. Không hoàn nguyên database mới bằng cách ghi đè dữ liệu công việc phát sinh sau update.

## Tiếp theo có ích

Editor tùy biến vai trò/đầu ra và lựa chọn bỏ bước có kiểm soát; đo usage thực tế trước khi đề xuất tiết kiệm token.
Kiểm thử inference live từng lĩnh vực với fixture nhỏ khi người dùng bắt đầu sử dụng.
