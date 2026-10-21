# ADR-0002 — Claude Code làm provider thứ hai, hỏi lại và chen ngang

- Trạng thái: accepted.
- Ngày: 22/10/2026.
- Quyết định liên quan: D-04 (Codex trước; Claude sau), D-11, D-12, D-13.
- Người quyết định: người dùng.
- Căn cứ từ người dùng (21/10/2026): “tích hợp bạn vào đây và nâng cấp phần mềm này… nhân viên dưới khi thắc mắc cũng phải hỏi lại tôi có chỗ để tôi trả lời và thông báo khi có ai đó hỏi và tôi có thể chen ngang… có hiển thị màn hình debug của màn hình nhân viên đang làm hoặc step đang làm”.
- Thay thế: không; bổ sung ADR-0001.

## Bối cảnh

ADR-0001 chỉ có Codex. Người dùng yêu cầu thêm Claude, cho agent hỏi lại người dùng, cho người dùng chen ngang và xem màn hình làm việc từng vai trò.
Ràng buộc giữ nguyên: dùng thuê bao, không API key/billing, không trích cookie/token, backend là ranh giới quyền, 3D không kích hoạt LLM.

## Các phương án

1. Thư viện `@anthropic-ai/claude-agent-sdk`: có tài liệu đầy đủ, nhưng kéo theo ~105 gói và ~330 MB (binary riêng, MCP SDK, express, hono…).
2. Claude Code CLI đã cài, chế độ headless `-p --input-format stream-json --output-format stream-json --permission-prompt-tool stdio`: đúng giao thức mà SDK dùng, không thêm dependency, dùng chính đăng nhập CLI của người dùng.
3. Gọi Messages API: trái D-01/D-05 và quy tắc không tự dùng API billing — loại.

## Quyết định

Chọn phương án 2: `src/server/claude.ts`.
- Tài khoản: handshake `initialize` (không inference) đọc `account`; chỉ `ready` khi `apiProvider=firstParty`, có `subscriptionType`, `tokenSource` khác `none` và không có API key. `system/init.apiKeySource` được kiểm lại mỗi lượt.
- Môi trường tiến trình: allowlist (`providerEnvironment` + `CLAUDE_CONFIG_DIR`), không truyền `ANTHROPIC_API_KEY`.
- Cô lập workspace: `--setting-sources=` (không nạp hooks/settings của dự án), `--strict-mcp-config` với MCP rỗng, `--no-session-persistence`.
- Công cụ: chỉ đọc = Read/Grep/Glob/Bash/AskUserQuestion/TodoWrite, chế độ `manual`; vai trò ghi thêm Edit/Write/NotebookEdit, chế độ `acceptEdits`. Không có WebFetch/WebSearch/Agent.
- Lệnh shell cần quyền: chỉ chuyển cho người dùng ở bước ghi hoặc bước QA của run ghi; còn lại từ chối. Lệnh chạy nền bị từ chối.
- Kết quả có cấu trúc qua `--json-schema`; bằng chứng test lấy exit code từ tool_result Bash (lỗi ⇒ “Exit code N”).
- Hạn mức: `rate_limit_event` bị từ chối ⇒ PROVIDER_LIMIT, không thử lại; lỗi 429 tạm thời dùng chung bộ điều tiết (riêng từng provider).

Tương tác (provider-agnostic trong runtime):
- Câu hỏi: Claude dùng AskUserQuestion giữa lượt (agent dừng chờ); mọi provider có thêm trường `questions` trong output, runtime hỏi người dùng rồi chạy lại vai trò (tối đa 2 vòng). Thời gian chờ người không tính vào 20 phút làm việc, tối đa 2 giờ.
- Chen ngang: `steer` gửi thẳng vào lượt đang chạy khi provider hỗ trợ (Claude), ngược lại chuyển cho lượt kế tiếp; `interrupt` dừng lượt hiện tại và làm lại bước với chỉ dẫn (tối đa 5 lần/bước). Chỉ dẫn là lời người dùng, không mở rộng quyền.
- Thông báo: WebSocket gửi tín hiệu `attention` tới mọi tab; UI có hộp thư, toast, âm báo, badge tiêu đề và Notification của Windows (người dùng bật).

## Hệ quả

- Không thêm dependency; phụ thuộc giao thức stream-json của CLI. Nếu CLI đổi giao thức, `tests/claude.test.mjs` với CLI giả không phát hiện được — cần `npm run doctor` và một lượt live có kiểm soát sau mỗi lần nâng CLI.
- Codex chưa có câu hỏi giữa lượt hay steer trong adapter (chưa xác minh `turn/steer` trên máy); chỉ dùng câu hỏi cuối lượt và interrupt.
- Run cũ không có `provider` được hiểu là Codex; không cần migration SQL (cột provider_cooldowns đã theo khóa provider).
- Đảo ngược: bỏ `claude` khỏi `src/server/index.ts`; dữ liệu run Claude vẫn đọc được.

## Kiểm chứng

- Tài liệu: https://code.claude.com/docs/en/headless, https://code.claude.com/docs/en/agent-sdk/user-input, kiểu dữ liệu trong `@anthropic-ai/claude-agent-sdk@0.3.306` (đọc trong thư mục tạm, không đưa vào repo).
- Help Center (06/2026): Agent SDK, `claude -p` và app bên thứ ba vẫn dùng hạn mức thuê bao.
- Đã chạy: handshake `initialize` với Claude Code 2.1.222 trên máy (đọc được catalog, tài khoản sandbox chưa đăng nhập ⇒ `signed_out`). Chưa chạy lượt model live.

## Tác động tới công việc song song

Contract `src/shared/contracts.ts` đổi (Integrator). Provider mới tách khỏi runtime qua `src/server/provider.ts`.
