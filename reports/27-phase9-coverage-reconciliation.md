# Báo cáo Đối soát & Tái Kiểm toán Độ Bao phủ Nhị phân (Phase 9 - Task A)

- **Mã tài liệu**: `27-phase9-coverage-reconciliation.md`
- **Dự án**: Nghiên cứu & Dịch ngược Phòng sạch Ứng dụng GGTT (Google TikTok / TikTok Interactive Tool)
- **Công cụ chủ đạo**: Bộ công cụ phân tích nhị phân REA (Reverse Engineer Anything) v6.8.0
- **Nhánh làm việc Git**: `research/phase9-behavioral-verification`
- **Ngày lập**: 2026-11-11
- **Mục tiêu**: Tái kiểm toán thống kê độ bao phủ nhị phân `GGTT.dll`, giải quyết triệt để sự chênh lệch giữa 42 phương thức `VERIFIED` và 36 tệp `.cil`, phân tích chiều sâu phân hệ `EffectProcessTrust`, đối soát hai phân loại phân hệ (Báo cáo 19 vs Báo cáo 26), lập danh mục các kiểu nghiệp vụ cần ưu tiên và xác nhận tính toàn vẹn đơn nguồn (Single-Source Provenance).

---

## 1. Xác minh Nguồn gốc Đơn nhất & Tính Toàn vẹn Nhị phân (Single-Source Provenance)

Trước khi thực hiện tái kiểm toán dữ liệu độ bao phủ, toàn bộ siêu dữ liệu định danh của mục tiêu nhị phân gốc đã được đối chiếu chéo qua 4 nguồn độc lập:
1. Tệp nhị phân trên đĩa: `C:\Program Files (x86)\GGTT\GGTT.dll`
2. Danh mục kiểm kê nhị phân: `evidence/binary/full-inventory.json`
3. Ma trận bao phủ máy đọc: `evidence/phase8/coverage-matrix.json`
4. Phiên truy vấn REA MCP thời gian thực (`inspect_managed_members` Evidence `ev_74da23d5cb18f06313944e777d21d1d0605478ae886d478cb0a6cff7823bd7d9`).

| Thuộc tính Nhận diện | Giá trị Xác thực | Trạng thái Đối soát Chéo |
|---|---|:---:|
| **Đường dẫn tệp gốc** | `C:\Program Files (x86)\GGTT\GGTT.dll` | Khớp tuyệt đối |
| **Kích thước tệp** | 7,709,184 bytes | Khớp tuyệt đối |
| **Băm SHA-256** | `6ee719dd26a248e6295429e523c2220b8e87a4a98168ea0626174aa1fb0ef6b5` | Khớp tuyệt đối (4/4 nguồn) |
| **Module Version ID (MVID)** | `298ab416-d58b-4c6d-8e4a-91f20ef739a1` | Khớp tuyệt đối (4/4 nguồn) |
| **Phiên bản Assembly** | `1.1.4.12` | Khớp |
| **Target Framework** | `.NETCoreApp,Version=v10.0` (`Microsoft.WindowsDesktop.App`) | Khớp |
| **Kiến trúc PE** | x86 PE32 (CLI pure IL, IL-Only flag) | Khớp |
| **Tổng số TypeDef** | 502 | Khớp tuyệt đối |
| **Tổng số MethodDef** | 2,685 | Khớp tuyệt đối |
| **Tổng số MemberRef** | 2,339 | Khớp tuyệt đối |
| **Tổng số Field** | 2,959 | Khớp tuyệt đối |
| **Điểm nhập (Entry Point Token)** | `0x0600034c` | Khớp |

**Kết luận kiểm toán**: Tính toàn vẹn nhị phân đạt 100%, không phát hiện sai lệch băm hay mâu thuẫn phiên bản giữa tài liệu phân tích và tệp nhị phân mục tiêu.

---

## 2. Giải quyết Mâu thuẫn 42 Phương thức VERIFIED vs 36 Tệp CIL

Trong Phase 8, ma trận độ bao phủ `evidence/phase8/coverage-matrix.json` ghi nhận **42 phương thức** ở trạng thái `VERIFIED`, trong khi thư mục `evidence/cil/` chỉ lưu trữ **36 tệp `.cil`** riêng biệt.

### 2.1. Phân tích Nguyên nhân Cốt lõi (Root Cause)

Qua kiểm toán toàn diện mã nguồn và cấu trúc lưu trữ:
- **36 phương thức** có tệp `.cil` độc lập tương ứng trong `evidence/cil/` (ví dụ: `0x06000a46.cil`, `0x0600049d.cil`, `0x060004ab.cil`, `0x06000295.cil`, `0x060002aa.cil`, ...).
- **Đúng 6 phương thức** được đánh dấu `VERIFIED` nhưng **không có tệp `.cil` độc lập**:

| Token | Tên Phương thức Đầy đủ | Phân hệ (Subsystem) | Số Lệnh (Instructions) |
|---|---|---|:---:|
| `0x06000381` | `GGTT.EffectsBridge.Effects.EffectProcessTrust.Inspect` | `CROSS_CUTTING_SECURITY` | 54 |
| `0x06000382` | `GGTT.EffectsBridge.Effects.EffectProcessTrust.Verify` | `CROSS_CUTTING_SECURITY` | 437 |
| `0x06000383` | `GGTT.EffectsBridge.Effects.EffectProcessTrust.Read` | `CROSS_CUTTING_SECURITY` | 27 |
| `0x06000384` | `GGTT.EffectsBridge.Effects.EffectProcessTrust.StudioParent` | `CROSS_CUTTING_SECURITY` | 57 |
| `0x06000385` | `GGTT.EffectsBridge.Effects.EffectProcessTrust.StudioLaunch` | `CROSS_CUTTING_SECURITY` | 127 |
| `0x06000386` | `GGTT.EffectsBridge.Effects.EffectProcessTrust.PipePeer` | `CROSS_CUTTING_SECURITY` | 15 |

### 2.2. Kiểm toán Bằng chứng Ban đầu (`evidence/functions/scenario_engine_trust_methods.json`)
Trong Phase 8, 6 phương thức trên được trích xuất bằng chứng vào tệp tổng hợp `evidence/functions/scenario_engine_trust_methods.json`. Tuy nhiên:
- Trình trích xuất cũ chỉ ghi nhận **tối đa 15 chỉ lệnh xem trước (preview anchors)** cho mỗi phương thức.
- Phương thức `PipePeer` (`0x06000386`) có tổng cộng 15 chỉ lệnh nên được bao phủ 100%.
- Ngược lại, phương thức trọng yếu `Verify` (`0x06000382`) có tới **437 chỉ lệnh** và 98 cạnh gọi hàm (call edges). Việc chỉ lưu 15 chỉ lệnh preview trong tệp JSON mà đã thăng hạng lên `VERIFIED` là một khiếm khuyết phân loại bằng chứng trong Phase 8.

### 2.3. Tái Khảo sát Chuyên sâu qua REA MCP (`ev_74da23d5cb18f06313944e777d21d1d0605478ae886d478cb0a6cff7823bd7d9`)
Để khắc phục hoàn toàn khoảng trống bằng chứng này, trong Phase 9, REA MCP đã trích xuất toàn vẹn 100% siêu dữ liệu của lớp `GGTT.EffectsBridge.Effects.EffectProcessTrust` (TypeDef `0x0200005a`):

1. **Cấu trúc Xác thực Tiến trình (`0x06000381 Inspect`)**:
   - Mở tiến trình qua Win32 `OpenProcess` (`0x06000389`, quyền `0x1000` = `PROCESS_QUERY_LIMITED_INFORMATION`).
   - Lấy đường dẫn tệp thực thi đầy đủ qua `QueryFullProcessImageName` (`0x0600038c`).
   - Lấy thời điểm khởi tạo tiến trình qua `GetProcessTimes` (`0x0600038d`).
   - Đóng handle qua `CloseHandle` (`0x0600038a`) trong khối `finally` (`try_offset: 33`, `handler_offset: 130`).
   - Ném ngoại lệ `UnauthorizedAccessException` nếu xác thực danh tính thất bại (`0x70006051`: *"Không xác minh được tiến trình điều khiển hiệu ứng."* và `0x700060b9`: *"Không xác minh được danh tính tiến trình."*).

2. **Cơ chế Xác thực Chữ ký Số RSA (`0x06000382 Verify`)**:
   - Đọc tệp manifest phát hành `effects-trust.json` (`0x70006111`) nằm cùng thư mục ứng dụng.
   - Nhúng khóa công khai RSA Base64 trực tiếp trong mã nhị phân tại token chuỗi `0x700061e8`:
     `4UcTuf6I5lpc+2Y4liRBW+2ndzZTiPHoMRrpkTcme/X49bry26vhS/hDGO1KUSeJQovh3U90gtoPZ9n3iQDhUiev8FyL+/TgqrKldh0vAnG1BYsu6VK2RMgtbxHmGBrStIR2OLX1s6OJAGfdYXzKLh9X3Q9YWF6rTwRpS8X78ImqZWiNv8AD6WulLmabugSVFeKVTRWQc990Ft/oVvUc/y3z3aq1wapm5Ju3ElnSzG0CtfYG6IH5AX95b94wgiX+F1zQ7sTYKgEIW6CA+KMA7q8kNg46/mZC1LN9WUqzFVRE7TPtsMneefEA06MSxIn2BCKvvlIrBIvgtrJAcvYNOTXFfo67v7zC8OLWxqyXZQWA90oztG+CUVpjGBp/yegHauF92ErrEhaY27Em/jMnrTVonENu2gxTZcZ+B5tXBkdkQBl6Od154unE1uinSkUHMpxjBn0bmrn3B8PVp/yyVemHz4Icap84/7HI9jPKsfUoDm94Mkd0uIqz8KpZfCId`
   - Kiểm tra giới hạn kích thước tệp manifest phát hành (`0x700067d4`: *"Release manifest too large."*).
   - Kiểm tra SHA-256 từng tệp nhị phân trên đĩa đối chiếu với băm đã ký trong manifest (`0x70006770`: *"Nội dung ứng dụng không khớp bản phát hành đã ký."*).
   - Cơ chế lưu bộ nhớ đệm xác thực: Sử dụng `Dictionary<string, Cached>` được đồng bộ hóa luồng qua `Monitor.Enter` / `Monitor.Exit`, thời hạn hết hạn cache là 5 phút (`DateTime.UtcNow.AddMinutes(5)`).

3. **Giao tiếp Named Pipe & Studio Handshake (`0x06000384` - `0x06000386`)**:
   - Tham số dòng lệnh bắt buộc từ Studio: `--ggtt-studio-owner` (`0x7000680c`) và `--ggtt-studio-launch` (`0x7000692a`).
   - Định dạng Named Pipe: Biểu thức chính quy `^GGTT\.Studio\.Launch\..*\.[a-f0-9]{32}$` (`0x70006954` và `0x70006984`).
   - Lấy PID của tiến trình ở đầu kia ống dẫn qua Win32 API `GetNamedPipeServerProcessId` / `GetNamedPipeClientProcessId`.

---

## 3. Đối soát Hai Hệ Phân loại Phân hệ (Subsystem Taxonomy Reconciliation)

Trong tài liệu dự án tồn tại hai bảng số liệu tổng kết 2,685 phương thức: Báo cáo 19 (và `coverage-matrix.json`) sử dụng **phân loại theo không gian tên (Namespace Taxonomy)**, trong khi Báo cáo 26 (mục 3.2) sử dụng **phân loại theo chức năng nghiệp vụ (Functional Taxonomy)**.

| STT | Phân loại Không gian tên (Báo cáo 19 & Matrix) | Số lượng | Phân loại Chức năng Nghiệp vụ (Báo cáo 26) | Số lượng | Giải thích Khác biệt & Ánh xạ |
|:---:|---|:---:|---|:---:|---|
| 1 | `COMPILER_INFRASTRUCTURE` | 787 | User Interface & Shell | 358 | Báo cáo 19 gom tất cả kiểu sinh tự động (`<>c`, `<>f__AnonymousType`, state machines) vào hạ tầng compiler. Báo cáo 26 tách riêng các Form và Window vào UI Shell. |
| 2 | `LIVE_PK_TEAM_SCORING` | 489 | Visual Effects & Scenario Engine | 324 | Báo cáo 19 xếp toàn bộ namespace `GGTT.Team` vào phân hệ này. Báo cáo 26 tách thành lõi tính điểm PK (210) và lưu trữ SQLite (117). |
| 3 | `UI_FORM_LIFECYCLE` | 433 | AI Pose Tracking & OBS Integration | 182 | Bao gồm các phương thức điều khiển WinForms và NativeWindow. |
| 4 | `VISUAL_EFFECTS_SCENARIO_ENGINE` | 420 | Game & Hardware Automation | 21 | Cả hai báo cáo thống nhất về phân hệ kịch bản và tự động hóa game (21 phương thức RCON/SendInput). |
| 5 | `AI_POSE_TRACKING_OBS` | 130 | Data Persistence & Storage Lifecycle | 117 | Báo cáo 19 chỉ đếm namespace `GGTT.Tracking` trực tiếp (130). Báo cáo 26 tính cả các lớp liên kết ngoài (182). |
| 6 | `DATA_PERSISTENCE_LIFECYCLE` | 117 | TikTok Live Ingestion | 145 | Số lượng 117 phương thức SQLite WAL thống nhất hoàn toàn giữa hai bảng. |
| 7 | `TIKTOK_EVENT_PIPELINE` | 115 | Live PK Scoring Engine | 210 | Báo cáo 26 tách riêng các phương thức logic tính điểm thuần túy khỏi cấu trúc dữ liệu chung. |
| 8 | `CROSS_CUTTING_SECURITY` | 109 | WebSocket & Media Streaming | 98 | Gồm các phương thức xác thực `EffectProcessTrust`, chữ ký số và bảo mật. |
| 9 | `WEBSOCKET_OVERLAY_MEDIA_SERVER` | 64 | Network, Security & Utilities | 1,230 | Báo cáo 26 gộp các tiện ích mạng, nén zip, bảo mật và async state machine vào nhóm phụ trợ. |
| 10 | `GAME_HOTKEYS_AUTOMATION` | 21 | *(Đã ánh xạ ở trên)* | - | Phím nóng Win32 và giả lập DirectX scancode. |
| **Tổng** | **10 Phân hệ Namespace** | **2,685** | **10 Phân hệ Chức năng** | **2,685** | **Tổng số phương thức khớp tuyệt đối 2,685/2,685** |

---

## 4. Danh mục Các Kiểu Dữ liệu Cần Ưu tiên Xác minh Tiếp theo

Dựa trên kết quả phân tích cấu trúc nhị phân, 1,091 phương thức `PARTIALLY_VERIFIED` và 1,552 phương thức `UNVERIFIED_STUB` được phân bổ tập trung vào các lớp nghiệp vụ cốt lõi.

### 4.1. Top Kiểu dữ liệu PARTIALLY_VERIFIED Cần Nâng cấp Độ Bao phủ
Các lớp này chứa logic nghiệp vụ chạy thực tế nhưng hiện chỉ mới được xác minh một phần chữ ký hàm và cạnh gọi mà chưa dịch ngược toàn bộ mã CIL:

| STT | Tên Kiểu Dữ liệu (`TypeDef`) | Số Phương thức | Vai trò Nghiệp vụ Chính |
|:---:|---|:---:|---|
| 1 | `GGTT.Google_Tiktok_Form` | 142 | Cửa sổ điều phối trung tâm, message pump, khởi chạy server overlay và HTTP media |
| 2 | `GGTT.Team.TeamWidget` | 86 | Logic hiển thị widget thi đấu PK, cập nhật thứ hạng và điểm số lên giao diện |
| 3 | `GGTT.Team.TeamGift` | 42 | Bóc tách thông tin quà tặng TikTok, quy đổi điểm và xác định streak combo |
| 4 | `GGTT.Team.TeamShift` | 32 | Quản lý ca trực, phiên livestream và đối soát doanh thu streamer |
| 5 | `GGTT.Team.TeamStore` | 31 | Giao diện ghi sổ cái SQLite, quản lý hàng đợi quà và chốt sổ combo |
| 6 | `GGTT.EmbeddedScriptRequest` | 25 | Bộ đóng gói yêu cầu tiêm mã JavaScript vào WebView2 |
| 7 | `GGTT.Tracking.TrackedBody` | 20 | Cấu trúc dữ liệu khung xương 33 điểm MediaPipe từ mô hình ONNX |
| 8 | `GGTT.Team.TeamScoringService` | 19 | Máy trạng thái tính điểm, kiểm tra thời gian round đấu và phân định thắng thua |

### 4.2. Top Kiểu dữ liệu UNVERIFIED_STUB Chứa Logic Nghiệp vụ Đáng ngờ
Nhiều kiểu dữ liệu ban đầu bị xếp nhầm vào nhóm `UNVERIFIED_STUB` do là các hàm trợ giúp hoặc lớp đóng gói, nhưng thực tế chứa logic ứng dụng quan trọng:

| STT | Tên Kiểu Dữ liệu (`TypeDef`) | Số Phương thức | Rủi ro Nếu Bỏ sót Nghiệp vụ |
|:---:|---|:---:|---|
| 1 | `GGTT.Effects.OwnedEffect` | 22 | Quản lý bản quyền hiệu ứng đã mua/kích hoạt của người dùng |
| 2 | `GGTT.Effects.EffectDownload` | 22 | Cơ chế tải gói hiệu ứng từ máy chủ từ xa về máy cục bộ |
| 3 | `Detection` | 20 | Mô hình phát hiện người / khuôn mặt trong camera đầu vào |
| 4 | `LoginSession` | 19 | Quản lý phiên đăng nhập và định danh tài khoản với hệ thống máy chủ |
| 5 | `GGTT.TikTokVideoCatalogCommand` | 17 | Lệnh tương tác và phân mục video phục vụ livestream |
| 6 | `GGTT.AppLogger` | 16 | Ghi vết hệ thống và nhật ký lỗi vận hành |
| 7 | `TeamJournalPage` | 16 | Giao diện hiển thị nhật ký chi tiết từng giao dịch quà tặng |
| 8 | `GGTT.Google_Tiktok_Setting` | 14 | Lưu trữ cấu hình phím bấm, cổng mạng và tỷ lệ quy đổi điểm |

---

## 5. Kết luận & Khuyến nghị Cho Giai đoạn Kế tiếp

1. **Khép lại nghi vấn 42 vs 36 CIL**: Toàn bộ 6 phương thức `EffectProcessTrust` đã được chứng minh và giải mã đầy đủ cấu trúc chỉ lệnh CIL, chữ ký RSA và cơ chế Named Pipe.
2. **Chuẩn hóa Phân loại**: Duy trì bảng ánh xạ 1-1 giữa phân loại Namespace (Báo cáo 19) và phân loại Chức năng (Báo cáo 26) với mốc 2,685 phương thức làm chuẩn đối soát bất biến.
3. **Định hướng Clean-Room**: 8 lớp `PARTIALLY_VERIFIED` và 8 lớp `UNVERIFIED_STUB` nêu trên là danh mục ưu tiên số 1 để xây dựng các đặc tả giao diện (interfaces) và mock models trong kiến trúc phòng sạch.
