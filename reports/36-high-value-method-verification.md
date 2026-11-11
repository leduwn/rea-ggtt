# Báo cáo Xác minh Các Phương thức Chưa Phân tích Trọng yếu (Phase 10 - Task C)

- **Mã tài liệu**: `36-high-value-method-verification.md`
- **Dự án**: Nghiên cứu & Dịch ngược Phòng sạch Ứng dụng GGTT (Google TikTok / TikTok Interactive Tool)
- **Tập tin máy đọc**: `evidence/phase10/coverage-delta.json`
- **Mục tiêu**: Tiến hành phân tích sâu vi mã CIL đối với nhóm các kiểu dữ liệu và phương thức từng bị phân loại là `PARTIALLY_VERIFIED` và `UNVERIFIED_STUB` trong Báo cáo 27, loại bỏ triệt để các "điểm mù" kỹ thuật (technical blind spots) và chứng minh bản chất logic của các phân hệ phụ trợ.

---

## 1. Phân tích Chiều sâu Phân hệ Ghi vết & Báo lỗi (`GGTT.AppLogger`)

Trong Báo cáo 27, `GGTT.AppLogger` gồm 17 phương thức (`0x06000211`..`0x06000221`) bị xếp vào danh mục stub chưa xác minh. Phân tích CIL trực tiếp cho thấy đây là phân hệ telemetry và xử lý lỗi ứng dụng.

### 1.1. Khởi tạo & Cấu trúc Thư mục Log (`0x06000212 Initialize`)
Phương thức sử dụng các chỉ lệnh CIL để thiết lập đường dẫn lưu trữ tại máy trạm:
- **Đường dẫn thư mục**: `Path.Combine(Environment.GetFolderPath(SpecialFolder.MyDocuments), "JQ_Projects", "Logs")` (`IL_0024 - IL_002e`).
- **Tập tin nhật ký hiện hành**: `"GGTT-current.log"` (`IL_0048`).
- **Tập tin nhật ký chờ gửi**: `"GGTT-pending.log"` (`IL_005c`).
- **Header khởi động**: Ghi nhận thời gian, phiên bản hệ điều hành (`"Windows: "`), kiến trúc tiến trình (`"64-bit process: "`), và thông báo `"Khởi động chương trình"`.

### 1.2. Làm sạch Siêu dữ liệu An toàn (`0x0600021b SanitizeMetadata`)
Để bảo vệ an toàn định danh khi gửi báo cáo lỗi:
```cil
IL_0006: ldstr          "[^A-Za-z0-9._-]"
IL_000b: ldstr          "_"
IL_0010: call           System.Text.RegularExpressions.Regex::Replace
IL_0016: ldloc.0        
IL_0017: callvirt       System.String::IsNullOrEmpty
IL_001c: brtrue.s       36
IL_001e: ldstr          "unknown"
IL_0023: ret            
```
Mọi ký tự đặc biệt ngoài bảng chữ cái tiếng Anh, số, dấu chấm, gạch dưới và gạch ngang đều bị chuyển thành dấu gạch dưới (`_`). Nếu chuỗi rỗng, trả về `"unknown"`. Kẹp độ dài tối đa bằng tham số `arg.1`.

### 1.3. Cơ chế Đẩy Lỗi Discord & Backoff (`0x0600021a GetDiscordRetryDelayAsync`)
- Tích hợp gửi thông báo sự cố qua Discord Webhook.
- Phương thức `GetDiscordRetryDelayAsync` đọc phản hồi HTTP 429 (Too Many Requests), phân tích header `Retry-After` để thiết lập thời gian chờ bất đồng bộ trước khi thử gửi lại gói tin nhật ký.

---

## 2. Phân tích Chiều sâu Cửa sổ Cài đặt (`GGTT.Google_Tiktok_Setting`)

Gồm 15 phương thức (`0x06000331`..`0x0600033f`).
- **Giao diện WebView2**: Thay vì WinForms thuần, cài đặt được hiển thị bên trong WebView2 với profile chuyên biệt (`InitializeWebViewWithProfileAsync`, `0x06000338`).
- **Bắt thông điệp IPC**: Phương thức `webView21_WebMessageReceived` (`0x0600033a`) và `HandleSettingCommand` (`0x0600033b`) xử lý các lệnh:
  * `"enable_dev_mode"`: Kích hoạt công cụ Chromium DevTools (`0x700050fe`).
  * `"disable_dev_mode"`: Vô hiệu hóa DevTools (`0x70005144`).
- **Lưu/Khôi phục Tọa độ Cửa sổ**: Lưu trữ vị trí X, Y, Width, Height vào Registry/Setting và nạp lại khi hiển thị (`Google_Tiktok_Setting_Shown`).

---

## 3. Phân tích Chiều sâu Dịch vụ Tính điểm (`GGTT.Team.TeamScoringService`)

23 phương thức thuộc lớp `TeamScoringService` (`0x06000626`..`0x0600063c`):

### 3.1. Phân luồng Sổ cái Hai Nhánh CIL (`0x0600063a AddLedger`)
Phương thức `AddLedger` kiểm tra cờ tham số thứ 15 (`is_pending`):
```cil
IL_0006: ldstr          "INSERT INTO "
IL_000b: ldarg.s        15
IL_000d: brtrue.s       22
IL_000f: ldstr          "ledger"
IL_0014: br.s           27
IL_0016: ldstr          "pending_gifts"
IL_001b: ldstr          "(id,shift_id,group_id,channel,channel_uid,member_id,sender_id,gift_id,coins,quantity,occurred_at,round_id,kind,note,source,widget_rounds,journal_id,deleted_at,revision,parts) VALUES($id,'',$group,$channel,$uid,$member,$sender,$gift,$coins,$qty,$time,'',$kind,$note,$source,$rounds,$journal,'',0,'{}')"
```
- Nếu quà chưa gán thành viên (`is_pending == true`), bản ghi được lưu vào bảng `pending_gifts`.
- Nếu quà đã được gán thành viên hợp lệ (`is_pending == false`), bản ghi được ghi trực tiếp vào bảng `ledger`.

### 3.2. Định tuyến Mục tiêu Nhận quà (`0x0600063b SelectTarget`)
Triển khai cây quyết định 5 tầng đã được chứng minh tại CLM-02, trả về định danh `member_id` hoặc chuỗi rỗng để kích hoạt nhánh `pending_gifts`.

---

## 4. Phân tích Bản chất Các Kiểu Dữ liệu Bị Nghi Ngờ (`UNVERIFIED_STUB`)

Báo cáo 27 từng cảnh báo nguy cơ bỏ sót nghiệp vụ tại 6 kiểu dữ liệu:
1. `GGTT.Effects.OwnedEffect` (24 methods)
2. `GGTT.Effects.EffectDownload` (24 methods)
3. `Detection` (20 methods)
4. `LoginSession` (19 methods)
5. `GGTT.Tracking.TrackedBody` (22 methods)
6. `GGTT.EmbeddedScriptRequest` (27 methods)

### Kết quả Kiểm tra Vi mã CIL Thực tế
Cả 6 kiểu dữ liệu trên **hoàn toàn là C# `record` (DTO bất biến)** do trình biên dịch C# sinh ra:
- Toàn bộ phương thức đều mang chữ ký tiêu chuẩn của record boilerplate:
  * `get_EqualityContract()`
  * `PrintMembers(StringBuilder)`
  * `op_Equality`, `op_Inequality`
  * `GetHashCode()`, `Equals(object)`, `Equals(T)`
  * `<Clone>$()`, `Deconstruct(...)`
- Không chứa bất kỳ thuật toán ẩn, mã độc, backdoor hay logic nghiệp vụ phức tạp nào.
- Tổng số 136 phương thức của nhóm này được xác nhận là DTO thuần túy.

---

## 5. Bảng Tổng kết Độ Bao phủ Bổ sung (Coverage Delta)

| Nhóm Phương thức | Số lượng Phương thức | Trạng thái Trước Phase 10 | Trạng thái Sau Phase 10 | Đánh giá & Kết luận |
|---|:---:|:---:|:---:|---|
| **`GGTT.AppLogger`** | 17 | `UNVERIFIED_STUB` | **`VERIFIED_CIL`** | Đã giải mã toàn bộ đường dẫn log, regex sanitize, và cơ chế backoff Discord |
| **`GGTT.Google_Tiktok_Setting`** | 15 | `UNVERIFIED_STUB` | **`VERIFIED_CIL`** | Đã xác minh WebView2 command routing (`enable/disable_dev_mode`) |
| **`GGTT.Team.TeamScoringService`** | 23 | `PARTIALLY_VERIFIED` | **`VERIFIED_CIL`** | Đã chứng minh logic ghi sổ cái kép (`ledger` vs `pending_gifts`) |
| **Record DTO Boilerplate** | 136 | `UNVERIFIED_STUB` | **`PROVEN_RECORD_DTO`** | Đã chứng minh 100% là cấu trúc dữ liệu thuần, không chứa mã nghiệp vụ |
| **Các phương thức lõi trước đó** | 42 | `VERIFIED` | **`VERIFIED_CIL`** | Giữ nguyên trạng thái xác minh 100% vi mã CIL |
| **Tổng số phương thức phân tích sâu** | **233** | - | - | **Bao phủ 100% đường dẫn trọng yếu của ứng dụng** |

---

## 6. Khuyến nghị Kỹ thuật Phòng sạch
1. **Phân hệ AppLogger**: Trong quá trình phát triển phòng sạch, không cần gửi log lên Discord cá nhân của tác giả gốc. Có thể thay thế bằng cấu hình Serilog hoặc NLog cục bộ tiêu chuẩn.
2. **Cấu trúc DTO**: Có thể tái triển khai 6 lớp DTO bằng các C# record tương đương với cùng tên trường JSON.
3. **Phân luồng SQLite**: Bắt buộc tuân thủ việc ghi vào `pending_gifts` khi thiếu `member_id` để đảm bảo tính toàn vẹn của sổ cái.
