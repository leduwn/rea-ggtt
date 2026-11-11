# Báo cáo Phân tích Chi tiết Công nghệ (Phase 2 - Technology Stack)

- **Thời gian thực hiện**: 2026-11-11
- **Target**: `C:\Program Files (x86)\GGTT\GGTT.exe` & `GGTT.dll`
- **Tài liệu tham chiếu**: `reports/02-binary-inventory.md`
- **Workspace**: `rea-ggtiktok`

---

## 1. Tổng quan Kiến trúc Ngăn xếp Công nghệ (Technology Stack Overview)

GGTT ("Google Tiktok / TikTok Interactive Tool") là một nền tảng desktop chuyên dụng cho streamer TikTok Live Interactive (Live PK, mini-game tương tác quà tặng, điều khiển game và hiệu ứng thị giác). Ứng dụng được xây dựng trên mô hình kết hợp (Hybrid Architecture):
- **Core Engine**: C# / .NET 10.0 (Windows Desktop runtime).
- **Web UI & Embedded Scraping**: Chromium Engine qua `Microsoft.Web.WebView2`.
- **Local IPC & Networking**: WebSocket Server (`Fleck`), HTTP File Server, OBS WebSocket v5, RCON Minecraft (`CoreRCON`).
- **AI / Computer Vision**: ONNX Runtime tích hợp mô hình MediaPipe Pose Tracking phục vụ mini-game "phạt" thể lực hoặc né vật phẩm.
- **Hardware Interop**: Win32 P/Invoke (`SendInput`, `RegisterHotKey`, Named Pipes).

```
+-----------------------------------------------------------------------------------+
|                           STREAMER / USER INTERFACE                               |
|   +-------------------------------------+   +---------------------------------+   |
|   |   WinForms Native GUI Shell         |   |   WebView2 Embedded Chromium    |   |
|   |   (Google_Tiktok_Form, Setting)     |   |   (TikTok Live View, Game Store)|   |
|   +-------------------------------------+   +---------------------------------+   |
+-----------------------------------------------------------------------------------+
|                                 CORE SERVICES                                     |
|   +---------------------+  +----------------------+  +------------------------+   |
|   | TeamChannelPkService|  |    EffectsBridge     |  |  ObsTrackingClient     |   |
|   | - Team Gifts & Combo|  | - ScenarioEngine     |  | - MediaPipe ONNX Pose  |   |
|   | - Round Timing & PK |  | - ChromaKey & Layers |  | - OBS WebSocket v5     |   |
|   | - GiftJournal DB    |  | - Live2D / Moc3      |  | - Punishment Tracking  |   |
|   +---------------------+  +----------------------+  +------------------------+   |
+-----------------------------------------------------------------------------------+
|                          NETWORK & PROTOCOL ADAPTERS                              |
|   +--------------------+  +----------------------+  +-------------------------+   |
|   | Fleck WebSocket Srv|  |  Local Media Server  |  | CoreRCON Minecraft Srv  |   |
|   | (Port 3784 / Live) |  |  (Port 6211 / Assets)|  | (Game Interactive Cmds) |   |
|   +--------------------+  +----------------------+  +-------------------------+   |
+-----------------------------------------------------------------------------------+
|                           NATIVE INTEROP & SECURITY                               |
|   +--------------------+  +----------------------+  +-------------------------+   |
|   | Win32 P/Invoke     |  | SQLite Native DB     |  | EffectProcessTrust      |   |
|   | (SendInput, Hotkey)|  | (winsqlite3.dll)     |  | (SHA-256 Manifest Auth) |   |
|   +--------------------+  +----------------------+  +-------------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Chi tiết Từng Tầng Công nghệ

### 2.1. Tầng 1: Native Bootloader & .NET CLR Runtime
- **Entry Binary**: `GGTT.exe` (175 KB, AMD64 PE32+).
- **Cơ chế nạp**: Hoạt động như một AppHost tự định tuyến của .NET Core. Tự động tìm kiếm thư viện `hostfxr.dll` hoặc phiên bản CLR tương thích trên hệ điều hành dựa vào `GGTT.runtimeconfig.json`.
- **Target Framework**: `.NETCoreApp,Version=v10.0` kết hợp `Microsoft.WindowsDesktop.App`.
- **Quản lý bộ nhớ & An toàn**: Tự động giải phóng qua Garbage Collector hiện đại của .NET; chặn hoàn toàn các cơ chế tuần tự hóa rủi ro như `BinaryFormatter`.

### 2.2. Tầng 2: Giao diện Người dùng & WebView2
- **Thành phần chính**:
  - `GGTT.Google_Tiktok_Form` (Token: `0x0200004c`): Form điều khiển trung tâm với 123 fields và 153 methods.
  - `GGTT.Google_Tiktok_Setting` (Token: `0x0200004d`): Form cấu hình tham số mạng, phím tắt, kênh TikTok.
  - `GGTT.Team.TeamManagerForm` (Token: `0x020000a6`): Bảng quản lý đội ngũ PK, gán quà tặng, thiết lập tỷ số.
- **Trình duyệt nhúng WebView2**:
  - Quản lý qua các hàm `InitBrowser_TT`, `InitBrowser`, `SpawnWebViewTikTokMobile`.
  - Tách biệt hai profile duyệt: Desktop Web (`z0-new-schema-webview-tiktok.php`) và Mobile Web (`z-new-schema-webview-tiktok-mobile.php`).
  - Sử dụng cơ chế tái khởi tạo tự động (`InitializeWebViewWithRetryAndFallbackAsync`, `RecreateWebViewTikTok`) khi gặp sự cố bộ nhớ hoặc crash render process.

### 2.3. Tầng 3: Tương tác Mạng & Truyền phát Trực tiếp (Networking & Protocols)
- **Fleck WebSocket Server**:
  - Cổng mặc định: `3784` (loopback / local network).
  - Khởi động bởi `StartWebSocketServer` (`<StartWebSocketServer>d__69`).
  - Giao thức định dạng JSON: Truyền phát tức thời các sự kiện quà tặng (`giftId`, `coin`, `donors`, `combo`), bình luận live và trạng thái trò chơi cho overlay hiển thị trên phần mềm OBS Studio.
- **Local HTTP Media Server**:
  - Cổng: `6211` (`http://localhost:6211/`).
  - Quản lý qua `LocalAiFileServer`, `StartMediaServerCore`.
  - Hỗ trợ phân phát cục bộ các tài nguyên đa phương tiện dung lượng lớn: Video (`.mp4`, `.webm`, `.mov`), Âm thanh (`.mp3`, `.wav`, `.ogg`, `.m4a`), Hình ảnh (`.png`, `.gif`, `.webp`), Mô hình Live2D (`.moc3`, `.atlas`).
- **CoreRCON Protocol**:
  - Tích hợp thư viện `CoreRCON` kết nối với Minecraft Server.
  - Xử lý qua `connect_minecraft_server` và `SendCommandMinecraft` (`<SendCommandMinecraft>d__114`).
  - Tác dụng: Cho phép người xem tặng quà TikTok để kích hoạt lệnh trong game (ví dụ: thả quái vật, cho đồ, kích nổ TNT, tạo hiệu ứng thời tiết).

### 2.4. Tầng 4: Hệ thống Live Tương tác & Team PK (`GGTT.Team.*`)
Hệ sinh thái logic phong phú nhất của GGTT gồm 34 lớp trong namespace `GGTT.Team`:
- **Quản lý Trận đấu (PK Match)**:
  - `TeamChannelPkService`: Quản lý vòng đấu (`RoundId`, `RoundEndsAt`, `RoundSecondsLeft`, `RoundGraceSeconds`).
  - `TeamScoringService`: Tính toán điểm số theo thời gian thực dựa trên quà tặng và hệ số nhân combo.
  - `TeamShift` & `TeamCombo`: Ghi nhận các đợt tặng quà dồn dập (streak) từ người hâm mộ của từng đội.
- **Lưu trữ & Truy xuất Dữ liệu**:
  - `TeamGiftJournalService` & `TeamDatabase`: Ghi nhật ký từng giao dịch quà tặng và điểm số vào SQLite để đối soát và xếp hạng (`TeamJournalPage`).
- **Phản chiếu Overlay**:
  - `TeamOverlayRelay` & `TeamOverlayView`: Đồng bộ hóa trạng thái giao diện PK lên widget trình duyệt với canvas động (`CanvasWidth`, `CanvasHeight`, `GiftClockX`, `GiftClockY`).

### 2.5. Tầng 5: Thị giác Máy tính & Nhận diện Tư thế AI (`GGTT.Tracking.*`)
- **Mô hình AI**:
  - `person_detection_mediapipe_2023mar.onnx`: Phát hiện sự hiện diện của streamer trước camera.
  - `pose_estimation_mediapipe_2023mar.onnx`: Trích xuất 33 điểm mốc khớp xương (landmarks: vai, khuỷu tay, cổ tay, đầu gối, v.v.).
- **Engine Suy luận**:
  - `Microsoft.ML.OnnxRuntime`: Tối ưu hóa tính toán qua DirectML hoặc CPU đa luồng.
  - `TrackingInference`, `TrackingGeometry`: Tính toán góc uốn của khớp, phân chia làn đường (`laneLeft`, `laneRight`).
- **Dịch vụ Ứng dụng**:
  - `PunishmentTrackingService`: "Punishment Tracking" — Theo dõi tự động bài tập thể lực của streamer (ví dụ: squat, hít đất, nhảy dây) khi đội của họ thua trong trận PK TikTok Live.
  - `ObsTrackingClient`: Kết nối OBS WebSocket v5 (`op`, `d`, `requestType`, `sceneItemTransform`) để tự động di chuyển hoặc phóng to/thu nhỏ camera của streamer theo chuyển động cơ thể.

### 2.6. Tầng 6: Engine Hiệu ứng Thị giác & Hoạt họa (`GGTT.EffectsBridge.*`)
- **Quản lý Hiệu ứng**:
  - `LocalEffectLibrary`: Quản lý kho hiệu ứng trên ổ đĩa.
  - `EffectManifest`: Định dạng mô tả cấu trúc hiệu ứng (các layer video, audio, text, chroma key).
- **Kỹ xảo & Compositing**:
  - `LayerChromaKey`: Tách nền xanh của video hiệu ứng trực tiếp.
  - `FaceReaction`: Gắn hiệu ứng biểu cảm lên khuôn mặt streamer.
  - `ScenarioEngine` / `IScenarioWorld`: Xử lý kịch bản tương tác có điều kiện (`ScenarioCondition`, `ScenarioAction`, `ScenarioRandomChoice`).

### 2.7. Tầng 7: Giao tiếp Native (Win32 P/Invoke) & Phần cứng
- **Thao tác Chuột & Bàn phím Ảo**:
  - `user32.dll` -> `SendInput`: Mô phỏng phím bấm và di chuyển chuột (`Input`, `InputUnion`, `MouseInput`, `KeyboardInput`, `HardwareInput`, `DirectXKeyStrokes`). Dùng để điều khiển các tựa game không hỗ trợ RCON (ví dụ: game giả lập Android, GTA, v.v.).
- **Hotkey Toàn cục (Global Hotkeys)**:
  - `user32.dll` -> `RegisterHotKey`, `UnregisterHotKey`: Cho phép streamer bấm phím nóng vật lý để cộng điểm, dừng hiệu ứng (`A`, `D`, `S`, `U`, `I`, `O`, `Oemplus`, `OemMinus`).
- **IPC & Database Cấp thấp**:
  - `kernel32.dll` / `ntdll.dll`: Đọc thông tin tiến trình (`NtQueryInformationProcess`), đường ống Named Pipe.
  - `winsqlite3.dll`: Tương tác cơ sở dữ liệu tốc độ cao.

### 2.8. Tầng 8: An ninh, Xác thực & Chống Can thiệp (Anti-Tamper)
- **Giới hạn Miền (Domain Whitelisting)**:
  - Bắt buộc các kết nối nhúng và tải dữ liệu phải qua giao thức HTTPS thuộc miền `jqsvn.com` hoặc `tiktok.com`.
- **Phòng thủ Path Traversal**:
  - Lớp `DesktopSafety` và `SafePaths` kiểm tra nghiêm ngặt đường dẫn tệp: Chặn ký tự `..`, chặn tên thiết bị DOS cổ điển (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`), từ chối symlink và junction point.
- **Xác thực Toàn vẹn Module**:
  - `EffectProcessTrust`: Đối chiếu hash SHA-256 các file thực thi với bảng kê có chữ ký số `effects-trust.json`.

---

## 3. Ma trận Đánh giá Độc lập (Clean-Room Feasibility Matrix)

| Thành phần chức năng | Công nghệ gốc của GGTT | Đánh giá độ phụ thuộc | Giải pháp Thay thế Độc lập (Clean-Room) |
|---|---|---|---|
| **Bộ nạp chương trình** | C# .NET 10 AppHost | Thấp (Mẫu chuẩn Microsoft) | Viết bằng C# .NET 8/9 tiêu chuẩn hoặc Tauri / Rust / Go |
| **Giao diện điều khiển** | WinForms (`Google_Tiktok_Form`) | Trung bình (Form truyền thống) | React / Vue / Svelte trên Tauri hoặc Electron hiện đại |
| **Bóc tách Livestream** | WebView2 + JS Script Injection | Trung bình (Tùy thuộc DOM TikTok) | Sử dụng thư viện `TikTokLiveSharp` hoặc WebSocket TikTok Protocol trực tiếp (không cần nhúng trình duyệt) |
| **Live PK & Tính điểm** | `TeamChannelPkService` (Custom) | Thấp (Hoàn toàn tái hiện được) | Viết lại logic máy trạng thái (State Machine) tính điểm & timer |
| **WebSocket Overlay** | `Fleck` (RFC 6455) | Cực thấp (Giao thức mở) | Sử dụng thư viện WebSocket chuẩn (`ws`, `FastEndpoints`, `Socket.IO`) |
| **Điều khiển Game** | `CoreRCON` (Minecraft) & `SendInput` | Thấp (Chuẩn mở) | Tái sử dụng giao thức RCON chuẩn và input virtualizer |
| **Pose Tracking AI** | ONNX Runtime + MediaPipe Models | Thấp (Mô hình công khai) | Tích hợp MediaPipe trực tiếp qua ONNX Runtime hoặc OpenCV / MediaPipe Python / WebAssembly |

---

## 4. Kết luận Phase 2
Ngăn xếp công nghệ của GGTT được thiết kế hoàn chỉnh, kết hợp nhuần nhuyễn giữa .NET desktop truyền thống, trình duyệt nhúng Chromium và các thư viện mã nguồn mở chuyên dụng. Toàn bộ kiến trúc và công nghệ đã được xác thực qua Evidence cụ thể, tạo tiền đề vững chắc cho Phase 3 (Deep Function Analysis) và Phase 4 (Business Logic Reconstruction).
