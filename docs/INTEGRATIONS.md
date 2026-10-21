# Tích hợp provider, tài khoản và kiểm soát chi phí

Tài liệu nghiên cứu ngày 20/10/2026; chưa đăng nhập hay thử quyền truy cập trên máy.
Chính sách có thể thay đổi. Kiểm tra lại nguồn và tài khoản trước khi triển khai hoặc phân phối app.

## ChatGPT Plus / Codex

Plus bao gồm Codex trong hạn mức gói. Đăng nhập ChatGPT và API key là hai cơ chế sử dụng/billing riêng.
Codex App Server cung cấp protocol cho auth, hội thoại, approvals và streamed events, phù hợp làm adapter local.
Tài liệu hiện tại cho phép tiếp tục ứng dụng local/open source dùng App Server auth và khuyến nghị Sign in with ChatGPT.
Không dùng cơ chế auth App Server này làm đường mặc định cho dịch vụ commercial/hosted.
Nếu public hóa: kiểm tra Sign in with ChatGPT, điều kiện đăng ký/khả dụng và mô hình thanh toán; không giả định Plus cho phép mọi API call.

Nguồn: [Auth](https://learn.chatgpt.com/docs/auth), [Pricing](https://learn.chatgpt.com/docs/pricing),
[App Server](https://learn.chatgpt.com/docs/app-server), [Sign in with ChatGPT](https://developers.openai.com/siwc).

## Claude Pro / Claude Code

Claude Pro bao gồm Claude Code; usage chia sẻ với các bề mặt Claude liên quan theo hạn mức gói.
Help Center hiện nêu Claude Agent SDK, claude -p và third-party apps vẫn có thể dùng hạn mức thuê bao.
Chưa được suy ra mọi phiên bản SDK, deployment hoặc use case đều tự có quyền dùng Pro.
Spike cần đối chiếu hướng dẫn auth SDK hiện tại, phiên bản CLI, tài khoản và điều kiện cho ứng dụng cá nhân.

Nguồn: [Pro/Max và Claude Code](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan),
[Agent SDK và thuê bao](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan),
[Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview).

## Quy tắc xác thực

- Dùng flow chính thức qua CLI/App Server/SDK phù hợp; ưu tiên để công cụ provider tự quản lý credential.
- Không yêu cầu nhập mật khẩu tài khoản vào web app; không sao chép cookie/token từ website.
- Không commit auth.json, .env, CLI logs hoặc token. Không copy credential sang worktree.
- Khởi chạy child process với environment allowlist. Phát hiện sự có mặt của biến API key chỉ bằng trạng thái boolean, không đọc/in giá trị.
- Nếu mode thực tế là API billing trong khi người dùng chọn subscription, chặn dispatch và giải thích.
- Có biến ANTHROPIC_API_KEY có thể khiến Claude Code dùng API thay vì thuê bao; phải kiểm tra mode thực tế.
- Chưa xác định mode billing: hiển thị unknown và không tự chạy tác vụ tính phí.

## Adapter capabilities — đề xuất

getStatus, startTask, streamEvents, cancelAttempt; resumeSession chỉ khi provider hỗ trợ.
Capability flags: supportsResume, supportsUsage, supportsApprovals, supportsCancellation.
Auth status: not_installed, signed_out, ready, limited, unavailable, unknown.
Không tạo phương thức chung giả vờ hai nhà cung cấp hỗ trợ cùng tính năng.
Schema adapter sẽ được khóa ở C-01; thay đổi SDK không làm thay đổi domain task trực tiếp.

## Spike tích hợp bắt buộc

1. Kiểm tra executable/version trên Windows; không tự cài hoặc login khi chưa tới task tích hợp.
2. Xác nhận đăng nhập và billing mode bằng output đã lọc.
3. Chạy tác vụ ngắn chỉ đọc trong repo mẫu, với quyền và ngân sách được cho phép.
4. Ghi nhận events thực tế, trạng thái kết thúc, usage nào có/không có.
5. Thử cancel, timeout, hết auth, quota và restart; báo phần không mô phỏng/kiểm chứng được.
6. Kết luận: supported, partially_supported hoặc blocked; kèm version và nguồn, không ghi secret.

## Giảm mức sử dụng thực tế

- Một agent cho việc đơn giản; reviewer chỉ đọc diff và bằng chứng liên quan.
- Gửi brief, acceptance criteria và file cần thiết; không phát toàn bộ lịch sử cho mọi agent.
- Giới hạn maxConcurrentWorkers, maxAttemptsPerTask, maxRevisionRounds, maxRunDuration và output size.
- Giá trị đề xuất ban đầu: 1 worker; tối đa 2 attempts/task; 1 vòng sửa sau review; 20 phút/run.
- Token budget chỉ enforce khi provider cung cấp số liệu đủ tin cậy; nếu thiếu thì dùng giới hạn lượt/thời gian, nêu rõ độ trễ.
- Ngưỡng chi phí API là ước tính có thể trễ/overshoot do request đang chạy; không quảng cáo hard cap tuyệt đối.
- Hết quota subscription: dừng dispatch; không tự mua credit, tự nâng gói hoặc chuyển API.
- Cache/tóm tắt chỉ dùng khi giữ đúng ngữ nghĩa; không giả định cache được chia sẻ giữa provider.

## Đo trước khi kết luận tiết kiệm

Dùng cùng nhóm tác vụ đại diện, cùng acceptance criteria và ghi rõ model/config.
So sánh single-agent với workflow nhiều agent: tỷ lệ đạt, số lần sửa, thời gian, usage được báo và chi phí API thực tế nếu có.
Phân biệt token xử lý, mức hạn ngạch thuê bao và tiền phát sinh; không quy đổi chúng theo tỷ lệ tự đặt.
