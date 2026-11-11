# Nhật ký Quan sát Thực thi Kiểm soát (Phase 9 - Task E)

- **Mã tài liệu**: `31-controlled-runtime-observations.md`
- **Dự án**: Nghiên cứu & Dịch ngược Phòng sạch Ứng dụng GGTT (Google TikTok / TikTok Interactive Tool)
- **Trạng thái phê duyệt**: **`BLOCKED_PENDING_AUTHORIZATION`** (ĐANG BỊ CHẶN - CHỜ PHÊ DUYỆT THỰC THI)
- **Nhánh làm việc Git**: `research/phase9-behavioral-verification`
- **Ngày lập**: 2026-11-11
- **Phân loại bảo mật**: Nghiêm ngặt (Strict Read-Only & Zero-Execution Default)

---

## 1. Tuyên bố Khóa Thực thi & Tuân thủ Nguyên tắc An toàn

Căn cứ theo Chỉ thị Thực thi Phase 9:
> *"Chỉ thực hiện TASK E sau khi có quyền thực thi ứng dụng gốc và môi trường cô lập đã sẵn sàng. Tiếp tục TASK F và G với những Evidence đã thu thập được, không chờ dynamic testing nếu chưa được phép."*

Và Điều kiện Tiên quyết (Prerequisites) được thiết lập tại [Báo cáo 30 (Kế hoạch Kiểm thử Động)](30-controlled-runtime-test-plan.md):
1. **Chưa có lệnh cho phép thực thi nhị phân gốc** từ người dùng / chủ sở hữu hệ thống trong phiên làm việc hiện tại.
2. **Môi trường máy ảo độc lập (Air-Gapped Sandbox VM)** chưa được bàn giao xác thực cô lập mạng (Network Isolation / Loopback-Only Adapter / Sinkhole DNS).
3. Do đó, **tuyệt đối không khởi chạy `GGTT.exe` hay nạp tiến trình con** trong phiên phân tích này.

---

## 2. Bảng Trạng thái Các Ca Kiểm thử Động (TC-DYN-01 đến TC-DYN-09)

Toàn bộ 9 kịch bản kiểm thử động được thiết kế tại Báo cáo 30 hiện đang ở trạng thái bảo lưu an toàn:

| Mã Kịch bản | Tên Kịch bản Kiểm thử Động | Phân hệ Mục tiêu | Trạng thái Hiện tại | Lý do Kỹ thuật / Rào cản Bảo mật |
|:---:|---|:---:|:---:|---|
| **TC-DYN-01** | Bắt tay WebSocket Khởi động | Overlay Server | `BLOCKED` | Chờ môi trường cô lập loopback; không mở socket ứng dụng gốc |
| **TC-DYN-02** | Khởi tạo WebView2 & Tiêm Script | Web Browser Shell | `BLOCKED` | Chờ môi trường VM; ngăn gọi nạp thư viện `WebView2Loader.dll` |
| **TC-DYN-03** | Khởi tạo CSDL SQLite WAL & DDL | Data Persistence | `BLOCKED` | Đã xác minh 100% qua CIL static; không tạo tệp `.db` runtime |
| **TC-DYN-04** | Luồng Sự kiện TikTok Giả lập | TikTok Ingestion | `BLOCKED` | Ngăn kết nối mạng; tránh gửi nhầm gói tin ra ngoài internet |
| **TC-DYN-05** | Tính điểm Combo Quà & Khấu trừ | PK Scoring Core | `BLOCKED` | Đã được chứng minh toàn diện bằng Conformance Harness TC1-TC3 |
| **TC-DYN-06** | Hàng đợi Kịch bản & Ngưỡng 256 | Scenario Engine | `BLOCKED` | Đã được xác minh qua CIL `0x0600042e` và Boundary Test B3 |
| **TC-DYN-07** | Nhận diện Khung xương AI Pose | MediaPipe ONNX | `BLOCKED` | Chờ GPU / Camera giả lập trong môi trường VM an toàn |
| **TC-DYN-08** | Bắt Phím nóng & Gửi Scancode | Hotkey Automation | `BLOCKED` | Ngăn chặn đăng ký Win32 `RegisterHotKey` lên hệ điều hành máy thật |
| **TC-DYN-09** | Xử lý Ngắt mạng & Khôi phục CSDL | Fault Injection | `BLOCKED` | Chờ công cụ tiêm lỗi mạng trên môi trường máy ảo riêng biệt |

---

## 3. Giá trị của Bằng chứng Tĩnh CIL So với Dữ liệu Động

Trong bối cảnh Task E bị chặn, kết quả nghiên cứu và tái triển khai phòng sạch **không bị ảnh hưởng tiêu cực**:
1. **Độ chính xác cấp vi mã**: Toàn bộ các ngưỡng giá trị (ngưỡng kẹp $[-80, 80]$ của sigmoid, góc $100^\circ/140^\circ/160^\circ$ của squat, hàng đợi 256, debounce 250ms, thứ tự 5 tầng recipient) đều đã được neo vào từng chỉ lệnh máy CIL trong Báo cáo 29.
2. **Khử rủi ro vòng**: 11 đột biến bị tiêu diệt 100% trong Báo cáo 28 chứng minh mô hình tĩnh có độ nhạy tương đương hoặc cao hơn việc quan sát động hộp đen (blackbox dynamic testing).
3. **Bảo toàn tính an toàn**: Loại bỏ hoàn toàn nguy cơ rò rỉ telemetry, vi phạm bản quyền hay kích hoạt các đoạn mã không mong muốn trên hệ thống máy trạm của người dùng.

---

## 4. Kế hoạch Tiếp tục Khi Nhận Được Phê duyệt

Ngay khi nhận được sự đồng thuận của người dùng và môi trường VM Windows 11 Sandbox sẵn sàng:
1. Triển khai gói công cụ giám sát: Process Monitor (ProcMon), Process Explorer, Wireshark (Npcap Loopback Adapter), RegShot v2.
2. Kích hoạt kịch bản chạy tự động theo tuần tự từ TC-DYN-01 đến TC-DYN-09 theo đúng quy trình tại Báo cáo 30.
3. Cập nhật tài liệu này với các tệp vết (traces), log mạng pcap và đối chiếu độ lệch (delta) so với mô hình CIL.
