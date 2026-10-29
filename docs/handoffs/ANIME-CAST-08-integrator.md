# Bàn giao ANIME-CAST-08 — Integrator

- Ngày: 29/10/2026, Asia/Saigon.
- Trạng thái: completed trên máy hiện tại; file model local được giữ ngoài Git.
- Baseline: 27a8663 trên main cùng thay đổi ANIME-07 chưa commit của cuộc trò chuyện này.
- Phạm vi: phối Yori + Amane trong cảnh Anime, frontend/model assets/dependency và kiểm chứng.

## Kết quả đã có

Orchestrator được ánh xạ Yori; thành viên tiếp theo dùng Amane Type01–04 theo thứ tự workflow.
Tám workflow dùng cùng quy tắc, không tạo thêm role/process/turn model AI.
Loader VRM chính thức pixiv 3.5.5 được lazy load cùng cảnh, điều chỉnh chiều cao cho văn phòng,
chuẩn hóa VRM0, gộp skeleton/morph và bỏ vertex thừa theo utility của thư viện.
Mỗi nhân vật có rig riêng; dispose GPU khi unmount/đổi theme. Tải có abort/timeout 30 giây.
Chỉ đọc URL cố định trên app local, tối đa 64 MB/model; kiểm tra GLB2/VRM và chặn URI ngoài trong dữ liệu model.

Pose humanoid nhận cùng motion ref với robot: đi bộ, làm việc, chờ và mang hồ sơ theo handoff hiện có.
Không setState theo frame; pause/reduced motion giữ pose đứng và dừng spring update theo delta.
Model thiếu/lỗi (kể cả lỗi texture) hiển thị tên và robot thay thế. Cổ điển không nạp VRM. Có credits tác giả dưới cảnh.
Mở tham quan sẽ unmount cảnh chính để giải phóng model/GPU, tránh giữ đồng thời hai bộ VRM.
Đóng tham quan dựng lại cảnh chính theo snapshot hiện tại, không phát lại completion đã bỏ qua.
Avatar 2D vẫn là hình vector decorative của ANIME-07, chưa tạo ảnh chân dung từ VRM.

## File thay đổi trong bước này

- src/web/anime-cast.ts: bảng phối nhân vật, nguồn tác giả, giới hạn/validation container.
- src/web/agent-pose.ts: pose normalized humanoid, xử lý reduced motion.
- src/web/AnimeModel.tsx: load/cleanup/animate VRM và hồ sơ theo tay phải.
- src/web/AnimeCastCredits.tsx: tên và link tác giả.
- src/web/OfficeAgent.tsx: truyền motion ref vào model, fallback geometry.
- src/web/OfficeScene.tsx: ánh xạ model theo role, tổng hợp trạng thái tải, thông báo fallback.
- src/web/App.tsx, OfficePreviewDialog.tsx: thông báo model accessible và credits cho scene/preview.
- src/web/styles.css: wrapper, thông báo và credits.
- src/server/app.ts: cho phép blob trong img-src/connect-src để Three.js giải mã texture nhúng local; không thêm host ngoài.
- src/web/public/models/README.md: tên file và điều khoản nguồn.
- .gitignore: bỏ qua public/models/local để không phân phối model cùng source.
- package.json/package-lock.json: @pixiv/three-vrm 3.5.5 và 14 package mới thuộc namespace pixiv.
- tests/anime-cast.test.mjs: sáu bài kiểm tra validation, bố trí và pose.
- tests/runtime.test.mjs: kiểm tra CSP cho blob, giữ script-src chỉ self và connect chỉ self/blob/WebSocket loopback.
- README.md, docs/TASKS.md và bàn giao này.

## Kiểm chứng đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| npm run check | Pass |
| npm run lint | Pass |
| npm run build | Pass; OfficeScene lazy chunk 1.114 MB minified / 293 KB gzip |
| npm test (ngoài sandbox cho junction Windows) | 82/82 pass |
| npm ls @pixiv/three-vrm three --depth=1 | VRM 3.5.5 dùng Three 0.186.1 hiện có, không thêm Three riêng |
| git diff --check | Pass |
| Browser preview ở 127.0.0.1:4311 | Thiếu cả năm file hiện đúng tên và robot; credits mở đúng tác giả; Cổ điển ẩn thông báo/VRM |
| Model thật Yori + Amane | Cả năm file qua validation; render đủ texture, console không còn error sau sửa CSP |
| Tham quan model thật | Phòng phần mềm năm vai trò; Yori/Amane bàn giao và di chuyển, vai trò sau làm việc; nút dừng đổi sang Bật chuyển động; đổi phòng thiết kế bốn vai trò |

Preview dùng database riêng ở work/anime-preview.db và provider giả; không dùng database live hoặc inference.
Ảnh bản xem thử đã lưu ở work/anime-cast-desktop.jpg. Không gọi model AI trong quá trình kiểm tra đồ họa.
Lượt test mới đầu tiên có assertion phân biệt -0/0 ở góc tay tĩnh; đã sửa assertion so sánh theo giá trị chuyển động bằng 0, chạy lại toàn bộ pass.

## Asset đã cài và cách kiểm tra lại

BOOTH yêu cầu đăng nhập; người dùng tự hoàn tất rồi báo đã đăng nhập.
Sau đó đã tải ヨリ.zip và allType.zip qua nút chính thức, không đọc cookie/token hoặc trang xác thực pixiv.
Chỉ trích file đã chọn vào tên đích cố định, không giải nén đường dẫn tùy ý từ archive.
Đã kiểm tra magic/header JSON/VRM, nhúng texture, dung lượng và SHA256.
Yori lấy bản suit, không dùng bản đồ ngủ. Amane dùng Type01–04 có trang phục, không dùng sotai.

Tệp đã có:

- src/web/public/models/local/yori.vrm, trích từ ヨリ.zip.
- src/web/public/models/local/amane-1.vrm đến amane-4.vrm, từ Type01–04.vrm (không dùng sotai).

Nguồn/hash được lưu trong work/anime-model-provenance.json; binary gốc và model local không commit.
Tổng năm VRM khoảng 90.6 MB (86.4 MiB); assets được copy sang dist/web/models/local khi build.
Nguồn gốc đúng theo trang tác giả dù metadata Amane ghi title nội bộ “Cecil”.

1. npm start rồi mở http://127.0.0.1:4310; chọn Anime và 3D.
2. Xác nhận hiện Đội hình: Yori + Amane; Orchestrator mặc suit, thành viên ở các trạm có vòng màu vai trò.
3. Mở Tham quan văn phòng; bấm Bàn giao bước tiếp để xem người hoàn thành mang hồ sơ đi, vai trò sau làm việc.
4. Dùng Dừng/Bật chuyển động, đổi Phòng thiết kế (bốn vai trò), rồi đóng; thử Cổ điển/2D.
5. Máy khác cần tự tải file theo src/web/public/models/README.md và build lại; không gửi kèm model trong repo/build public.

Kiểm tra bằng mắt ở góc nhìn tổng thể; chưa đánh giá chất lượng animation điện ảnh hoặc chuyển động ngón tay chi tiết.
Reduced motion có unit test và dùng cùng nhánh pause đã kiểm trong browser; chưa đổi cài đặt OS thật.

## Sửa lỗi khi kiểm tra model thật

Lượt đầu model nạp rig nhưng trắng vì GLTFLoader giải mã texture qua blob, còn CSP cũ chưa cho phép.
Đã thêm blob chỉ ở img-src/connect-src, không nới script-src hoặc thêm origin mạng.
LoadingManager ghi nhận lỗi texture để không báo ready khi hình thiếu texture.
Browser sau sửa đã render đúng màu/trang phục và không có error; SDK vẫn cảnh báo một số curve LookAt VRM0 không hỗ trợ,
nhưng chuyển động đầu hiện do pose của ứng dụng điều khiển, không dùng curve đó.

## Nguồn và license đã đọc

- Yori: https://booth.pm/ja/items/3721509, tác giả 躑躅屋 / 有島リツ.
- VN3 bản tiếng Anh tác giả liên kết: https://drive.google.com/file/d/1WrwM1M11uYuu25zZMmCEyqHqCAfvLbkv/view
- Bản Nhật gốc: https://drive.google.com/file/d/1xNSbElwXFG19A_hM_3noqxJAq56E6Sb-/view
- Amane: https://booth.pm/ja/items/4911831, yousoron-shop.
- SDK: https://github.com/pixiv/three-vrm và https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRMUtils.html

Yori cho phép dùng cá nhân/chỉnh sửa; phân phối bản gốc/bản sửa cần liên hệ tác giả. Chỉ dùng file trên loopback máy người dùng,
không commit hay public model, không tự gửi liên hệ cho tác giả. Amane cho phép chỉnh sửa/thương mại, cấm bán lại.

## Rủi ro và follow-up thực sự

Năm model VRM có thể tốn GPU đáng kể; 2D/Cổ điển vẫn dùng được. Chưa benchmark GPU/FPS hoặc máy yếu.
Avatar 2D vẫn là minh họa vector, không phải chân dung render từ model. Chưa chạy inference live trong thay đổi đồ họa.

Lệnh npm install ở root bị chặn bởi dependency baseline không nhất quán: fast-json-stringify hiện khai báo
@fastify/merge-json-schemas ^0.4.0 nhưng lock/node_modules đang có 0.2.2, registry báo ETARGET.
Không sửa stack/backend ngoài phạm vi. Đã cài package pixiv vào staging riêng với --ignore-scripts/--legacy-peer-deps,
chỉ hợp nhất 14 entry mới cùng integrity từ lock npm và copy đúng subtree pixiv vào node_modules.
Dependency cũ giữ nguyên ở bước trước pull. Bản pull f3af053 đã sửa metadata đó; bước MERGE-09 giữ bản sửa,
đồng bộ version 0.6.0 và npm ci --dry-run --ignore-scripts đã pass. Sau merge có 111/111 tests pass.
Chi tiết tích hợp Claude/hỏi đáp/debug/camera và anime: [MERGE-09](MERGE-09-integrator.md).
