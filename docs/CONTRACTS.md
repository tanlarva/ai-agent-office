# Hợp đồng triển khai — ứng dụng 0.4.0

Nguồn kiểu/runtime validation: src/shared/contracts.ts. Nội dung này thay draft v0.
Không coi endpoint/feature chưa liệt kê là đã có.

## Bổ sung phiên dự án và folder browser

ProjectSession: id, name (1..80 ký tự sau trim), workspace canonical, createdAt.
Một phiên gắn một workspace, không đổi workspace ngầm khi tạo run.
CreateRun thêm sessionId UUID optional để tương thích client cũ; run gắn phiên có sessionId/sessionName snapshot.
Session ID không tồn tại trả 404; workspace khác với phiên trả SESSION_WORKSPACE_MISMATCH/409 trước khi gọi model.
Phiên dự án chỉ gom metadata/lịch sử; không resume hay đổi ngữ cảnh một thread Codex đã có.

| Endpoint mới/thay đổi | Request | Response |
| --- | --- | --- |
| GET /api/project-sessions | limit 1..200, cursor UUID optional | Page ProjectSession |
| POST /api/project-sessions | name, workspace; Idempotency-Key UUID | 201 Envelope ProjectSession |
| GET /api/runs | thêm sessionId UUID optional | Page Run đã lọc |
| GET /api/workspace-folders | path optional, cursor 0..10000, limit 1..100 | Envelope FolderPage |

Tạo phiên dùng cùng key/cùng payload trả cùng phiên; key cũ/payload khác trả 409.
Mọi endpoint dùng cùng auth/Origin/CSRF hiện có. Tạo phiên hoặc duyệt cây không gọi inference.
FolderPage gồm root, path, entries(name,path,selectable), nextCursor, truncated.
Root là OFFICE_WORKSPACE_ROOT hoặc parent app; cấm path thoát root và source app.
Chỉ duyệt một cấp, không trả file; phân trang có giới hạn scan 10.000 entry mỗi thư mục.
Cursor folder là offset trong danh sách filesystem, không bảo đảm snapshot nếu thư mục đổi trong lúc duyệt.

## Mô hình

Run chứa goal, workspace, mode, model thực tế, version, lastSequence, tasks, approvals và lỗi.
Task có role, state, summary, thread/turn ID, inputTokens/outputTokens hoặc null.
Từ v0.4, bước chỉ đọc có retry 429 có giới hạn; xem bổ sung bên dưới.
Role: orchestrator, builder, reviewer; thứ tự cố định. Hiện cả ba dùng provider Codex.
State: queued, running, waiting_approval, succeeded, failed, canceling, canceled, interrupted.
Succeeded của run yêu cầu cả ba task succeeded và reviewer approved, không còn findings.

Approval có ID ứng dụng, task, method, description, thời điểm và trạng thái.
Chỉ builder ở mode workspace-write có thể được app cho duyệt command/file.
Các interaction/permission khác được từ chối, không mặc nhiên cấp quyền.
Không lưu raw provider request ID, token hoặc nội dung suy luận nội bộ.

## Structured outputs

- Planner: summary + steps (tối đa 8).
- Builder: summary + blocked + files + tests(command, passed, evidence).
- Reviewer: approved + summary + findings.
- Mỗi lượt cần đúng JSON schema. Failed/interrupted hoặc JSON sai không được công nhận hoàn tất.
- Run ghi luôn cần ít nhất một test command khớp commandExecution đã hoàn tất với exitCode 0.
- So khớp exit code chỉ xác nhận execution evidence; không chứng minh bài test có ý nghĩa đầy đủ.

## Session và transport

GET /api/session cần X-Office-Client: browser. Trả csrfToken, đặt cookie HttpOnly SameSite=Strict.
Mọi HTTP API sau đó cần cookie và X-Office-Client; mutation cần X-CSRF-Token.
Backend kiểm tra Host và Origin theo localhost/127.0.0.1 với port được cấu hình.
WebSocket dùng cookie + Origin; không truyền credential trong query string.
Client phải bootstrap lại session sau backend restart.

## API đã triển khai

| Endpoint | Body/query | Kết quả |
| --- | --- | --- |
| GET /api/session | — | Envelope chứa csrfToken |
| GET /api/providers | — | Danh sách ProviderStatus trong Envelope |
| POST /api/runs | goal, workspace, mode, model?; Idempotency-Key UUID | 201, Location, Envelope Run |
| GET /api/runs | cursor? UUID, limit 1..200 | Page Run, mới nhất trước |
| GET /api/runs/:id | UUID | Envelope Run |
| GET /api/runs/:id/events | after >= 0, limit 1..200 | Page OfficeEvent |
| POST /api/runs/:id/cancellations | {} | 202, Envelope Run; trạng thái có thể canceling |
| POST /api/approvals/:id/decisions | decision accept/decline, version | Envelope Run; 409 nếu stale |
| WS /api/events | message {runId, afterSequence} | OfficeEvent hoặc snapshot/error |

Mutation tạo run dùng cùng key/cùng payload trả cùng run; key cũ/payload khác trả 409.
Hiện một run hoạt động; yêu cầu mới khác key lúc bận trả WORKER_BUSY, không có queue ngầm.
HTTP success: {data,meta:{traceId,nextCursor?}}.
Error: {error:{code,message},traceId}; không trả stack.

## Event

Envelope: schemaVersion=1, eventId, runId, taskId nullable, sequence tăng trong run, occurredAt UTC, type, payload.
DB ghi snapshot + event cùng transaction; publish chỉ sau durable save.
Replay at-least-once; client deduplicate theo sequence/event ID, không giả định exactly-once.
WS replay tối đa 200; HTTP pagination bù khoảng trống, UI giữ tối đa 200 sự kiện gần nhất.
Snapshot stale không được ghi đè version mới hơn.

Types: run.state_changed, run.completed, task.state_changed, agent.assigned, agent.turn_started,
agent.message_delta, tool.started, tool.completed, usage.updated, artifact.created, approval.requested, approval.resolved.
run.completed là kết thúc run với state cụ thể, không đồng nghĩa thành công.

## Chưa triển khai

Artifact download riêng, pause/resume thread provider, arbitrary DAG, session-wide approvals, sửa config provider và quyền nhiều workspace đồng thời.

## Bổ sung v1.2 / app v0.3

CreateProjectSession và CreateRun có workflowId optional, enum software/marketing/design/business/research/content/quick.
ProjectSession trả workflowId nếu đã chọn; CreateRun ưu tiên input.workflowId → session.workflowId → quick.
Run.workflow optional cho dữ liệu cũ; run mới chứa snapshot WorkflowDefinition (id/version/name/description/steps).
Task.role mở rộng theo roleSchema; browser không được cung cấp role/prompt/permission tùy ý.
QA structured output gồm approved/summary/findings/tests; kiểm tra command evidence trong lượt QA.
Không đổi endpoint hoặc migration SQL; trường JSON mới tương thích dữ liệu trước v0.3.

## Bổ sung app v0.3.1

workflowId nhận thêm audit; roleSchema thêm audit-risk/audit-evidence/audit-reporter/audit-reviewer.
Template có năm bước, chỉ audit-reporter writable. Không đổi endpoint, output schema hoặc migration SQL.

## Bổ sung app v0.4 / điều tiết

- State thêm waiting_capacity (run/task). Run.waiting optional: reason spacing/rate_limit, until ISO UTC, attempt 1-based.
- GET /api/scheduling: Envelope {minGapMs,maxRetries,cooldownUntil,rateLimitStreak}; cùng auth/session hiện có.
- POST /api/runs/:id/retries: strict body {version:positive integer}, Idempotency-Key UUID, cookie/CSRF; 201 Envelope Run và Location. Key/payload xung đột 409; stale version 409; run không tồn tại 404; replay không an toàn 409; hết quota 429.
- Retry tạo run mới retryOfRunId, giữ workspace/model/workflow/phiên/quyền của nguồn; server kiểm tra lại workspace/provider/model và phần còn lại chỉ đọc. Không nhận prompt/role/quyền mới từ browser.
- Task thêm handoff bounded 5000 ký tự, inheritedFromTaskId, observedWrites, usageAttempts(inputTokens/outputTokens nullable). Usage null nếu thiếu bất kỳ attempt; không giả bằng 0. Prefix kế thừa ghi token 0 ở run mới.
- Run.failureCode phân biệt PROVIDER_RATE_LIMIT tạm thời với PROVIDER_LIMIT quota. Legacy run thiếu code chỉ nhận lỗi 429/Too Many Requests; không replay lỗi kiểm thử/review.
- ProviderStatus.limitWindows optional gồm name/usedPercent/resetsAt (Unix giây nullable), ưu tiên multi-bucket; hết bất kỳ cửa sổ được báo thì ngừng inference.
- Event thêm capacity.waiting, capacity.dispatched, capacity.retry_scheduled. Không event nào tự chứng minh chất lượng đầu ra.
- Migration v3 thêm provider_cooldowns(provider PK,next_allowed_at,rate_limit_streak), giữ dữ liệu cũ. Cooldown chỉ dùng chung trong app này, không account-global lock qua các client khác.
