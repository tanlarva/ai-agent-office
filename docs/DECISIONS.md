# Quyết định baseline

Ngày 20/10/2026, người dùng xác nhận: “Chọn A, chạy local Windows, tích hợp thật và 3D đơn giản, Codex trước.”

| ID | Trạng thái | Baseline | Căn cứ |
| --- | --- | --- | --- |
| D-01 | accepted | Local Windows, UI trình duyệt, backend loopback | Người dùng xác nhận |
| D-02 | accepted | React + TS + Vite; Node.js + Fastify; SQLite; React Three Fiber | Người dùng chọn A |
| D-03 | accepted | Luồng thật cùng 3D đơn giản | Người dùng xác nhận |
| D-04 | accepted, mở rộng bởi D-11 | Codex trước; Claude sau | Người dùng xác nhận; Claude thêm ngày 22/10/2026 |
| D-05 | baseline kỹ thuật | Chỉ đọc mặc định; quyền ghi opt-in từng run, approval của thao tác cụ thể | Áp dụng least privilege, không suy ra quyền rộng từ việc chọn stack |

Chi tiết: [ADR-0001](decisions/ADR-0001-local-typescript-codex.md).
Lịch sử các phương án A/B/C và đánh đổi ở [FRAMEWORKS](FRAMEWORKS.md).

## Quyết định triển khai trong phạm vi baseline

- npm và một lockfile; Node.js 24.x.
- Source theo src/server, src/web, src/shared thay vì tách nhiều package rỗng.
- SQLite built-in chạy worker thread, không thêm native SQLite dependency.
- Pipeline ban đầu cố định ba role tuần tự; một run hoạt động toàn ứng dụng.
- Ba thread độc lập với handoff ngắn; không chia sẻ toàn bộ lịch sử model.
- Ban đầu không retry. D-09 bổ sung retry 429 có giới hạn cho bước chỉ đọc; vẫn không auto-repair hoặc replay writer.
- Model mặc định lấy từ catalog App Server thực tế; catalog không bảo đảm inference thành công.
- Không tạo API key; provider phải xác nhận account type chatgpt.
- Chỉ các approval command/file được hỗ trợ, một lần; không cấp acceptForSession hoặc đổi exec policy.
- Chưa git init tự động vì môi trường hiện tại hạn chế kiểm tra parent repo E:/Projects.

## Khi nào cần quyết định mới

Thêm Claude, public hosting, nhiều người dùng, tăng quyền máy, auto-merge/deploy,
đa writer trên nhiều worktree hoặc chuyển sang API billing cần nêu thay đổi rõ ràng.
Chi tiết nhỏ tương thích baseline được agent tự xử lý theo AGENTS.

## D-06 — Phiên dự án và chọn workspace

Accepted ngày 20/10/2026: người dùng chọn “Phiên theo dự án trong Agent Office: đặt tên, gắn thư mục, gom các nhiệm vụ cùng dự án”.
Triển khai ProjectSession lưu SQLite, binding workspace phía backend và bộ lọc lịch sử theo phiên.
Không tích hợp chọn/resume cuộc hội thoại Codex có sẵn trong thay đổi này.
Cây thư mục lazy load qua backend local trong root dự án; giữ nhập đường dẫn để tương thích.
Tạo/lưu phiên riêng không gọi model. Không có dependency mới.

## D-07 — Nhiều quy trình, vai trò theo nghề

Accepted ngày 20/10/2026 theo yêu cầu “phân nhiều vai trò cho nhiều quy trình làm việc”.
Bảy template được kiểm soát phía server, gồm sáu lĩnh vực và Tổng quát tương thích cũ.
Tách Developer/QA; phiên có mặc định, run lưu snapshot; các bước chạy tuần tự với quyền tối thiểu.
Xem [WORKFLOWS](WORKFLOWS.md). Chưa triển khai role editor hay DAG tùy biến.

## D-08 — Bổ sung kiểm toán

Accepted ngày 20/10/2026 theo yêu cầu “kiểm toán nữa”. Template audit dùng năm vai trò,
đối chiếu tài liệu local và soát xét báo cáo độc lập; giữ phân quyền, không tích hợp hệ thống kế toán bên ngoài.

## D-09 — Điều tiết hạn mức và tiếp tục workflow

Accepted ngày 20/10/2026 theo yêu cầu cơ chế balance tránh 429.
Giữ một worker, thêm gate chung theo provider, không chia tài khoản/model để vượt quota.
Mặc định gap 15 giây; backoff cơ sở 60 giây tăng gấp đôi, cơ sở tối đa 300 giây, jitter 0..20%; tối đa 2 lần thêm và ngân sách chờ retry 300 giây.
Quota rõ ràng không tự retry. Cooldown lưu DB; restart không tự replay run. Writer không tự retry.
Manual retry chỉ khi phần còn lại chỉ đọc, tạo run liên kết lịch sử; prefix thành công kế thừa handoff.
SQLite migration v3 chỉ thêm provider_cooldowns. Không thêm dependency.
Hạn mức chưa biết không được coi là không giới hạn; không khẳng định tiết kiệm token.

Tham khảo: [OpenAI backoff](https://developers.openai.com/api/docs/guides/rate-limits) cho thuật toán; [Codex App Server](https://learn.chatgpt.com/docs/app-server) cho lỗi turn và cửa sổ hạn mức tài khoản. Không áp các ngưỡng API vào thuê bao ChatGPT.

## D-10 — Văn phòng theo quy trình và chuyển động có trạng thái

Accepted ngày 20/10/2026 theo yêu cầu làm nhân vật di chuyển khi hoàn thành và phòng khác theo công việc.
Ánh xạ phòng theo workflow đã chọn, không gọi model phân loại mục tiêu. Tám theme dùng geometry procedural, không thêm thư viện/asset ngoài.
Hoạt ảnh React Three Fiber dùng ref/useFrame và demand rendering, không cập nhật React mỗi frame.
Chỉ chuyển trạng thái live/chờ sang succeeded vừa quan sát được mới phát hành trình; lịch sử có sẵn và run khác không phát replay.
Không kéo dài nhiệm vụ AI để chờ nhân vật đi xong. Tham quan cục bộ có nhãn DEMO và không dùng backend/model.

## D-11 — Claude Code là provider thứ hai

Accepted ngày 22/10/2026 theo yêu cầu ngày 21/10/2026 “tích hợp bạn vào đây”. Thay phần “Claude sau” của D-04.
Adapter dùng Claude Code CLI đã cài ở chế độ headless stream-json, không thêm dependency, chỉ chấp nhận thuê bao Claude.ai.
Mỗi run chọn Codex hoặc Claude; điều tiết lưu riêng theo provider. Chi tiết: [ADR-0002](decisions/ADR-0002-claude-provider-and-interaction.md).

## D-12 — Agent hỏi lại, chen ngang, thông báo và màn hình debug

Accepted ngày 22/10/2026 theo cùng yêu cầu. Trạng thái mới `waiting_input`; câu hỏi giữa lượt (Claude) và cuối lượt (mọi provider, tối đa 2 vòng).
Chỉ dẫn `steer`/`queued`/`interrupt` (tối đa 5 lần chen ngang mỗi bước). Thời gian chờ người không tính vào 20 phút, tối đa 2 giờ.
Màn hình nhân viên dựng từ sự kiện runtime đã lưu (lệnh, exit code, output rút gọn, checklist agent); không có dữ liệu mô phỏng.

## D-13 — Văn phòng 3D sinh động hơn, giao việc nhanh, quy trình một agent

Accepted ngày 22/10/2026. Vẫn procedural, không asset ngoài (giữ D-10): geometry/material dùng chung, robot có damping, chớp mắt,
giơ tay khi hỏi, ăn mừng khi bàn giao, bảng tên và màn hình bàn hiển thị lệnh thật; camera xoay/phóng; giảm DPR khi GPU chậm.
Ô “Giao việc nhanh” nhớ dự án/provider/quyền và gợi ý quy trình bằng từ khoá cục bộ (không gọi model).

## D-14 — Model anime local cho lớp quan sát

Accepted ngày 29/10/2026: người dùng yêu cầu tìm model anime trên web, rồi giao phối và đăng nhập BOOTH để tải.
Cho phép asset bên ngoài cho nhân vật Anime, thay ràng buộc chỉ procedural của D-10/D-13 ở phần nhân vật;
nội thất, robot Cổ điển và tính năng tương tác v0.6 được giữ. Yori + Amane là phối kỹ thuật trong phạm vi được giao.
VRM tải chính thức, chỉ dùng trên máy, không commit/phân phối binary; thêm loader pixiv chính thức, không gọi model AI để hoạt ảnh.
Xem [ADR-0003](decisions/ADR-0003-local-anime-cast.md). Không đổi provider, billing, quyền workspace hoặc nguồn trạng thái runtime.
Thêm mẫu `solo` (Một agent) cho việc nhỏ — triển khai T-02.
