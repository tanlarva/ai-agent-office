# Bàn giao ANIME-07 — Integrator

- Ngày: 29/10/2026, Asia/Saigon.
- Trạng thái: completed.
- Baseline: 27a8663, branch main, checkout hiện tại; không có thay đổi sẵn lúc bắt đầu.
- Phạm vi: làm giao diện anime nhẹ theo yêu cầu người dùng; src/web và tài liệu.

## Kết quả và lý do

Thêm lớp trình bày Anime mặc định: tím than, hồng sakura, avatar chibi tự tạo, viền màu vai trò và ánh sáng 3D hồng nhạt.
Nút Anime/Cổ điển dùng aria-pressed, thao tác bàn phím và focus có sẵn. Lựa chọn lưu localStorage;
storage bị chặn vẫn dùng được theme trong bộ nhớ. Không đổi tên vai trò, workflow hoặc trạng thái runtime.

Vector chibi tái sử dụng trong welcome, empty state, thẻ vai trò và sơ đồ 2D; các biến CSS đổi màu tóc theo trạm.
Robot 3D thêm tai mèo, headset và má hồng khi bật Anime, giữ cơ chế chuyển động/handoff hiện có.
Cổ điển trả lại palette/avatar/robot cũ. Theme kế thừa vào dialog giao việc và tham quan.
Không thêm thư viện, asset ngoài, font mạng hoặc lượt model. Không đổi database, API hoặc quyền.

## File thay đổi

- src/web/App.tsx: chuyển phong cách, welcome, ghép avatar và truyền theme vào scene/dialog.
- src/web/useAppearance.ts: lựa chọn cục bộ và persistence có fallback.
- src/web/AnimePortrait.tsx: nhân vật vector nguyên bản, decorative aria-hidden, không trùng ID SVG.
- src/web/styles.css: tokens Anime, style avatar/cards, responsive và nút chọn phong cách.
- src/web/OfficeScene.tsx: ánh sáng/nền Anime, truyền lựa chọn cho robot.
- src/web/OfficeAgent.tsx: geometry tai mèo/headset/má hồng tùy chọn.
- src/web/OfficeFurniture.tsx: token màu má hồng trong bảng materials hiện có.
- src/web/OfficePreviewDialog.tsx: dùng cùng phong cách với giao diện chính.
- README.md, docs/TASKS.md và bàn giao này: hướng dẫn và bằng chứng.

## Kiểm chứng đã chạy

| Lệnh / bước | Kết quả |
| --- | --- |
| npm run check | Pass, gồm frontend TypeScript |
| npm run lint | Pass |
| npm run build | Pass; OfficeScene lazy chunk khoảng 926 KB minified |
| npm test | 76/76 pass khi chạy ngoài sandbox |
| git diff --check | Pass |
| Browser desktop 1280px | Theme Anime, vector, 3D hiển thị; console không có error |
| Browser mobile 390px và 360px | Không tràn ngang ở 360px; sơ đồ 2D hai cột 127px |
| Anime/Cổ điển, tải lại | Cổ điển được giữ sau reload; chuyển về Anime hoạt động |
| Dialog giao việc, tham quan | Kế thừa palette; form đọc được; đổi phòng software/design và bàn giao DEMO cập nhật đúng roster |
| Contrast tokens | Muted/panel 8.21:1; subtle/raised 5.41:1; text/panel 14.53:1; chữ CTA/nền CTA 9.37:1 |

Lượt test đầu trong sandbox đạt 74/76; hai bài tạo junction bị EPERM của môi trường.
Chạy lại ngoài sandbox được auto-review cho phép đạt 76/76, không sửa test hay giảm kiểm tra bảo mật.
Preview chạy 127.0.0.1:4311 với database riêng ở work và provider giả ghi rõ bản kiểm tra giao diện.
Không inference Codex thật hoặc đụng database live. Ảnh desktop: work/anime-ui-desktop.jpg (ignored).

## Review, rủi ro và giới hạn

Tự review: thay đổi chỉ ở lớp trình bày, không thêm setState mỗi frame hoặc animation lặp;
giữ reduced motion và nút dừng hiện có. Avatar không thay thế nhãn/trạng thái bằng chữ.
Không thêm HTML động, network target hay dữ liệu provider giả vào source sản phẩm.
Theme dùng native CSS hiện có, không áp cấu trúc marketing-page của skill lên dashboard.

Scene vẫn là chunk lớn vốn có; chưa benchmark GPU trên máy yếu. Geometry bổ sung ít nhưng vẫn cần kiểm tra thực tế
nếu dùng thiết bị hạn chế. Dùng 2D hoặc tắt chuyển động khi cần. Chưa kiểm tra inference live trong thay đổi giao diện này.
Nếu trình duyệt chặn localStorage, lựa chọn chỉ có hiệu lực trong lượt mở trang hiện tại.

## Cách kiểm tra lại

1. Chạy npm run build rồi npm start; mở http://127.0.0.1:4310.
2. Thử Anime/Cổ điển, tải lại để kiểm tra lựa chọn được giữ.
3. Đổi 3D/2D: quan sát robot tai mèo và avatar chibi; đọc trạng thái ở bảng vai trò.
4. Mở Tham quan văn phòng, đổi phòng và bấm Bàn giao bước tiếp (DEMO không gọi AI).
5. Mở Giao việc để xem form; thử chiều rộng 360px và 390px, Tab để kiểm tra focus.

## Bàn giao cho bước tiếp

Không có dependency hay thay đổi contract cần tích hợp. Tối ưu chunk/GPU 3D là follow-up riêng khi có số đo hiệu năng.
