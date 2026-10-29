# AI Agent Office

Ứng dụng cá nhân trên Windows: giao việc qua trình duyệt, xem Codex hoặc Claude làm việc trong văn phòng 3D, trả lời khi agent hỏi, chen ngang khi agent đi sai hướng và theo dõi bằng chứng từ runtime.

## Baseline đã chọn

Ngày 20/10/2026 người dùng chọn A: local Windows, React + TypeScript + Vite, Node.js + Fastify, SQLite; tích hợp thật và 3D đơn giản, Codex trước.
Xem [ADR-0001](docs/decisions/ADR-0001-local-typescript-codex.md) và [DECISIONS](docs/DECISIONS.md).
Các đề xuất cũ trong FRAMEWORKS/ARCHITECTURE là hướng so sánh hoặc mở rộng, không thay baseline này.

## Yêu cầu

- Windows, Node.js 24.x, npm.
- Codex CLI đã cài; chạy `codex login` để đăng nhập bằng ChatGPT (tuỳ chọn nếu chỉ dùng Claude).
- Claude Code CLI đã cài; chạy `claude auth login` để đăng nhập bằng tài khoản Claude Pro/Max (tuỳ chọn nếu chỉ dùng Codex).
- Một thư mục workspace riêng do bạn chọn; không dùng source Agent Office làm workspace.
- Ứng dụng chỉ dùng đăng nhập thuê bao (ChatGPT / Claude.ai); không tự dùng API key hoặc mua credit. Có ANTHROPIC_API_KEY trong Claude Code thì provider Claude bị chặn.

## Chạy

Trong PowerShell:

```powershell
Set-Location E:\Projects\ai-agent-office
npm ci
npm run doctor
npm run build
npm start
```

Mở **http://127.0.0.1:4310**. Ctrl+C để dừng.
`doctor` kiểm tra Codex App Server và Claude Code (handshake initialize): billing mode, model catalog và hạn mức nếu có; không gửi prompt model.

Phát triển: `npm run dev`, mở http://127.0.0.1:5173.
Dev gồm TypeScript watch, backend và Vite; schema/backend được compile trước khi start.

## Cách dùng

1. Bấm Giao việc, chọn phiên dự án đã có hoặc tạo phiên mới, đặt tên và chọn workspace bằng cây thư mục.
2. Mặc định chỉ đọc. Chọn quyền ghi khi muốn vai trò thực hiện sửa file trong thư mục đã chọn.
3. Chọn model trong catalog hoặc dùng model mặc định của catalog Codex.
4. Chọn quy trình phù hợp: phần mềm, marketing, thiết kế, nghiệp vụ, nghiên cứu, nội dung, kiểm toán hoặc tổng quát. Theo dõi từng vai trò thực thi tuần tự trong thread Codex riêng.
5. Xem task summary, command/exit code, usage, log và approvals. Hủy để ngừng run.
6. Reviewer không duyệt hoặc bằng chứng test không đạt: run kết thúc lỗi, không tự sửa/merge/deploy.

## Phiên dự án và cây thư mục (v0.2)

Phiên dự án là nhóm công việc của Agent Office, gắn cố định với tên và workspace.
Phiên này khác với phiên đăng nhập ChatGPT và các thread Codex của từng vai trò.
Chọn phiên cũ sẽ điền và khóa workspace; muốn đổi workspace, tạo phiên mới.
Bấm **Lưu phiên, chưa chạy AI** để lưu riêng trước khi giao mục tiêu, không tiêu hao model.
Lịch sử có bộ lọc PHIÊN DỰ ÁN; chi tiết run hiển thị tên phiên đang chứa nhiệm vụ.
Run cũ chưa gắn phiên vẫn được giữ trong Tất cả phiên.

Cây thư mục mặc định ở thư mục cha của app, tại cài đặt này là E:/Projects.
Mở từng nhánh để xem thư mục con, chọn tên thư mục rồi bấm Dùng thư mục này.
Nếu cần root khác, cấu hình OFFICE_WORKSPACE_ROOT trước khi start; vẫn có thể nhập đường dẫn trực tiếp theo policy hiện có.
Cây chỉ đọc tên thư mục theo yêu cầu, không đọc nội dung file hay quét đệ quy toàn ổ đĩa.
Không theo symlink/junction, không duyệt source Agent Office; ẩn thư mục dot và node_modules.
Mỗi trang tối đa 100 thư mục; thư mục quá lớn có thông báo giới hạn và hỗ trợ nhập đường dẫn.

SQLite migration v2 chỉ thêm bảng/index/cột nullable, giữ nguyên run cũ.
Xem [bàn giao v0.2](docs/handoffs/SESSION-WORKSPACE-02.md) để kiểm tra tính năng mới.

Một run chiếm worker duy nhất toàn ứng dụng. Các mẫu có 3–5 bước tuần tự, chưa là scheduler DAG đa worker.
Xem [quy trình và vai trò v0.3](docs/WORKFLOWS.md). Phiên lưu mẫu mặc định; run lưu snapshot riêng.
Developer và QA độc lập trong mẫu phần mềm; 2D/3D hiển thị đội theo quy trình thực tế.
Cảnh 3D tải riêng khi bật; nội thất và robot cổ điển dùng hình học tạo trong code. Bảng 2D vẫn đầy đủ khi tắt 3D.
Chỉ trạng thái/số liệu có thật được hiển thị, không có dữ liệu demo trong luồng live.

## Điều tiết Codex và chạy tiếp (v0.4)

Một run hoạt động, mỗi vai trò chạy tuần tự; nghỉ ít nhất 15 giây sau lượt trước.
429 tạm thời ở bước chỉ đọc: chờ 60 giây, rồi 120 giây, cộng ngẫu nhiên tối đa 20%; tối đa hai lần thử thêm.
Cooldown tăng theo chuỗi lỗi và lưu SQLite, không mất khi restart. Chờ tối đa 5 phút trong mỗi ngân sách retry; run vẫn có giới hạn tổng 20 phút.
Nếu provider báo hết quota (kể cả cửa sổ phụ), dừng và chờ reset, không retry quota hay chuyển billing.
Bước ghi hoặc bước đã có bằng chứng sửa file không tự chạy lại.

Run lỗi 429 có các bước còn lại chỉ đọc sẽ có nút **Chạy tiếp từ QA / vai trò bị lỗi**.
Nút tạo run mới, kế thừa bàn giao các bước đã xong, giữ nguyên lịch sử cũ và không gọi lại Developer.
Đây là tiếp tục workflow từ checkpoint, không phải resume thread Codex hay tự chấp nhận kết quả test.
Số token kế thừa bằng 0 cho lượt mới; usage các attempt mới được cộng khi provider cung cấp đủ dữ liệu.

Điều tiết giảm gọi dồn và lặp việc, không bảo đảm loại bỏ 429 hay giảm tổng token.
Ứng dụng không điều tiết được các Codex client khác hoặc từng HTTP/tool request bên trong một turn.
App Server có retry nội bộ; hai lần trên là mức bổ sung của Agent Office.
Xem [bàn giao v0.4](docs/handoffs/BALANCE-05.md).

## Văn phòng và chuyển động (v0.5)

Văn phòng tự chọn theo workflow của run: phần mềm, marketing, thiết kế, nghiệp vụ, nghiên cứu, nội dung, kiểm toán, tổng quát.
Mỗi phòng có bảng màu, bố trí trạm và đồ nội thất theo nghề; số nhân vật vẫn khớp các vai trò thực tế.
Robot đang chạy gõ phím; chờ quota/phê duyệt có động tác chờ. Khi quan sát được một bước vừa hoàn thành, robot mang hồ sơ dọc lối đi đến khu bàn giao rồi về bàn.
Chuyển động chỉ minh hoạ trạng thái, không giữ/chậm runtime và không phát sinh lượt model.
Mở lịch sử đã hoàn thành không phát lại hành trình; đổi run sẽ huỷ hành trình cũ.

Bấm **Tham quan văn phòng** dưới cảnh để chọn một trong tám phòng và bấm **Bàn giao bước tiếp**.
Đây là DEMO trong trình duyệt, không gọi API tạo run, không lưu lịch sử, không đọc workspace và không dùng token.
Nút **Dừng chuyển động** chỉ dừng hình ảnh, không huỷ công việc AI. Chế độ giảm chuyển động của thiết bị được tôn trọng.
Bảng 2D, task summary và log vẫn là nơi kiểm tra kết quả thật.
Xem [bàn giao v0.5](docs/handoffs/OFFICE-LIFE-06.md).

## Claude, hỏi lại, chen ngang và màn hình nhân viên (v0.6)

**Giao việc nhanh**: gõ mục tiêu ở ô trên cùng (phím / để focus, Ctrl+Enter để giao). Ô này nhớ dự án, provider và quyền lần trước,
gợi ý quy trình bằng từ khoá ngay trên máy (không gọi model). Lần đầu chưa có phiên, ô mở hộp thoại đầy đủ để chọn thư mục.
Có mẫu nhanh (Sửa lỗi, Thêm tính năng, Review code…) và quy trình **Một agent** cho việc nhỏ, ít lượt model nhất.

**Chọn nhân viên AI**: mỗi công việc chạy bằng Codex hoặc Claude. Claude dùng Claude Code CLI ở chế độ headless,
không nạp hooks/settings/MCP của dự án; vai trò chỉ đọc không có công cụ sửa file; lệnh shell cần quyền được hỏi bạn ở bước ghi
hoặc bước QA của run ghi, các bước khác bị từ chối. Điều tiết 429/hạn mức lưu riêng cho từng provider.

**Agent hỏi lại bạn**: khi thiếu thông tin quyết định, agent hỏi (Claude hỏi ngay giữa chừng và tạm dừng; mọi provider có thể hỏi
cuối lượt rồi làm lại vai trò với câu trả lời, tối đa 2 vòng). Câu hỏi hiện ở hộp thư **CẦN BẠN TRẢ LỜI**, chuông trên thanh trên,
toast có âm báo, số đếm trên tiêu đề tab và — nếu bấm **Bật thông báo** — thông báo Windows khi bạn ở tab khác.
Chọn đáp án, gõ câu trả lời riêng, hoặc **Để agent tự quyết** (agent ghi rõ giả định). Thời gian chờ không tính vào 20 phút; tối đa 2 giờ.

**Chen ngang**: trong khung Chen ngang của công việc đang chạy:
- **Gửi ngay** (Claude): chỉ dẫn vào thẳng lượt đang chạy, agent đọc ở bước kế tiếp mà không dừng. Với Codex: gửi cho lượt sau.
- **Dừng & làm lại**: dừng lượt hiện tại và làm lại bước đó theo chỉ dẫn (tối đa 5 lần/bước). Workspace có thể còn thay đổi dở dang; agent được nhắc kiểm tra.
Chỉ dẫn là lời của bạn nhưng không mở rộng quyền; sandbox/quyền ghi vẫn như lúc giao việc.

**Màn hình nhân viên**: bấm robot trong 3D, nút *Xem màn hình* hoặc bước trong quy trình. Màn hình hiển thị lệnh đang chạy,
exit code, output rút gọn, file đã sửa, đoạn agent đang soạn, checklist agent tự báo (Claude TodoWrite / Codex plan) và các lần bạn trả lời/chen ngang.
Chế độ *Theo dõi tự động* luôn chuyển sang vai trò đang làm; *Phóng to* để xem toàn màn hình. Tất cả từ sự kiện runtime đã lưu.

**Văn phòng 3D**: kéo để xoay, cuộn để phóng, nhấp đúp để về góc mặc định. Robot gõ phím khi làm, giơ tay và hiện dấu ? khi hỏi bạn,
gõ chân khi chờ phê duyệt, xem đồng hồ khi chờ điều tiết, ăn mừng khi bàn giao, cúi đầu khi lỗi; bảng tên ghi việc đang làm;
màn hình trên bàn hiện các lệnh thật gần nhất. Geometry/material dùng chung, render theo nhu cầu (20 fps khi rảnh, đầy đủ khi có chuyển động),
tự giảm độ phân giải khi GPU chậm, tôn trọng chế độ giảm chuyển động.

Xem [ADR-0002](docs/decisions/ADR-0002-claude-provider-and-interaction.md) và [bàn giao v0.6](docs/handoffs/CLAUDE-INTERACT-07.md).

## Giao diện Anime

Giao diện mặc định dùng sắc sakura ban đêm và avatar chibi. Cảnh Anime hỗ trợ phối Yori làm Orchestrator,
Amane Type01–04 làm thành viên theo quy trình. Tệp VRM cần tải từ tác giả bằng tài khoản BOOTH,
đặt riêng trên máy theo [hướng dẫn model local](src/web/public/models/README.md), rồi build lại.
Khi chưa có file hoặc model lỗi, cảnh ghi rõ tên chưa nạp được và dùng robot tai mèo thay thế.
Chọn **Anime / Cổ điển** ở thanh trên để đổi phong cách; trình duyệt nhớ lựa chọn trên máy.
Avatar 2D là vector tự tạo trong source. VRM 3D chỉ nạp từ file local, không tải ảnh/font ngoài lúc chạy và không gọi model AI để trang trí.
Theme áp dụng cho bảng 2D, thẻ vai trò, hộp giao việc và tham quan; tên vai trò/trạng thái vẫn theo workflow/runtime.
Xem [bàn giao giao diện](docs/handoffs/ANIME-07-integrator.md) để biết file và kiểm chứng.
Nguồn nhân vật có trong mục **Nhân vật & tác giả** dưới cảnh. File model được Git bỏ qua;
không chia sẻ thư mục `dist/web/models/local` hoặc đưa model lên public khi chưa có quyền phân phối phù hợp.

## Kiểm soát phạm vi

Backend bind loopback, kiểm tra Host/Origin, cookie HttpOnly + SameSite và CSRF cho mutation.
Chọn workspace là cấp phạm vi cho run; mode ghi cần bật riêng. Codex vẫn thực thi sandbox/quy trình duyệt chính thức.
Các vai trò chỉ đọc (Orchestrator, QA, nghiên cứu, Reviewer) và run chỉ đọc không được app chấp thuận yêu cầu nâng quyền.
Một run ghi luôn cần ít nhất một command kiểm tra thành công khớp bằng chứng provider.
Exit code không chứng minh chất lượng ngữ nghĩa của bài test; cần đọc handoff/review.

Đường dẫn ổ đĩa gốc, home, source Agent Office và thư mục cha của app bị từ chối.
Không đưa credential vào workspace; sandbox không thay thế việc bạn chọn đúng phạm vi.
Prompt chỉ là hướng dẫn tác vụ, không thay thế quyền hệ điều hành.

## Cấu hình tùy chọn

- `OFFICE_CODEX_PATH`: đường dẫn tuyệt đối tới codex.exe hoặc codex.js, khi app không tìm thấy CLI.
- `OFFICE_CLAUDE_PATH`: đường dẫn tuyệt đối tới claude.exe hoặc cli .js, khi app không tìm thấy Claude Code (mặc định tìm trong %APPDATA%
pm và %USERPROFILE%.localin).
- `OFFICE_WORKSPACE_ROOT`: giới hạn workspace phải nằm trong một root cụ thể.
- `OFFICE_CALL_GAP_MS`: giãn lượt từ 1000..120000 ms, mặc định 15000.
- `OFFICE_RATE_RETRIES`: 0..2 lần thử thêm cho 429 ở bước chỉ đọc, mặc định 2.
- `OFFICE_PORT`: port backend, mặc định 4310. Dev proxy được cấu hình cho port mặc định.
- `CODEX_HOME`: cơ chế CLI chính thức, nếu bạn đã dùng cấu hình riêng; không đặt API key trong app.

Database nằm ở data/office.db, không commit. Không copy database đang hoạt động bằng cách chỉ lấy file .db;
dừng app trước khi backup toàn bộ data, gồm WAL/SHM nếu còn.
Kernel lock ngăn hai process dùng cùng thư mục app, kể cả khác port.
Sau crash, run dở dang được đánh dấu interrupted; không tự chạy lại side effect.
Hủy/timeout chờ dừng App Server và process tree; có thể mất vài giây.

## Kiểm chứng

```powershell
npm run check
npm run lint
npm test
npm run build
npm run doctor
```

Test mặc định dùng fake provider và không tiêu hao model.
Chạy live qua giao diện là opt-in và tiêu hao hạn mức ChatGPT.
Xem [TESTING](docs/TESTING.md), [bàn giao](docs/handoffs/IMPLEMENTATION-01.md) và [bảng công việc](docs/TASKS.md).

## Source

- src/shared/contracts.ts: schema, DTO và structured outputs.
- src/server/: transport, runtime, Codex RPC, SQLite worker và workspace policy.
- src/web/: UI, 3D, API/session và reconnect.
- tests/: kiểm thử backend; test buffer/API frontend nằm trong src/web/events.test.mjs.
- docs/: yêu cầu, quyết định, kế hoạch và bàn giao.

SQLite dùng node:sqlite trong worker thread để truy vấn đồng bộ không chặn event loop HTTP.
Cặp phiên bản package đã khóa trong package-lock.json; TypeScript 6 được chọn cho compatibility công cụ lint.

## Giới hạn hiện tại

Claude chưa được chạy live trong phiên phát triển v0.6 (máy phát triển chưa đăng nhập); chạy `npm run doctor` rồi thử một việc chỉ đọc nhỏ trước. Chưa có auto-repair, worktree manager, parallel runtime agents, multi-user hoặc cloud.
Các task ghi thao tác tuần tự trực tiếp trên workspace bạn chọn, không tạo commit tự động.
MVP chưa triển khai artifact download riêng, pause/resume provider hoặc tuỳ biến task graph.
Ba đến năm lượt model cho một việc nhỏ có thể tốn hơn một agent; chưa có benchmark chứng minh giảm token.
Danh sách gần đây giới hạn 30 run trên UI; API lịch sử có cursor.
Scene Three.js/VRM có chunk lớn khoảng 1,1 MB minified, được tải riêng khi bật 3D.
Đội hình Yori + Amane hiện dùng khoảng 86,4 MiB file model local; chưa benchmark GPU trên máy yếu.
