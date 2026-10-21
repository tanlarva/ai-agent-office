# OFFICE-LIFE-06 — Văn phòng sống động v0.5.0

Yêu cầu ngày 20/10/2026: nhân vật đi lại khi hoàn thành task, hoạt động sinh động hơn và văn phòng khác theo loại công việc.

## Thay đổi

Tám theme gắn với workflow hiện có, dùng bảng màu và nội thất procedural: xưởng phần mềm có server/màn hình code; phòng chiến dịch có poster; studio có bảng màu/hình khối; nghiệp vụ có sơ đồ luồng; nghiên cứu có kệ sách; nội dung có thư viện tông ấm; kiểm toán có hộp hồ sơ; tổng quát có ba trạm và lounge.

Robot đang running gõ phím/nhìn màn hình. Chờ điều tiết hoặc approval có động tác chờ và ký hiệu trên đầu. Task vừa chuyển từ live/chờ sang succeeded khiến robot mang hồ sơ theo lối trống đến vùng bàn giao, dừng ngắn, rồi về đúng trạm. Chân/tay chuyển động theo bước đi. Lỗi/hủy không biểu diễn thành công.

Mở run lịch sử không phát hành trình hoàn thành; đổi run reset nhân vật. Cảnh không trì hoãn role sau để chờ animation, không tạo lượt model và không thay đổi trạng thái runtime.
Nút Dừng chuyển động chỉ tắt hoạt ảnh. Reduced motion áp dụng cho cả cảnh thật và tham quan. Demand rendering ngủ khi không có pose live/hành trình; không setState React mỗi frame.

Tham quan văn phòng là dialog riêng, nhãn THAM QUAN · KHÔNG GỌI AI / DEMO. Chọn tám phòng, bấm Bàn giao bước tiếp, Làm lại hoặc tắt animation. Dữ liệu nằm trong React, không gọi API tạo run, không đọc workspace, không lưu DB. Khi mở tham quan, cảnh chính tạm tắt motion để tránh hai cảnh cùng hoạt động. Escape đóng và trả về giao diện chính.

## File sửa

- src/shared/office-scene.ts: theme, toạ độ trạm/lối đi, lấy mẫu đường, điều kiện handoff.
- src/web/OfficeScene.tsx: ghép scene và camera.
- src/web/OfficeAgent.tsx: nhân vật và chuyển động qua ref/useFrame.
- src/web/OfficeFurniture.tsx: nội thất riêng theo ngành.
- src/web/OfficePreviewDialog.tsx: tham quan chỉ trong browser.
- src/web/SceneBoundary.tsx: tách error boundary hiện có để dùng chung.
- src/web/App.tsx, styles.css: tên phòng, thông tin, nút tham quan/dừng, responsive.
- tests/office-scene.test.mjs: bốn bài test mapping, số trạm, lối đi/khoảng trống, điều kiện chuyển trạng thái.
- src/server/codex.ts: chỉ tăng clientInfo version, không thay adapter behavior.
- package.json/package-lock.json: 0.5.0, không dependency mới.
- README.md; docs/PRODUCT.md, DECISIONS.md, WORKFLOWS.md, TESTING.md, TASKS.md và bàn giao này.

Không đổi endpoint, schema run, SQL migration, quota policy hoặc quyền truy cập máy.

## Kiểm chứng

npm run check, npm run lint, npm test: 76/76 pass; npm run build pass.
Bốn bài mới kiểm tra đủ trạm/room cho mọi workflow, legacy/empty, đường đi nằm trong sàn và không cắt bàn/cây/bàn thảo luận với clearance, sample/clamp đường và không replay thành công từ lịch sử.
Test đường phát hiện một chậu cây nằm sát lối; đã dời cây ra và chạy lại test pass.

Browser tại môi trường riêng port 4311, database riêng/provider giả: kiểm tra tên và nội thất tám phòng; workflow giả chạy các role qua WebSocket, robot rời trạm theo completion; nút tắt animation; 2D fallback. Hộp tham quan đã thử đổi phòng kiểm toán, bàn giao bước, dừng chuyển động, reset và Escape. Không inference Codex thật trong lần thay đổi này. Không đưa fixture vào DB live.

## Cách thử

1. Mở http://127.0.0.1:4310, bấm Tham quan văn phòng ngay dưới scene.
2. Chọn Studio thiết kế hoặc Phòng kiểm toán; quan sát nội thất khác và roster đúng số vai trò.
3. Bấm Bàn giao bước tiếp, chờ khoảng 8–13 giây để thấy robot đi ra khu bàn giao rồi về. Bấm tiếp khi muốn minh hoạ vai trò sau; đây là DEMO không dùng quota.
4. Thử Dừng/Bật chuyển động, Làm lại, Escape và chế độ 2D ở giao diện chính.
5. Khi chạy việc thật, chọn workflow tương ứng. Cảnh tự chọn phòng và chuyển động từ cập nhật thực tế; task cũ không tự chạy AI hoặc phát lại hành trình.

## Giới hạn và phục hồi

Theme gắn theo loại workflow, chưa phải tạo kiến trúc phòng riêng bằng AI cho mỗi nội dung mục tiêu hoặc room editor. Handoff là hình ảnh minh hoạ, không chứng minh chất lượng file hoặc test. Bằng chứng vẫn ở task/log.
Scene 3D vẫn là chunk lazy load lớn khoảng 925 KB minified. Chưa benchmark GPU/FPS nhiều thiết bị; máy yếu có thể tắt motion hoặc dùng 2D. Reduced motion được triển khai, chưa thử bằng cài đặt hệ điều hành của người dùng.
Đường đi được thiết kế cho tối đa năm vai trò của các mẫu hiện có; nếu mở rộng task graph/đồ đạc cần cập nhật layout và kiểm tra clearance. Không physics engine hoặc tránh va chạm giữa nhiều nhân vật khi minh hoạ nhiều bàn giao cùng lúc.
Tắt animation sẽ đưa robot về trạm và bỏ hành trình đang xem, không pause/resume animation giữa đường; không ảnh hưởng task AI.

Source gốc được đối chiếu hash trước cập nhật. Dừng app trước khi backup toàn bộ data; backup source/data trong work/before-scene-update thuộc workspace cuộc trò chuyện. Rollback bằng source/data backup sau khi dừng, build lại và start. Dữ liệu run thật cũ được giữ nguyên.
