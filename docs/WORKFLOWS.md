# Quy trình và vai trò — v0.3.1

Người dùng yêu cầu nhiều vai trò cho nhiều quy trình ngày 20/10/2026.
Định nghĩa chuẩn nằm trong src/shared/workflows.ts; backend chọn template và tạo task thật từ đó.
Không nhận prompt hệ thống, quyền hoặc danh sách role tùy ý từ browser.

## Các mẫu có sẵn

Mỗi mẫu nhiều vai trò bắt đầu bằng Orchestrator xác định phạm vi, giả định và tiêu chí chấp nhận. Riêng “Một agent” chỉ có một bước để tiết kiệm lượt model.

| Mẫu | Các vai trò sau Orchestrator | Đầu ra cần kiểm tra |
| --- | --- | --- |
| Phát triển phần mềm | Business Analyst → Developer → QA / Tester → Code Reviewer | Yêu cầu/scenario, code/unit test, kiểm thử độc lập, review |
| Chiến dịch marketing | Market Researcher → Marketing Strategist → Copywriter → Brand Editor | Nguồn, đối tượng/KPI, nội dung, kiểm tra brief và claim |
| Thiết kế sản phẩm | UX Researcher → UI Designer → Design Reviewer | Luồng người dùng, đặc tả/UI code/SVG/HTML, accessibility và bàn giao |
| Phân tích nghiệp vụ | Business Analyst → Process Analyst → Business Reviewer | Yêu cầu, quy trình/ngoại lệ, truy vết và tính nhất quán |
| Nghiên cứu & báo cáo | Researcher → Research Analyst → Evidence Reviewer | Nguồn local, phân tích/báo cáo, kiểm chứng lập luận |
| Biên soạn nội dung | Content Researcher → Writer → Editor | Tư liệu/dàn ý, bản thảo, biên tập và kiểm chứng |
| Kiểm toán | Chuyên viên rủi ro → Kiểm tra bằng chứng → Lập báo cáo kiểm toán → Soát xét độc lập | Ma trận rủi ro, đối chiếu, hồ sơ phát hiện và báo cáo có dẫn chứng |
| Tổng quát | Builder → Reviewer | Quy trình ba vai trò tương thích phiên cũ |
| Một agent (v0.6) | (không có Orchestrator) Nhân viên tổng hợp | Việc nhỏ: tự làm và tự kiểm chứng; ghi rủi ro còn lại vì không có reviewer riêng |

## Phiên và lịch sử

Phiên mới lưu workflowId làm mặc định; không gọi model khi lưu phiên.
Khi giao việc, có thể chọn quy trình khác cho riêng công việc đó mà không đổi mặc định phiên.
Run lưu snapshot toàn bộ định nghĩa version 1, thứ tự, chuyên môn và quyền của từng bước.
Snapshot giúp lịch sử không bị đổi tên hoặc diễn giải lại khi template tương lai thay đổi.
Run và phiên cũ thiếu trường mới dùng Tổng quát; không sửa dữ liệu cũ, không cần migration SQL mới.

## Thực thi và quyền

Một worker toàn ứng dụng; 3–5 vai trò chạy tuần tự, mỗi vai trò một thread Codex riêng.
Role, model, process và nhân vật 3D là các khái niệm riêng. Mọi vai trò hiện dùng model đã chọn cho run.
Chỉ Developer, Copywriter, UI Designer, Process Analyst, Research Analyst, Writer, Lập báo cáo kiểm toán hoặc Builder
của đúng mẫu đang chạy được ghi khi run bật workspace-write.
Orchestrator, BA/nghiên cứu, QA và người review chỉ đọc; backend từ chối approval ghi của họ.

Developer có thể viết unit test. QA tự suy ra scenario từ mục tiêu và yêu cầu, đọc code và chạy kiểm thử sẵn có;
QA chưa được ghi thêm file test. Thiếu coverage bắt buộc phải báo findings, không tự duyệt.
QA của run ghi phải có command thành công được provider quan sát trong chính lượt QA;
không dùng kết quả Developer làm bằng chứng thay thế. Reviewer nhận cả handoff và kiểm tra workspace.

Vai trò thực hiện trả summary/blocked/files/tests theo schema; tests trong mẫu ngoài code mang nghĩa
command kiểm tra cấu trúc hoặc nội dung artifact. Mọi lượt ghi vẫn bắt buộc ít nhất một command kiểm tra
khớp commandExecution với exit 0. Command thành công không thay thế review ngữ nghĩa theo nghề.
QA/reviewer trả approved/summary/findings; có findings hoặc không approved thì run thất bại và dừng.
Handoff là dữ liệu không đáng tin, có giới hạn chiều dài; mục tiêu gốc luôn được chuyển riêng cho từng vai trò.

## Giới hạn thực tế

- Các mẫu dùng công cụ Codex và tài liệu local; chưa bật web search, image generation, đăng bài hoặc kết nối hệ thống nghiệp vụ.
- Quy trình chỉ đọc trả phân tích/đề xuất, không có file artifact mới. Cần nguồn hoặc đầu ra ngoài khả năng phải báo thiếu.
- Chưa có editor tự tạo role, model riêng từng role, DAG, nhiều worker đồng thời hoặc tự chọn/bỏ bước bằng AI.
- Chọn một mẫu thực thi đủ các bước của mẫu; Tổng quát có ba lượt, các mẫu khác bốn hoặc năm lượt.
- Nhiều vai trò có thể dùng nhiều token hơn. Chưa có benchmark chứng minh tiết kiệm, không tự suy ra giảm chi phí.
- Chưa xác minh inference live cho các mẫu mới; kiểm thử bằng provider giả và UI thật không tiêu hao model.

## Kiểm tra

Chạy npm run check, npm run lint, npm test, npm run build.
Kiểm thử workflows.test.mjs bao phủ mọi mẫu, tương thích cũ, snapshot, mặc định/override,
phân quyền, QA giả bằng chứng, findings và cancel giữa luồng.
Trình duyệt: Giao việc → phiên mới → chọn quy trình → xem đội, chuyên môn và quyền → lưu phiên chưa chạy AI.
Chọn lại phiên để kiểm tra mặc định; đổi mẫu cho công việc mới và kiểm tra lịch sử khi chạy.
Chạy live tiêu hao hạn mức; nên thử readonly trong thư mục mẫu nhỏ trước.

## Kiểm toán (v0.3.1)

Template audit có năm vai trò. Mục tiêu cần nêu loại kiểm toán (nội bộ/tài chính/tuân thủ),
kỳ, phạm vi, tiêu chí và hồ sơ cung cấp. Không tự giả định chuẩn mực, pháp luật hay ngưỡng trọng yếu.
Orchestrator xác định phạm vi; chuyên viên rủi ro tạo ma trận rủi ro–kiểm soát–thủ tục;
vai trò bằng chứng đối chiếu/tính lại trong khả năng công cụ local và ghi nguồn, mẫu, giới hạn bao phủ.
Vai trò báo cáo lập hồ sơ phát hiện: tiêu chí, hiện trạng, bằng chứng, tác động, nguyên nhân nếu có căn cứ,
kiến nghị và câu hỏi còn mở. Tài liệu không đọc được phải nêu rõ, không nhận đã kiểm tra.

Chỉ vai trò lập báo cáo có quyền ghi khi run bật workspace-write; các vai trò khác chỉ đọc.
Prompt yêu cầu báo cáo riêng trong audit-output, giữ hồ sơ nguồn; sandbox hiện giới hạn toàn workspace,
chưa cưỡng chế đường dẫn ghi chỉ trong audit-output. Nên chọn workspace hồ sơ làm việc phù hợp.
Chế độ chỉ đọc trả báo cáo trong summary; run ghi cần command kiểm chứng quan sát được như các mẫu khác.

Soát xét độc lập đánh giá chất lượng báo cáo, không phê chuẩn đơn vị được kiểm toán.
Sai lệch kiểm toán có bằng chứng được bàn giao trong báo cáo, không tự làm run thất bại.
Findings của structured review dành cho lỗi chất lượng báo cáo (claim thiếu nguồn, bỏ giới hạn, thiếu đầu ra).
Kết quả hỗ trợ kiểm toán, không phát hành/ký ý kiến đảm bảo hoặc chứng nhận kiểm toán nghề nghiệp.
Chưa tự kết nối ngân hàng, phần mềm kế toán hoặc cập nhật chuẩn mực qua web.

Kiểm chứng v0.3.1: 53/53 test provider giả, check/lint/build; chưa chạy inference live cho mẫu audit.
Xem [bàn giao kiểm toán](handoffs/AUDIT-04.md).

## Văn phòng theo workflow (v0.5)

| Workflow | Không gian | Đặc trưng |
| --- | --- | --- |
| software | Xưởng phần mềm | Máy chủ, màn hình code, trạm QA |
| marketing | Phòng chiến dịch | Poster chiến dịch, bảng ý tưởng, tông hồng |
| design | Studio thiết kế | Bảng màu, hình khối, bàn lục giác |
| business | Phòng quy trình | Sơ đồ luồng, bàn thảo luận |
| research | Thư viện nghiên cứu | Kệ sách, trạm phân tích, tông xanh |
| content | Toà soạn nội dung | Tư liệu, bản thảo, tông gỗ ấm |
| audit | Phòng kiểm toán | Hộp hồ sơ có nhãn, bàn đối chiếu |
| quick | Phòng cộng tác | Ba trạm, ghế lounge, tông xanh lá |

Không thay quyền/quy trình theo đồ hoạ. Không gian live đọc run.workflow; legacy dùng quick, khi chưa có run xem software.
Tham quan dưới scene cho phép xem mẫu độc lập, không cần tạo run thật.
