# Chạy Agent Office bằng launcher Windows

Nhấp đúp **AI Agent Office.exe**. Launcher chạy backend ẩn, đợi backend sẵn sàng rồi mở trình duyệt.
Nhấp đúp lần nữa sẽ mở lại giao diện của cùng launcher, không tạo thêm backend.
Biểu tượng ở khay hệ thống (có thể nằm trong nút ^): nhấp đúp để mở giao diện;
chuột phải → **Thoát và dừng công việc** để hủy công việc đang chạy, đóng provider và database.
Đóng tab trình duyệt vẫn để app chạy. Không tháo ổ di động hoặc di chuyển thư mục khi app đang chạy.

## Dùng trong source hiện tại

```powershell
npm run build
npm run build:launcher
```

Mở `AI Agent Office.exe` ngay ở thư mục dự án. Bản này dùng Node.js 24 đã cài trong PATH.
Nếu app đang chạy bằng `npm start` / `npm run dev`, dừng phiên đó trước khi mở launcher.
Không cần quyền Administrator. Có thể tạo shortcut đến exe bằng chức năng Send to Desktop của Windows.

## Tạo thư mục portable

```powershell
npm ci
npm run build:portable
```

Kết quả trong `release/AI-Agent-Office-<version>-win-<arch>-<timestamp>/`.
Giữ nguyên toàn bộ thư mục: exe, runtime, dist, node_modules và package.json. Node.js 24 được kèm sẵn;
máy dùng không cần cài Node/npm, nhưng phải có .NET Framework 4.x (có sẵn trên Windows 10/11 thông thường).
Máy build cần Windows, Node.js 24 và compiler C# .NET Framework; không tải thêm thư viện.
Mỗi lần build tạo thư mục mới, không đè hoặc xóa lịch sử của bản trước.

Codex CLI / Claude Code CLI và đăng nhập thuê bao vẫn phải được thiết lập trên máy đích.
Launcher không cài provider, không mang theo tài khoản, không gọi AI lúc khởi động và không đổi billing.
Các biến `OFFICE_CODEX_PATH`, `OFFICE_CLAUDE_PATH`, `CODEX_HOME`, `OFFICE_WORKSPACE_ROOT`, `OFFICE_PORT`
được kế thừa từ môi trường Windows lúc mở launcher; root workspace mặc định là thư mục cha của app.
Nếu chuyển bản portable sang nơi khác, có thể cần đặt OFFICE_WORKSPACE_ROOT hoặc nhập đường dẫn workspace trực tiếp.

Bản mặc định loại model nhân vật `dist/web/models/local`, database, log và credential;
thiếu VRM sẽ dùng robot dự phòng. Để tạo bản **chỉ dùng riêng** có model local đã tải hợp lệ:

```powershell
npm run build:portable -- --include-local-models
```

Không chia sẻ bản có model local khi chưa có quyền phân phối từ tác giả.
Database của bản portable nằm ở `data/office.db` cạnh exe. Muốn giữ lịch sử từ source/bản cũ:
thoát cả hai app rồi copy toàn bộ `data/` sang bản mới trước khi khởi động. Không copy database đang mở.

## Kiểm tra và lỗi

- `AI Agent Office.exe --smoke-test`: khởi động rồi dừng sạch, không mở browser/khay, exit code 0 khi thành công.
  Nếu launcher cùng thư mục đã chạy, lệnh trả exit code 2 và không tác động phiên đó.
- `AI Agent Office.exe --no-browser`: chạy có khay, không tự mở browser.
- `AI Agent Office.exe --stop`: yêu cầu launcher cùng thư mục dừng; không tác động app ở thư mục khác.
- Port mặc định 4310. Nếu port bị chiếm hoặc app đã chạy bằng npm, launcher báo lỗi, không mở nhầm dịch vụ.
- Đọc `data/launcher.log` để xem STARTING/READY/STOPPING/STOPPED hoặc lỗi lifecycle; không lưu output provider.
- Backend chưa sẵn sàng sau 30 giây: báo lỗi và dừng. Khi thoát, chờ dừng sạch tối đa 30 giây;
  sau đó buộc dừng cây tiến trình do launcher tạo. Trường hợp này lần mở sau sẽ xử lý run dở như crash.
- Giải nén ở thư mục có quyền ghi, tránh Program Files. Exe chưa ký số nên Windows có thể hỏi xác nhận chạy.

Khởi động thành công chỉ chứng minh backend/giao diện sẵn sàng, chưa xác nhận quyền chạy model của tài khoản.

Developer: sau `npm run build:portable`, chạy `npm run test:launcher` để kiểm tra exe thật bằng bản copy có
database riêng: Node đi kèm, đường dẫn Unicode/có khoảng trắng, HTTP, mở lặp, stop/restart, trùng port,
launcher crash và thiếu file. Không mở browser hoặc gọi provider/model.
