# Nguồn tham khảo chính thức

Ngày đọc/kiểm tra: 20/10/2026. Đây là tài liệu web, không phải kiểm chứng quyền tài khoản hoặc phần mềm trên máy.
Đọc lại trước khi chốt auth, billing, phiên bản runtime hoặc đưa ứng dụng lên internet.

## OpenAI

- [Codex authentication](https://learn.chatgpt.com/docs/auth): đăng nhập ChatGPT và API key, credential handling.
- [Codex pricing / plans](https://learn.chatgpt.com/docs/pricing): Plus và hạn mức theo gói.
- [Codex App Server](https://learn.chatgpt.com/docs/app-server): protocol, events, auth và giới hạn ứng dụng hosted/commercial.
- [Sign in with ChatGPT](https://developers.openai.com/siwc): hướng tích hợp app; cần kiểm tra điều kiện đăng ký/availability.
- [App Server với ChatGPT plan](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server): tích hợp theo flow được cấp quyền, không thay cho API key tùy ý.

## Anthropic / Claude

- [Claude Code với Pro/Max](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan): quyền dùng, quota và biến API key.
- [Agent SDK với Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan): cập nhật cách dùng subscription.
- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview): SDK và khả năng tích hợp; kiểm tra auth theo phiên bản cụ thể.

## Framework và runtime

- [Vite guide](https://vite.dev/guide/): dev/build và template React TypeScript.
- [React Three Fiber](https://r3f.docs.pmnd.rs/getting-started/introduction): React renderer cho Three.js và yêu cầu compatibility.
- [Fastify docs](https://fastify.dev/docs/latest/): framework HTTP Node.js, validation và TypeScript.
- [Node.js child_process](https://nodejs.org/api/child_process.html): async process và khác biệt Windows.
- [ASP.NET Core SignalR](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction): realtime trong hệ .NET.
- [SQLite appropriate uses](https://www.sqlite.org/whentouse.html): lưu dữ liệu ứng dụng local và đánh đổi client/server.
- [Next.js Server/Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components): ranh giới server/client.

## Ranh giới kết luận

Đề xuất chọn stack A và kiến trúc module là nhận định của agent cho nhu cầu này.
Chưa đo chi phí, FPS, throughput, chất lượng model hoặc số task theo thuê bao.
Không khóa version dựa trên nhãn latest; phải kiểm tra support/compatibility ở thời điểm scaffold.
