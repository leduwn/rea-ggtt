# Báo cáo Dịch ngược Giao diện & Luồng Điều khiển Ứng dụng (Phase 8 - UI & Application Control Flow)

- **Mã báo cáo**: `20-ui-and-application-control-flow.md`
- **Phân hệ phân tích**: `GGTT.Program`, `GGTT.Google_Tiktok_Form`, `GGTT.AppLogger`, `GGTT.SettingsMigration` (433 phương thức)
- **Công nghệ nền tảng**: Windows Forms (.NET 10 Desktop Runtime) + Microsoft.Web.WebView2 (Chromium)
- **Kiến trúc luồng**: STA Main Thread + Background Worker Tasks + CancellationTokenSource
- **Ngày hoàn tất**: 2026-11-11

---

## 1. Chu kỳ Khởi động & Điểm vào Ứng dụng (Application Bootstrap & Program.Main)

Điểm nhập cảnh nhị phân chính được định danh tại `GGTT.Program.Main` (`0x0600034c`):

```cil
IL_0000: call        Assembly::GetExecutingAssembly()
IL_0005: callvirt    Assembly::get_Location()
IL_000c: call        Path::GetFileNameWithoutExtension()
...
IL_0035: newobj      Mutex::.ctor(bool, string, out bool)
IL_003f: call        Environment::Exit(0)
IL_0046: call        Program::RegisterGlobalErrorHandlers()
IL_004b: call        AppLogger::Initialize()
IL_0055: call        AppLogger::Write("Bắt đầu mở GGTT")
IL_005a: call        SettingsMigration::Upgrade()
IL_005f: call        ApplicationConfiguration::Initialize()
IL_0064: newobj      Google_Tiktok_Form::.ctor()
IL_0069: call        Application::Run(Form)
IL_0073: call        AppLogger::Write("Ứng dụng đóng bình thường")
IL_008e: callvirt    IDisposable::Dispose() // Mutex.Dispose
```

### 1.1. Cơ chế Đơn phiên (Single-Instance Mutex)
- GGTT ngăn chặn việc mở đồng thời nhiều bản sao ứng dụng bằng cách tạo một `System.Threading.Mutex` toàn cục.
- Tên Mutex được phái sinh từ tên tệp thực thi viết thường: ví dụ `ggtt_mutex`.
- Nếu cờ `createdNew == false`, ứng dụng ngay lập tức gọi `Environment.Exit(0)` để chấm dứt tiến trình mới.

### 1.2. Bẫy Lỗi Toàn cục (Global Exception Handlers)
Phương thức `RegisterGlobalErrorHandlers` (`0x0600034d`) đăng ký 3 điểm chặn ngoại lệ:
1. `Application.ThreadException`: Bắt các lỗi chưa được xử lý trên luồng giao diện Windows Forms chính.
2. `AppDomain.CurrentDomain.UnhandledException`: Bắt các ngoại lệ nghiêm trọng ở cấp độ toàn bộ tiến trình.
3. `TaskScheduler.UnobservedTaskException`: Bắt lỗi từ các Task bất đồng bộ không được `await`.
- Các lỗi được lọc qua `IsExpectedBackgroundTaskError` (`0x0600034e`) để bỏ qua các lỗi hủy tác vụ thông thường (`OperationCanceledException`, `TaskCanceledException`).
- Các lỗi nghiêm trọng được ghi vào log cục bộ và gửi telemetry qua `AppLogger.ReportFatalAndWait`.

---

## 2. Máy Trạng thái Form Chính (Google_Tiktok_Form State Machine)

`Google_Tiktok_Form` (`0x0200004c`) là cửa sổ điều khiển trung tâm chứa 123 trường dữ liệu trạng thái:

```
+---------------------------------------------------------------------------------------+
|                      GOOGLE_TIKTOK_FORM STATE MACHINE                                 |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   +-----------------------+   Start / InitBrowser_TT    +-------------------------+   |
|   |                       | --------------------------> |                         |   |
|   |     IDLE / SETUP      |                             |   CONNECTING_TIKTOK     |   |
|   | (Check settings,      | <-------------------------- | (WebView2 Core setup,   |   |
|   |  load proxy, bounds)  |     Timeout / Auth Failed   |  fetch jqsvn.com script)|   |
|   +-----------------------+                             +------------+------------+   |
|                                                                      |                |
|                                                           Navigation | DOMContentLoaded
|                                                           Completed  |                |
|                                                                      v                |
|   +-----------------------+       TeamStartPK           +-------------------------+   |
|   |                       | <-------------------------- |                         |   |
|   |   LIVE_PK_RUNNING     |                             |    TIKTOK_MONITORING    |   |
|   | (TeamTick 1s timer,   | --------------------------> | (Capturing gift/comment |   |
|   |  State broadcast 250ms|        TeamEndPK            |  via WebMessage IPC)    |   |
|   |  OBS WebSocket sync)  |                             +-------------------------+   |
|   +-----------+-----------+                                                           |
|               |                                                                       |
|               | OnFormClosing                                                         |
|               v                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   |                             TEARDOWN & CLEANUP                                |   |
|   |  - DisposeEmbeddedScripts()                                                   |   |
|   |  - Cancel tokens: processingOnlineCts, desktopLoginCts                        |   |
|   |  - LocalAiFileServer.Dispose(), StopWebSocketServer()                         |   |
|   |  - DisposeTeamFeature(), AppLogger.Write("Ứng dụng đóng bình thường")         |   |
|   +-------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------+
```

### 2.1. Quản lý Mạng Đa cổng & Máy chủ Cục bộ
Form chính quản lý đồng thời 3 dịch vụ mạng nội bộ:
1. **WebSocket Server** (`wssv` - cổng 3784):
   - Cung cấp luồng dữ liệu thời gian thực cho OBS Browser Source.
   - Quản lý danh sách `clients` (`List<IWebSocketConnection>`) với khóa đồng bộ `clientsLock`.
2. **HTTP Media Server** (`mediaListener` - cổng cơ sở 6211):
   - Phân phối file ảnh, video, âm thanh, Live2D (`.moc3`) cho widget.
   - Cơ chế tự nhảy cổng dự phòng: `6211 -> 6212 -> 6213 -> 6214`.
3. **Local AI File Server** (`aiServer`):
   - Phục vụ các tài nguyên dữ liệu và tệp tạm thời cho phân hệ AI Pose Tracking.

---

## 3. Kiến trúc Trình duyệt Kép (Dual WebView2 Architecture)

GGTT tích hợp 2 thành phần Chromium WebView2 độc lập:
1. `WebViewTikTok`: Dành cho giao diện web máy tính để bàn (Desktop live stream).
2. `WebViewTikTokMobile`: Dành cho phiên bản luồng trực tiếp di động (TikTok Mobile Web).

### 3.1. Vòng đời Khởi tạo WebView2
- `InitializeWebViewWithProfileAsync` (`0x060002c4`): Cấu hình thư mục dữ liệu người dùng (`userDataFolder`) riêng biệt để lưu trữ session, cookie, tránh xung đột với trình duyệt Edge của hệ điều hành.
- `InitBrowser_TT` (`0x060002c9`): Thiết lập môi trường và cấu hình các tùy chọn proxy (nếu `proxyAddress` được thiết lập).
- `GGCodeNavigationStarting` (`0x060002f7`): Chặn và kiểm tra URL điều hướng, ngăn chặn chuyển hướng sang các trang độc hại.
- `WebViewTikTok_DOMContentLoaded` (`0x060002fc`): Khi DOM trang live sẵn sàng, gọi `InjectEmbeddedScriptAsync` (`0x06000300`) để tiêm hook script `communicate_launcher`.
- `webView21_WebMessageReceived_1` (`0x060002d2`): Điểm nhận thông điệp JSON từ JavaScript gửi lên qua `window.chrome.webview.postMessage`.

---

## 4. Các Luồng Ngầm & Bộ Đếm Thời Gian (Timers & Background Tasks)

1. **`teamTimer` (Chu kỳ 1,000ms / 1s)**:
   - Kích hoạt phương thức `TeamTick` (`0x0600030e`).
   - Cập nhật số giây còn lại của vòng đấu PK (`RoundSecondsLeft--`).
   - Kiểm tra hết giờ, tự động chuyển vòng hoặc kết thúc trận đấu.
2. **Giới hạn Phát trạng thái (250ms Throttling)**:
   - Trong `SendTeamState` (`0x06000311`), kiểm tra khoảng cách thời gian `(UtcNow - teamLastStateSent).TotalMilliseconds < 250`.
   - Nếu chưa đủ 250ms, đặt cờ `teamStatePending = true` và ủy quyền cho `SendDelayedTeamStateAsync` gửi sau khi hết độ trễ, tránh làm treo giao diện OBS do quá tải bản tin.
3. **Giám sát Sức khỏe Hệ thống (`InitHealthMonitor` 0x060002bb)**:
   - Theo dõi mức sử dụng CPU (`_cpuCounter`) và dung lượng đĩa trống (`MinFreeDiskBytes`).
   - Tự động dọn dẹp bộ nhớ đệm (`CleanCache`) khi phát hiện dung lượng lưu trữ cục bộ vượt quá `MaxLocalSaveBytes`.

---

## 5. Hệ thống Nhật ký & Gửi Báo cáo Lỗi từ xa (AppLogger Telemetry)

Lớp `GGTT.AppLogger` (`0x02000041`) triển khai giải pháp ghi log và báo cáo crash:
- **Tệp log cục bộ**: Lưu trong thư mục `Logs/` với tệp hiện hành `GGTT-current.log`.
- **Xoay vòng log (Log Rotation)**: `TrimIfNeeded` (`0x0600021d`) tự động cắt bớt log cũ khi kích thước tệp vượt ngưỡng an toàn.
- **Lưu giữ khi có sự cố**: `PreserveCurrentAsPending` (`0x0600021c`) đổi tên log hiện hành thành `GGTT-pending.log` trước khi ghi nhận lỗi mới.
- **Báo cáo từ xa qua Discord Webhook**:
  - `ReportErrorAsync` (`0x06000216`) và `UploadFileAsync` (`0x06000219`) gửi nội dung lỗi về kênh Discord cấu hình sẵn.
  - Áp dụng kiểm soát tần suất gửi thông minh (`GetDiscordRetryDelayAsync` 0x0600021a).
  - Tự động làm sạch dữ liệu trước khi gửi (`SanitizeMetadata` 0x0600021b) để không rò rỉ token hoặc thông tin nhạy cảm của người dùng.

---

## 6. Khuyến nghị Tái hiện Phòng sạch (Clean-Room Guidelines)

1. **Hiện đại hóa Giao diện (UI Modernization)**:
   - Có thể thay thế Windows Forms cũ bằng WPF, Avalonia UI, hoặc Flutter Desktop để có giao diện hiện đại, hỗ trợ DPI đa màn hình mượt mà hơn.
2. **Tách rời Lớp Trình duyệt bóc tách**:
   - Sử dụng thư viện kết nối trực tiếp WebSocket TikTok (như `TikTokLiveSharp` hoặc thư viện Node.js `tiktok-live-connector`) để thu thập dữ liệu quà tặng/bình luận mà không nhất thiết phải nhúng WebView2 cồng kềnh nếu streamer không có nhu cầu xem trực tiếp giao diện web trên ứng dụng.
3. **Quản lý Đơn phiên Chuẩn hóa**:
   - Sử dụng Mutex hoặc Named Pipe IPC để hỗ trợ tính năng: khi người dùng mở bản sao thứ hai, ứng dụng tự động đưa cửa sổ bản sao thứ nhất lên tiền cảnh (BringToFront) thay vì chỉ âm thầm thoát.
