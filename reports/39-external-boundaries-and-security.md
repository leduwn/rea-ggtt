# Báo cáo Đặc tả Ranh giới Bên ngoài & Bảo mật Phòng sạch (Phase 10 - Task F)

- **Mã tài liệu**: `39-external-boundaries-and-security.md`
- **Dự án**: Nghiên cứu & Dịch ngược Phòng sạch Ứng dụng GGTT (Google TikTok / TikTok Interactive Tool)
- **Mục tiêu**: Thiết lập tài liệu phân tích ranh giới bên ngoài (External Boundaries) và kiến trúc bảo mật (Security Architecture) toàn diện của GGTT, xác định chính xác các điểm giao tiếp mạng, IPC, hệ thống tệp và mô hình đe dọa (Threat Model), đồng thời thiết lập ranh giới bản quyền và nguyên tắc bảo mật cho nhóm phát triển phòng sạch độc lập.

---

## 1. Ranh giới Mạng & Điểm cuối Bên ngoài (Network Boundaries)

Hệ thống GGTT tương tác với thế giới bên ngoài thông qua 5 kênh mạng riêng biệt:

```
                      ┌────────────────────────────────────────┐
                      │            ỨNG DỤNG GGTT               │
                      └────┬───────┬───────┬───────┬───────┬───┘
                           │       │       │       │       │
    (1) TikTok Ingestion   │       │       │       │       │ (5) Discord Telemetry
    ───────────────────────┘       │       │       │       └──────────────────────
    - TikTok Live Webcast          │       │       │       - AppLogger Webhook
    - JSON Event Polling/WS        │       │       │       - Error/Crash Reports
                                   │       │       │       - Rate Limit (429) Backoff
         (2) Script Backend        │       │       │
         ──────────────────────────┘       │       └──────────────────────────────
         - jqsvn.com (HTTPS)               │       (4) OBS Studio Integration
         - Dynamic JS Payloads             │       - ws://127.0.0.1:{obs_port}/
         - 1MB Limit, BOM Strip            │       - OBS WebSocket v5 RPC
                                           │       - SHA-256 Challenge-Response
                   (3) Local Overlay & Media Server
                   ────────────────────────────────
                   - ws://127.0.0.1:3784 (WebSocket)
                   - http://*:{3785..3788}/media/ (HTTP)
                   - http://localhost:6211/ (AI Models)
```

### 1.1. Luồng Thu nhận Sự kiện TikTok Live (TikTok Ingestion Boundary)
- **Giao thức**: WebSocket / HTTP REST Polling mô phỏng giao thức Webcast của TikTok.
- **Dữ liệu**: Nhận các gói tin JSON chứa sự kiện phòng livestream (`WebcastGiftMessage`, `WebcastChatMessage`, `WebcastLikeMessage`, `WebcastMemberMessage`).
- **Ranh giới Bảo mật**:
  * Ứng dụng chỉ xử lý đọc (inbound read-only), không gửi lệnh điều khiển ngược lại máy chủ TikTok.
  * Bộ đệm trượt (sliding buffer) khử trùng lặp theo `(message_id, combo_id)` ngăn ngừa tấn công phát lại (replay attack) gây sai lệch số điểm thi đấu.

### 1.2. Máy chủ Kịch bản Từ xa (`jqsvn.com` Backend Boundary)
- **Điểm cuối**: Máy chủ tải kịch bản nhúng qua giao thức HTTPS.
- **Luồng xử lý**: Nạp mã JavaScript động để tiêm vào WebView2 phục vụ tự động hóa và giao diện tương tác.
- **Ranh giới Bảo vệ (`0x06000295 EmbeddedScriptLoader.Validate`)**:
  * Giới hạn kích thước nghiêm ngặt: $\le 1\,\text{MB}$ ($1,048,576$ bytes).
  * Khử BOM UTF-8 (`0xFEFF`).
  * Kiểm tra Content-Type bắt buộc (`application/javascript`, `text/javascript`).
  * Chặn đứng các byte null (`0x00`).
  * Phát hiện phản hồi từ chối bản quyền thông qua biểu thức chính quy chuỗi lỗi hex 32 ký tự `\A[a-fA-F0-9]{32}\z`, từ khóa `"error"`, `"no-data"`.

### 1.3. Máy chủ Overlay & Media Nội bộ (Local Server Boundary)
- **Phạm vi Lắng nghe**: Ràng buộc nghiêm ngặt trên giao diện cục bộ `127.0.0.1` / `localhost`.
- **Cấu hình Cổng Mạng**:
  * WebSocket Overlay: Cổng `3784`.
  * Media Streaming HTTP: Cổng cơ sở `3785`, tự động nhảy cổng tối đa 3 lần (`3785 -> 3786 -> 3787 -> 3788`), trễ 300ms khi phát hiện xung đột cổng.
  * AI Model File Server: Cổng `6211`.
- **Rủi ro Cần Tránh**: Không mở cổng ra mạng công cộng (`0.0.0.0`) mà không có cơ chế xác thực phiên.

### 1.4. Tích hợp OBS Studio v5
- **Giao thức**: OBS WebSocket v5 RPC trên cổng cục bộ của OBS (mặc định 4455 hoặc tùy biến).
- **Cơ chế Bắt tay**:
  * Nhận `salt` và `challenge` từ OBS.
  * Mã hóa băm kép SHA-256: `Base64(SHA256(Base64(SHA256(password + salt)) + challenge))`.
  * Đăng ký nhận sự kiện (EventSubscriptions).

### 1.5. Kênh Báo cáo Sự cố Discord Telemetry (`AppLogger`)
- **Điểm cuối**: Discord Webhook URL.
- **Hành vi**: Gửi tệp nhật ký `GGTT-current.log` hoặc thông tin ngoại lệ khi xảy ra lỗi nghiêm trọng (`ReportErrorAsync`, `ReportFatalAndWait`).
- **Bảo vệ Định danh**:
  * Sử dụng biểu thức chính quy `[^A-Za-z0-9._-]` để làm sạch siêu dữ liệu người dùng (`SanitizeMetadata`), loại bỏ thông tin nhạy cảm.
  * Tuân thủ mã phản hồi HTTP 429 và đọc header `Retry-After` để thực hiện thuật toán backoff, tránh spam máy chủ Discord.

---

## 2. Ranh giới Liên lạc Liên Tiến trình (IPC & Named Pipe Boundaries)

Phân hệ `GGTT.EffectsBridge.Effects.EffectProcessTrust` (`0x06000381`..`0x06000386`) kiểm soát ranh giới giao tiếp giữa GGTT và tiến trình phụ trợ (helper process/OBS plugin):

### 2.1. Xác thực Pipe Token & Danh tính Peer (`PipePeer`)
- Sử dụng Windows Named Pipe an toàn để trao đổi dữ liệu kịch bản và hiệu ứng.
- Trước khi chấp nhận kết nối, máy chủ Named Pipe kiểm tra danh tính tiến trình đối tác (`PipePeer`, `StudioParent`), bảo đảm tiến trình kết nối là OBS Studio hợp pháp hoặc công cụ phụ trợ được ủy quyền, ngăn chặn các tiến trình không có đặc quyền can thiệp vào bộ nhớ ứng dụng.

### 2.2. Cơ chế Xác thực Chữ ký Số RSA-2048 (`Verify`)
- Xác thực tệp kê khai phát hành (`effects-trust.json`) bằng thuật toán mã hóa bất đối xứng RSA-2048.
- Khóa công khai RSA Base64 được nhúng trực tiếp trong mã nhị phân tại token `0x700061e8`.
- Khống chế kích thước tối đa của manifest (`Release manifest too large`).
- **Nguyên tắc Phòng sạch**: Khóa công khai `0x700061e8` là tài sản sở hữu trí tuệ của tác giả gốc. Nhóm phát triển phòng sạch **tuyệt đối không được sao chép chuỗi khóa này**, mà phải tự sinh cặp khóa RSA riêng cho hệ thống mới.

---

## 3. Ranh giới Lưu trữ & Hệ thống Tệp Cục bộ (Storage & File System Boundaries)

| Thành phần Lưu trữ | Đường dẫn Mặc định trên Hệ điều hành | Vai trò Kỹ thuật | Cơ chế Toàn vẹn & An toàn |
|---|---|---|---|
| **Cơ sở Dữ liệu Sổ cái SQLite** | `<AppData>/GGTT/store.db` | Lưu trữ giao dịch quà tặng, combo, cấu hình ca đấu PK | Chế độ WAL (`journal_mode=WAL`), đồng bộ đầy đủ (`synchronous=FULL`), timeout 5000ms |
| **Thư mục Sao lưu CSDL** | `<AppData>/GGTT/backups/before-continuous-*.db` | Bản sao lưu tự động trước khi di chuyển lược đồ DDL | Tạo bản sao đĩa trước mỗi lần nâng cấp `PRAGMA user_version` |
| **Nhật ký Hoạt động (Logs)** | `%USERPROFILE%/Documents/JQ_Projects/Logs/` | Lưu vết hệ thống hiện hành (`GGTT-current.log`) và chờ gửi (`GGTT-pending.log`) | Khử ký tự đặc biệt, giới hạn dung lượng tệp (`TrimIfNeeded`) |
| **Mô hình Khung xương AI** | `<AppDir>/ai_model/` | Tệp mô hình MediaPipe BlazePose ONNX | Nạp vào bộ nhớ qua ONNX Runtime cục bộ, không gửi hình ảnh ra internet |
| **Tài nguyên Media Cục bộ** | `<AppDir>/media/` | Âm thanh (.mp3, .wav), video (.mp4, .webm), hình ảnh | Phục vụ cục bộ qua HttpListener với từ điển 14 MIME types |

---

## 4. Mô hình Mối đe dọa (Threat Model) & Rủi ro Triển khai

### 4.1. Ma trận Rủi ro Bảo mật
| Mã Nguy cơ | Mô tả Nguy cơ Tiềm ẩn | Hậu quả Kỹ thuật | Biện pháp Phòng vệ trong Đặc tả Phòng sạch |
|:---:|---|---|---|
| **THREAT-01** | Tiêm mã JavaScript độc hại qua luồng cập nhật script | Chiếm quyền điều khiển WebView2, đánh cắp cookie TikTok | Bắt buộc kiểm tra kích thước $\le 1\,\text{MB}$, Content-Type, cấm byte null, thẩm định cú pháp IIFE |
| **THREAT-02** | Tấn công phát lại gói tin quà tặng TikTok (Replay Attack) | Thao túng điểm số trận đấu PK, gây sai lệch sổ cái | Duy trì bộ đệm trượt kiểm tra `(message_id, combo_id)` chống trùng lặp |
| **THREAT-03** | Rung lắc mạng làm hỏng tệp CSDL SQLite khi đang ghi | Mất mát giao dịch quà tặng, hỏng dữ liệu người dùng | Cưỡng chế `journal_mode=WAL`, `synchronous=FULL`, tự động snapshot trước khi migration |
| **THREAT-04** | Tấn công DoS làm tràn hàng đợi kịch bản hình ảnh | Ứng dụng bị đơ (UI freezing), cạn kiệt tài nguyên bộ nhớ | Khống chế cứng trần 256 hành động/tick và kẹp biến số số học trong $[-1\,\text{M}, 1\,\text{M}]$ |
| **THREAT-05** | Tiến trình lạ kết nối vào Named Pipe giả mạo plugin OBS | Chèn lệnh phím nóng ảo hoặc thao túng luồng livestream | Kiểm tra mã nhận diện tiến trình cha và xác thực chữ ký token Named Pipe |
| **THREAT-06** | Rò rỉ thông tin người dùng qua Discord Webhook | Lộ tài khoản, thông tin hệ thống của streamer | Loại bỏ hoàn toàn kênh webhook cá nhân; dùng logging nội bộ bảo mật |

---

## 5. Ranh giới Pháp lý & Sở hữu Trí tuệ Phòng sạch (Clean-Room Boundary Rules)

Để bảo đảm 100% tính hợp pháp và an toàn bản quyền khi tái triển khai:

1. **Danh mục Các Phần Tử TUYỆT ĐỐI KHÔNG Sao chép (Do-Not-Copy Registry)**:
   - **Khóa công khai RSA-2048**: Token chuỗi `0x700061e8` (khóa bản quyền của JQ Projects).
   - **Địa chỉ Máy chủ Từ xa**: Không trỏ kết nối vào `jqsvn.com` hoặc các webhook Discord độc quyền của ứng dụng gốc.
   - **Tên thương hiệu & Biểu tượng**: Không sử dụng tên "GGTT", biểu tượng hoặc nhãn hiệu liên quan đến ứng dụng gốc.
2. **Danh mục Các Phần Tử ĐƯỢC PHÉP Triển khai Lại (Clean-Room Permitted)**:
   - Các công thức toán học mở: Công thức tính delta quà tặng, hàm kích hoạt Sigmoid kẹp $[-80, 80]$, thuật toán tạo lưới neo 2254 hộp của MediaPipe.
   - Chuẩn giao thức mở: Giao thức OBS WebSocket v5, định dạng tệp chuẩn JSON/SQLite, chuẩn giao thức mạng HTTP/WebSocket.
   - Ngưỡng kỹ thuật tương thích: Giới hạn 256 hành động kịch bản, điều tiết 250ms debounce, danh mục 14 MIME types.
3. **Quy trình Phát triển Hai Phòng Độc lập (Two-Room Isolation)**:
   - Nhóm Nghiên cứu (Phòng 1): Phân tích ngược nhị phân, trích xuất đặc tả toán học và tạo bộ kiểm thử tuân thủ (hoàn tất tại Phase 10).
   - Nhóm Phát triển (Phòng 2): Chỉ nhận 6 tài liệu đặc tả tại `specifications/` và bộ kiểm thử tại `tests/conformance/`. Không được đọc báo cáo dịch ngược nhị phân hay mã CIL.

---

## 6. Tái khẳng định Ranh giới An toàn Thực thi (Zero-Host Execution)
Tất cả các kết luận và ranh giới bảo mật trong báo cáo này được rút ra hoàn toàn từ việc phân tích tĩnh vi mã CIL và siêu dữ liệu nhị phân. Không có bất kỳ kết nối mạng thực nào được gửi tới `jqsvn.com`, TikTok hay Discord trong toàn bộ quá trình nghiên cứu, bảo toàn tuyệt đối tính cô lập và an toàn của hệ thống.
