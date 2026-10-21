# Yêu cầu sản phẩm

Trạng thái: draft, dựa trên yêu cầu người dùng ngày 20/10/2026.

## Mục tiêu

Người dùng giao một mục tiêu cho Orchestrator và nhìn thấy ai đang làm gì, đang chờ gì, kết quả ở đâu.
Hệ thống hỗ trợ công việc lập trình thực tế: lập kế hoạch, thực hiện, chạy kiểm thử, review và bàn giao.
Cảnh văn phòng 3D là lớp quan sát tương tác, có bảng công việc và nhật ký để kiểm tra bằng chứng.

## Đã được yêu cầu

- Giao diện chạy trên trình duyệt, tham khảo cách trình bày văn phòng trong ảnh.
- Một điểm giao việc cho Orchestrator; có thể phối hợp nhiều agent.
- Tìm cách tận dụng Claude Pro và ChatGPT Plus cá nhân bằng tích hợp được hỗ trợ.
- Kiểm soát mức sử dụng/token; không hứa giảm token chỉ vì dùng nhiều agent.
- Chuẩn bị project và tài liệu để nhiều agent phát triển song song.
- Người dùng chọn cấu trúc/framework trước khi triển khai.

Ảnh là tài liệu tham khảo bố cục. Chưa có yêu cầu sao chép chính xác UI, tên agent hoặc tài sản hình ảnh.

## Giả định đang chờ xác nhận

- Máy Windows là nơi chạy backend, dùng cá nhân, không public internet.
- Giai đoạn đầu thao tác trên một repo mẫu do người dùng chọn.
- Ba vai trò ban đầu: Orchestrator, Builder, Reviewer; test runner là công cụ.
- Giao diện tiếng Việt; tên kỹ thuật và code tiếng Anh.
- Chưa có mục tiêu phục vụ nhiều người hoặc cloud 24/7.

## Luồng tối thiểu

1. Chọn workspace được cho phép và provider đã đăng nhập.
2. Nhập mục tiêu; Orchestrator tạo kế hoạch ngắn và các task có điều kiện hoàn thành.
3. Scheduler phân công công việc theo phụ thuộc, ngân sách và quyền truy cập.
4. Worker tạo thay đổi trong workspace riêng; test runner trả kết quả thật.
5. Reviewer xem diff và bằng chứng test; yêu cầu sửa trong giới hạn số vòng.
6. Hệ thống bàn giao tóm tắt, diff, kết quả test, rủi ro và việc còn lại.
7. UI cho phép xem log, hủy công việc và phản hồi yêu cầu phê duyệt thao tác.

## MVP đề xuất

Một backend local, một workspace được chọn rõ ràng, một provider thật trước, task board 2D và cảnh 3D đơn giản.
Có lịch sử run, lỗi dễ hiểu, hủy tiến trình, cảnh báo hạn mức và phục hồi UI sau reconnect.
Chế độ demo dùng fixture phải hiển thị nhãn DEMO và tách dữ liệu khỏi run thật.

## Chưa thuộc MVP

SaaS đa người dùng, thanh toán, chia sẻ tài khoản, avatar phức tạp, voice, marketplace agent,
đồ họa vật lý đầy đủ, mobile backend, tự deploy production và auto-merge thay đổi.

## Tiêu chí chấp nhận

- Trạng thái UI khớp run thật; mất kết nối không làm hiện “thành công”.
- Mỗi kết quả có task/run/attempt và nguồn bằng chứng.
- Không đánh dấu completed khi provider failed, test bắt buộc thất bại hoặc review còn lỗi chặn.
- Việc đơn giản không bắt buộc gọi đủ mọi vai trò.
- Có thể dùng bảng 2D bằng bàn phím khi 3D tắt hoặc không khả dụng.
- Tác vụ bị hủy ngừng nhận việc mới; báo rõ khi process chưa dừng hẳn.
- Hết hạn mức: tạm dừng/chờ hoặc cho người dùng chọn bước tiếp; không phát sinh API billing ngầm.
- Đo mức sử dụng theo những trường provider thực sự trả về; dữ liệu thiếu hiển thị “không có dữ liệu”.

## Đã triển khai v0.3

Nhiều mẫu theo lĩnh vực với vai trò, chuyên môn, đầu ra và quyền riêng; Developer/QA tách biệt.
Phiên lưu mẫu mặc định, run có snapshot và chọn mẫu riêng; đội hình 2D/3D phản ánh run.
Xem [WORKFLOWS](WORKFLOWS.md) cho khả năng và giới hạn thực tế. Các đề xuất scheduler tự chọn bước ở trên vẫn chưa triển khai.

## Đã triển khai v0.5 — không gian theo nghề

Theo yêu cầu nhân vật đi lại/bàn giao và văn phòng khác theo loại công việc.
Tám theme gắn với tám workflow, trạng thái gõ phím/chờ và hành trình bàn giao hữu hạn.
Chế độ tham quan riêng ghi rõ DEMO, không dùng model và không ghi database.
Không mô phỏng tiến độ thành công trong scene live hoặc tự thay đổi runtime vì animation.
