# Báo cáo Tích hợp Toàn diện & Đồng bộ Liên Module (Phase 8 - Cross-Module Integration)

- **Mã báo cáo**: `25-cross-module-integration.md`
- **Phân hệ phân tích**: Toàn bộ 10 phân hệ chức năng của `GGTT.dll` (2,685 phương thức)
- **Kiến trúc hệ thống**: Event-Driven Multi-Tier Desktop Architecture (.NET Windows Forms + Chromium Edge + Win32 + Named Pipe IPC + WebSockets)
- **Mục đích**: Phân tích bản đồ tương tác toàn hệ thống, các điểm nghẽn đồng bộ (Synchronization Bottlenecks), cơ chế kiểm soát áp lực dữ liệu (Backpressure & Throttling) và chiến lược kháng lỗi (Fault Tolerance & Resilience)
- **Ngày hoàn tất**: 2026-11-11

---

## 1. Bản đồ Tương tác Toàn Hệ thống (End-to-End System Interaction Map)

Hệ sinh thái GGTT liên kết 8 tầng xử lý tạo thành một đường ống xử lý dữ liệu thời gian thực từ mạng Internet đến phần cứng máy streamer:

```
+-----------------------------------------------------------------------------------------------------------------------+
|                                        END-TO-END PIPELINE INTERACTION MAP                                            |
+-----------------------------------------------------------------------------------------------------------------------+
|                                                                                                                       |
|  [Tầng 1: Ingestion]        TikTok Live Stream (Desktop/Mobile Web via Microsoft WebView2)                            |
|                                       | (Hook script communicate_launcher / WebMessageReceived)                       |
|                                       v                                                                               |
|  [Tầng 2: Parsing]          TikTok Message Extractor (Base64 Webcast Protobuf Payload -> Gift/Comment/Like Records)   |
|                                       |                                                                               |
|                                       v                                                                               |
|  [Tầng 3: Scoring & State]  Live PK Scoring Engine (TeamPKState: Red vs Blue, Streaks, Combos, Round Countdown)       |
|                                       |                                                                               |
|                                       +-----------------------+-----------------------+                               |
|                                       |                       |                       |                               |
|                                       v                       v                       v                               |
|  [Tầng 4: Persistence]      SQLite Ledger (team.db)   Visual Scenario Engine   Hardware Automation                    |
|                             - pending_gifts (RAM)     - Condition Evaluation   - KeyboardCommands.Send                |
|                             - committed_ledger        - 32-layer Compositor    - Win32 SendInput (Scancodes)          |
|                             - gift_journal (Audit)    - Named Pipe IPC         - Minecraft RCON Bridge                |
|                                                               |                                                       |
|                                                               v                                                       |
|  [Tầng 5: AI & Tracking]                              Pose Tracking Pipeline (MediaPipe ONNX + DirectShow)            |
|                                                       - Geometric Knee Angle -> Squat Counter                         |
|                                                       - OBS WebSocket v5 (SetSceneItemTransform)                      |
|                                                               |                                                       |
|                                                               v                                                       |
|  [Tầng 6: Broadcast / Output]                         WebSocket Server (ws://localhost:3784) & Media Server (Port 6211|
|                                                       - 250ms Throttled team_state JSON Broadcast                     |
|                                                       - OBS Studio Browser Source Overlay                             |
|                                                               |                                                       |
|                                                               v                                                       |
|  [Tầng 7: Telemetry & Log]                            AppLogger (GGTT-current.log + Discord Webhook Error Reporting)  |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

## 2. Quản lý Trạng thái & Cơ chế Đồng bộ Liên Module

Do ứng dụng chạy đồng thời nhiều luồng (UI Thread, WebSocket Worker Threads, HTTP Media Server, WebView2 IPC Message Loops, DirectShow Camera Capture Threads, Named Pipe Client), việc quản lý tài nguyên chia sẻ đòi hỏi cơ chế khóa nghiêm ngặt:

### 2.1. Danh mục Các Điểm Đồng bộ Chính (Synchronization Primitives)
1. **`clientsLock` (`0x0400016e`)**:
   - Đối tượng khóa bảo vệ danh sách `clients` (`List<IWebSocketConnection>`).
   - Mọi thao tác thêm/xóa client kết nối từ OBS và vòng lặp duyệt gửi `SendTeamState` đều phải đi qua `lock (clientsLock)` để ngăn ngoại lệ `InvalidOperationException: Collection was modified`.
2. **`effectSessionGate` (`0x04000193`)**:
   - Sử dụng `SemaphoreSlim` để kiểm soát các lệnh gửi qua Named Pipe sang tiến trình hiệu ứng con.
   - Ngăn chặn việc gửi chồng chéo lệnh RPC khi một frame hiệu ứng chưa hoàn tất xử lý.
3. **`FileLock` (`0x04000115`) & `UploadLock` (`0x04000116`)**:
   - Bảo vệ tệp log `GGTT-current.log` khỏi xung đột ghi đồng thời từ nhiều Task.
   - `UploadLock` đảm bảo chỉ có tối đa một tác vụ upload log sự cố qua Discord Webhook được thực thi, tránh spam webhook gây rate limit (HTTP 429).
4. **`mediaStartLock` (`0x04000173`)**:
   - Đảm bảo việc khởi tạo và xoay vòng cổng HTTP (`6211`..`6214`) diễn ra tuần tự, tránh race condition khi Form được mở lại.

### 2.2. Kiểm soát Tốc độ & Giảm áp lực Dữ liệu (Backpressure & Throttling)
Khi streamer nhận được số lượng quà tặng khổng lồ trong các đợt "bão quà" (gift storms), nếu phát bản tin ra OBS liên tục sẽ khiến giao diện trình duyệt bị treo và mất khung hình (lag/stutter). GGTT thiết kế 3 tầng lọc tải:
1. **250ms Overlay Throttling**:
   - Trong `SendTeamState` (`0x06000311`), kiểm tra `(UtcNow - teamLastStateSent).TotalMilliseconds < 250`.
   - Nếu bản tin trước vừa gửi cách đó dưới 250ms, hệ thống gom trạng thái vào `teamStatePending` và dùng timer bất đồng bộ gửi một lần khi hết độ trễ.
2. **1,000ms PK Engine Tick**:
   - Bộ đếm thời gian ván đấu `teamTimer` chạy cố định chu kỳ 1 giây, tách biệt hoàn toàn với tần suất nhận quà từ TikTok.
3. **Giới hạn Độ sâu Ngăn xếp Hành động (`Action Queue Limit: 256`)**:
   - `ScenarioEngine` giới hạn danh sách hành động chờ tại `_pendingActions.Count >= 256`. Nếu vượt quá, hệ thống hủy các hành động cũ và kích hoạt log cảnh báo tiếng Việt: `"Quá nhiều hành động đang chờ; giảm lặp kịch bản."`

---

## 3. Khả năng Khôi phục & Kháng lỗi (Resilience & Fault Tolerance)

### 3.1. Phục hồi Mất kết nối Mạng (Network Disconnection Handling)
- **Mất kết nối TikTok Web**: Khi WebView2 bị đứt mạng hoặc phiên live kết thúc, `processingOnlineCts.Cancel()` được kích hoạt an toàn. Ứng dụng duy trì trạng thái điểm PK hiện tại trên UI và không bị crash.
- **Mất kết nối OBS WebSocket**: `ObsCameraTracker` bắt lỗi `WebSocketException`, tự động chuyển sang chế độ Standalone (không điều khiển camera) và thử kết nối lại với OBS v5 theo thuật toán Exponential Backoff.
- **Lỗi Máy chủ Minecraft RCON**: Khi lệnh console RCON timeout (`10,000ms`) hoặc máy chủ tắt, `CoreRCON` ném ngoại lệ được bắt tại `<SendCommandMinecraft>d__114`, báo lỗi lên UI mà không làm gián đoạn luồng stream chính.

### 3.2. Bảo vệ Bộ nhớ & Tránh Tràn Tài nguyên (Resource Leak Prevention)
- **Xoay vòng Tệp Log Cục bộ**: `AppLogger.TrimIfNeeded` tự động cắt ngắn tệp nhật ký khi vượt ngưỡng kích thước quy định.
- **Dọn dẹp Bộ nhớ Đệm Trình duyệt**: `CleanCache` ngắt kết nối an toàn các tiến trình con `msedgewebview2.exe` trước khi xóa dữ liệu tạm trên đĩa, loại bỏ hoàn toàn lỗi khóa tệp.
- **Bẫy Lỗi Tiến trình Toàn diện**: `RegisterGlobalErrorHandlers` chặn toàn bộ lỗi unhandled từ UI thread và Task scheduler, chuyển thành log và gửi báo cáo sự cố tự động trước khi ứng dụng kết thúc.
