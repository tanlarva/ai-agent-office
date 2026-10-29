# ADR-0003 — Nhân vật anime VRM local

- Ngày: 29/10/2026.
- Trạng thái: accepted cho phạm vi dùng model anime trên máy cá nhân.
- Căn cứ: người dùng yêu cầu “các nhân vật bot ai lấy model anime trên web tìm đưa ra lựa chọn”,
  sau danh sách lựa chọn yêu cầu “phối giúp tôi”, và tự đăng nhập BOOTH để tải file.

## Quyết định

Lớp Anime dùng Yori bản suit cho Orchestrator và Amane Type01–04 cho các thành viên còn lại;
mẫu Một agent dùng Amane. Đây là lựa chọn phối của Integrator trong phạm vi người dùng giao.
Giữ Cổ điển với robot procedural và toàn bộ tương tác v0.6: hỏi đáp, debug, camera, trạng thái provider, chọn nhân viên.
Đây là ngoại lệ có căn cứ cho phần nhân vật trong D-10/D-13; không thay nội thất hoặc workflow/domain.

Dùng @pixiv/three-vrm 3.5.5 cùng Three.js đã có, vì GLTFLoader thuần không đủ humanoid/MToon VRM.
State runtime điều khiển pose qua ref/useFrame; hoạt ảnh không gọi AI hoặc thay trạng thái nhiệm vụ.
Model thiếu/hỏng hoặc texture lỗi có thông báo và robot fallback. Bảng 2D vẫn dùng được.

## Asset và quyền phân phối

Nguồn Yori: https://booth.pm/ja/items/3721509, 躑躅屋 / 有島リツ.
Nguồn Amane: https://booth.pm/ja/items/4911831, yousoron-shop.
Đọc điều khoản và liên kết license trong src/web/public/models/README.md.
Binary chỉ nằm ở thư mục local được Git bỏ qua, phục vụ trên loopback máy người dùng.
Không tự đưa binary vào repo, build public hoặc bản phân phối. Hiển thị link tác giả dưới scene.

## Đánh đổi

Năm model khoảng 86.4 MiB, có thêm chi phí texture/skinning và chunk loader. Chưa benchmark GPU.
Mở tham quan unmount cảnh chính để tránh giữ hai bộ model; Cổ điển/2D là lựa chọn nhẹ hơn.
CSP cho phép blob chỉ ở img-src/connect-src để giải mã texture nhúng, không thêm host bên ngoài hoặc nới script-src.
Đường nạp chỉ dùng file cố định và kiểm tra VRM tự chứa trước khi parse; không nhận URL tùy ý.
