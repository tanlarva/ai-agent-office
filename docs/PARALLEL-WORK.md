# Quy trình nhiều agent làm song song

Áp dụng cho các agent phát triển AI Agent Office.
Các agent bên trong sản phẩm cũng cần isolation tương tự, nhưng không phải cùng một runtime/hệ chat.

## Điều phối

Orchestrator giữ mục tiêu, task graph, quyết định kiến trúc và kế hoạch tích hợp.
Worker nhận task nhỏ có đầu ra kiểm chứng được. Reviewer đánh giá sau khi worker bàn giao.
Vai trò có thể do Claude, Codex hoặc công cụ khác đảm nhận; không gán provider cố định trong yêu cầu.

Người dùng đã yêu cầu chuẩn bị để làm song song; tài liệu này không tự tạo chat, gửi tin sang chat khác hay cấp quyền công cụ vượt phạm vi.
Sử dụng cơ chế subagent/chat theo quyền sẵn có và chỉ dẫn người dùng.

## Trình tự một task

1. Orchestrator xác nhận task ready, dependencies, acceptance criteria và các file được sửa.
2. Gán một owner, branch/worktree hoặc phạm vi thư mục độc lập; cập nhật TASKS.
3. Worker đọc chỉ những tài liệu và source cần thiết; báo thiết kế ngắn trước thay đổi đáng kể.
4. Worker sửa trong phạm vi, chạy kiểm chứng và tạo handoff riêng.
5. Reviewer nhận diff, kiểm tra kết quả và báo lỗi có bằng chứng.
6. Orchestrator tích hợp tuần tự, chạy test liên module, cập nhật task và mở phụ thuộc tiếp.

Nếu worker phát hiện cần sửa file ngoài phạm vi: nêu lý do và chờ điều phối đổi ownership; vẫn tiếp tục phần độc lập.
Không để hai agent tự “claim” bằng cách cùng ghi bảng Markdown. Bảng TASKS có đúng một writer.

## Phạm vi đề xuất sau khi chốt stack

| Vai trò | Sở hữu khi được giao | Tệp dùng chung không tự sửa |
| --- | --- | --- |
| Orchestrator / Integrator | README, AGENTS, TASKS, DECISIONS, contracts, manifest/lockfile | — |
| Runtime worker | Domain/application scheduler và test tương ứng | Contracts, lockfile |
| Provider worker | Một adapter/provider và test tương ứng | Scheduler policy, contracts |
| Frontend worker | Task board, transport consumer, UI tests | Contract schema, backend |
| 3D worker | Office scene và assets tự tạo/có license | Task board state, backend |
| Reviewer | Handoff review riêng; không sửa code đang được worker giữ | Mọi file worker đang sửa |

Với giới hạn ít agent, gộp frontend + 3D và làm hai adapter lần lượt.
Asset cần license/provenance; không đưa ảnh tham khảo hoặc dữ liệu riêng vào repo nếu chưa cần.

## Git và xung đột

Hiện chưa có Git. Sau khi được giao scaffold, kiểm tra parent repo trước khi git init để tránh nested repo ngoài ý muốn.
Mỗi worker sửa code dùng branch/worktree riêng nếu có Git; vị trí worktree do Orchestrator thống nhất.
Worktree không cách ly quyền hệ điều hành hoặc credential; vẫn cần sandbox và scope quyền.
Chỉ Integrator sửa dependency manifest/lockfile, schema chung và áp dụng migrations.
Worker đề xuất dependency trong handoff; Integrator kiểm tra có utility tương đương trước khi thêm.
Merge/cherry-pick tuần tự, không chạy đồng thời thao tác Git ghi cùng repo metadata.
Không force-push, reset, xóa worktree hoặc ghi đè file của người khác để xử lý xung đột.

## Hợp đồng trước, triển khai sau

Khóa draft contract tại C-01. Frontend/3D có thể dùng fixture đúng schema trong lúc backend đang làm.
Fixture phải gắn nhãn DEMO; không dùng nó làm bằng chứng provider thật hoạt động.
Đổi contract: ghi lý do, version, consumers bị ảnh hưởng và kế hoạch cập nhật; Integrator thực hiện đồng bộ.
Domain/provider/runtime không import UI hoặc scene.

## Prompt giao việc mẫu

> Đọc AGENTS.md và các tài liệu liên quan đến task <ID>.
> Mục tiêu: <kết quả cụ thể>. Phạm vi sửa: <đường dẫn>.
> Dependencies đã xong: <ID>. Contract baseline: <version/commit>.
> Không sửa manifest, lockfile hoặc contract chung.
> Điều kiện hoàn thành: <tiêu chí và kiểm chứng>.
> Tạo docs/handoffs/<ID>-<agent-id>.md; nêu giới hạn và đề xuất thay đổi ngoài phạm vi.
> Nếu bị chặn, báo chính xác dữ liệu/quyết định thiếu; tiếp tục phần độc lập.

## Quy tắc kết thúc

Done cần code/tài liệu đã tích hợp và kiểm chứng theo TESTING, không chỉ worker nói đã xong.
Reviewer độc lập kiểm tra task quan trọng; Orchestrator tự review khi chỉ có một agent.
Mọi báo cáo phân biệt “đã chạy”, “chỉ phân tích” và “chưa xác minh”.
