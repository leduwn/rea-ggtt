# Báo cáo Kiến trúc Toàn diện GGTT (Phase 3 - Architecture Map)

- **Thời gian thực hiện**: 2026-11-11
- **Target**: `C:\Program Files (x86)\GGTT\GGTT.exe` & `GGTT.dll`
- **MVID**: `298ab416-d58b-4c6d-8e4a-91f20ef739a1`
- **Tài liệu tham chiếu**: [02-binary-inventory.md](02-binary-inventory.md), [03-technology-stack.md](03-technology-stack.md)
- **Workspace**: `rea-ggtiktok`
- **Evidence IDs**: `ev_8488ecc4707bed63aa276670d6e19167313ef60ab6719a2d020b6c3fab54febb`, `ev_7ef9de329f52e1a75cfe2ae7cb519622d980a8df6f6242ffd797558f0b285a85`, `ev_e28a2299770fc8a9da76e9eb9a9faa7bf46332de804eb833ee86ced5cb7824de`

---

## 1. Mô hình Kiến trúc Phân tầng Tổng thể (Architectural Hierarchy)

GGTT ("Google Tiktok / TikTok Interactive Tool") được thiết kế theo mô hình kiến trúc phân tầng dạng lai (Hybrid Multi-Tier Architecture), kết hợp giữa luồng điều khiển WinForms cổ điển, môi trường render Chromium nhúng (WebView2) và hệ thống dịch vụ thời gian thực (Micro-services cục bộ) chạy ngầm:

```
+===================================================================================+
|                                TẦNG TRÌNH DIỄN (UI & WEB SHELL)                   |
|  +-------------------------------------+   +------------------------------------+ |
|  | WinForms Host (STA Thread)          |   | WebView2 Embedded Chromium Engine  | |
|  | - Google_Tiktok_Form (0x0200004c)   |   | - Desktop: z0-new-schema-...       | |
|  | - Google_Tiktok_Setting (0x0200004d)|   | - Mobile: z-new-schema-...         | |
|  | - TeamManagerForm (0x020000a6)      |   | - Game Store & Effects Webview     | |
|  +-------------------------------------+   +------------------------------------+ |
+===================================================================================+
                                         │ (PostWebMessage / SafeExecuteScriptAsync)
                                         ▼
+===================================================================================+
|                                TẦNG ĐIỀU PHỐI NGHIỆP VỤ (BUSINESS LOGIC)          |
|  +------------------------+  +-------------------------+  +--------------------+  |
|  | Live PK & Team Engine  |  | Visual Effects Engine   |  | Computer Vision AI |  |
|  | - TeamChannelPkService |  | - ScenarioEngine        |  | - PunishmentService|  |
|  | - TeamScoringService   |  | - LayerChromaKey        |  | - ObsTrackingClient|  |
|  | - TeamGiftJournal      |  | - Live2D / Moc3 Parser  |  | - MediaPipe ONNX   |  |
|  +------------------------+  +-------------------------+  +--------------------+  |
+===================================================================================+
                                         │
                                         ▼
+===================================================================================+
|                                TẦNG MẠNG & IPC THỜI GIAN THỰC                     |
|  +-----------------------+  +------------------------+  +-----------------------+ |
|  | Fleck WebSocket Srv   |  | Local HTTP Media Srv   |  | CoreRCON Minecraft    | |
|  | - Port 3784 (JSON)    |  | - Port 6211 (Assets)   |  | - RCON Port / Telnet  | |
|  +-----------------------+  +------------------------+  +-----------------------+ |
+===================================================================================+
                                         │
                                         ▼
+===================================================================================+
|                                TẦNG DỮ LIỆU & NATIVE BOUNDARIES                   |
|  +-----------------------+  +------------------------+  +-----------------------+ |
|  | SQLite Storage Engine |  | Win32 Hardware Inputs  |  | Security & Trust Gating| |
|  | - team.db (Journal)   |  | - user32.dll SendInput |  | - EffectProcessTrust  | |
|  | - winsqlite3.dll / CIL|  | - RegisterHotKey       |  | - SHA-256 Manifest    | |
|  +-----------------------+  +------------------------+  +-----------------------+ |
+===================================================================================+
```

---

## 2. Phân tích Chi tiết Từng Tầng

### 2.1. Tầng Trình diễn (UI & Presentation Layer)
- **Cơ chế luồng**: Ứng dụng chạy trên luồng Single Thread Apartment (STA Thread) của Windows Forms.
- **Form điều khiển chính**: `GGTT.Google_Tiktok_Form` (Token: `0x0200004c`). Chứa toàn bộ các control điều hướng, panel trạng thái CPU/bộ nhớ (`% Processor Time`), và trình nạp WebView2.
- **Cầu nối WebView2 (`Microsoft.Web.WebView2`)**:
  - Giao tiếp hai chiều giữa C# và JavaScript:
    - **C# -> JS**: Gọi qua `SafeExecuteScriptAsync` và `CoreWebView2.ExecuteScriptAsync`. Chèn đoạn mã `window.__ggttEmbeddedCode` để hook DOM sự kiện livestream.
    - **JS -> C#**: Bắt sự kiện qua `WebMessageReceived` (`webView21_WebMessageReceived_1`, `webView21ReceiveMessageFormSetting`, `webView23ReceiveMessageFormSetting`).
  - Giao diện phụ: `Google_Tiktok_Setting` (cấu hình mạng, hotkey, tài khoản), `TeamManagerForm` (quản lý phân bổ thành viên Live PK, chọn ảnh đại diện `PickTeamAvatar`, xuất báo cáo `ExportTeamReport`).

### 2.2. Tầng Nghiệp vụ Trọng tâm (Core Business Logic)
Hệ thống logic được tổ chức thành 3 phân hệ độc lập:
1. **Phân hệ Live PK & Team Battle (`GGTT.Team.*`)**:
   - `TeamChannelPkService` (Token: `0x020000a0`): Máy trạng thái kiểm soát vòng đấu PK (`InMatch`, `RoundEndsAt`).
   - `TeamScoringService`: Xử lý công thức cộng dồn điểm số xu quà (`giftCoins`) và hệ số nhân combo (`TeamCombo`).
   - `TeamOverlayRelay`: Chuyển đổi trạng thái dữ liệu phòng đấu thành cấu trúc JSON trực quan và phân phát đến overlay OBS.
2. **Phân hệ Hiệu ứng Kịch bản (`GGTT.EffectsBridge.Effects.*`)**:
   - `ScenarioEngine`: Thực thi mô hình State Machine theo kịch bản tương tác động. Hỗ trợ các luật trigger: `time`, `collision`, `random`, `once`, `repeat`, `set_state`, `cancel_pending`.
   - `LayerChromaKey`: Xử lý thuật toán tách màu nền (Green Screen / Blue Screen) theo thời gian thực trên video hiệu ứng MP4/WebM.
3. **Phân hệ Trí tuệ Nhân tạo & Camera (`GGTT.Tracking.*`)**:
   - `PunishmentTrackingService`: Tự động nhận diện tư thế của streamer qua webcam để đếm số lần hoàn thành hình phạt (squat, hít đất) khi thua cuộc trong trận PK.
   - `ObsTrackingClient`: Kết nối qua OBS WebSocket v5 để điều khiển chuyển động của Camera (`sceneItemTransform`) bám theo tọa độ người trước ống kính.

### 2.3. Tầng Mạng, IPC & Truyền phát Trực tiếp
- **Local WebSocket Server (`Fleck`)**:
  - Địa chỉ: `ws://127.0.0.1:3784`.
  - Khởi động bất đồng bộ: `StartWebSocketServer` / `StartWebSocketServerCore`.
  - Định dạng gói tin: JSON bao gồm các trường `type`, `msg`, `giftId`, `coin`, `combo`, `team_state`.
- **Local Media Server**:
  - Địa chỉ: `http://localhost:6211/`.
  - Cung cấp HTTP GET streaming cho các định dạng media: `.mp4`, `.webm`, `.mov`, `.mp3`, `.wav`, `.ogg`, `.png`, `.webp`, `.moc3`, `.atlas`.
  - Xử lý MIME Type chính xác qua `GetMimeType` (`video/mp4`, `audio/mpeg`, `application/json`, v.v.).
- **Minecraft Game Protocol (`CoreRCON`)**:
  - Kết nối trực tiếp đến Minecraft Server qua giao thức RCON.
  - Hàm thực thi: `SendCommandMinecraft`. Ánh xạ quà tặng TikTok thành các lệnh console game (ví dụ: `/summon tnt`, `/give @p diamond`).

### 2.4. Tầng Dữ liệu & Lưu trữ Bền vững (Data Access Layer)
- **SQLite Engine**:
  - Tệp cơ sở dữ liệu chính: `team.db`.
  - Bảng dữ liệu: `channel_pk_income`, `channel_pk_state`, `channel_pk_history`, `channel_pk_senders`, `channel_pk_member_choices`.
  - Bảng tạm và View phục vụ tính toán thời gian thực: `pending_channel_pk_income`, `live_channel_pk_income`.
  - Cơ chế sao lưu/khôi phục tự động: Sinh file `GGTT-Team-yyyyMMdd-HHmmss.db` và `before-restore-*` trước khi thực hiện restore.
  - Xuất báo cáo kế toán/đối soát: `GGTT-Team-bao-cao.csv` chứa thông tin phân bổ quà tặng theo từng thành viên.

### 2.5. Tầng Giao tiếp Native & An ninh (Native Boundaries & Trust)
- **Win32 P/Invoke**:
  - Thao tác giả lập bàn phím/chuột: `user32.dll!SendInput` qua struct `InputUnion`.
  - Đăng ký phím nóng toàn cục: `user32.dll!RegisterHotKey` bắt các phím `A`, `D`, `S`, `U`, `I`, `O`, `+`, `-`.
  - IPC bảo mật: `kernel32.dll!GetNamedPipeClientProcessId`, `kernel32.dll!GetNamedPipeServerProcessId`.
  - Kiểm tra tiến trình: `ntdll.dll!NtQueryInformationProcess`, `kernel32.dll!QueryFullProcessImageName`.
- **Cơ chế Chống Can thiệp (Anti-Tamper & Trust Verification)**:
  - Khởi tạo tại `EffectProcessTrust`.
  - Đọc và thẩm định chữ ký điện tử của tệp `effects-trust.json` đối chiếu với chuỗi khóa công khai RSA/Ed25519 nhúng trực tiếp trong CIL.
  - Kiểm tra SHA-256 của từng file nhị phân thành phần (`GGTT.exe`, `GGTT-Effects-Player-Setup.exe`, v.v.). Nếu không trùng khớp, hệ thống từ chối nạp hiệu ứng.

---

## 3. Luồng Dữ liệu Tổng thể (End-to-End Data Flow)

```
[TikTok Live Stream]
       │
       ▼ (Chromium Render Engine)
[WebView2 Mobile/Desktop View]
       │
       ▼ (window.__ggttEmbeddedCode hook)
[WebMessageReceived: JSON Gift/Chat]
       │
       ▼ (Google_Tiktok_Form dispatcher)
       ├───────────────────────────────┬───────────────────────────────┐
       ▼                               ▼                               ▼
[TeamChannelPkService]      [Fleck WebSocket Server]       [CoreRCON Client]
  - Tính điểm PK & Combo      - ws://127.0.0.1:3784          - Lệnh Minecraft
  - Ghi vào SQLite team.db    - Phát dữ liệu cho OBS          - Thả vật phẩm/quái
       │                      - Cập nhật Widget Overlay                │
       ▼                                                               ▼
[PunishmentTrackingService]                                   [Minecraft Server]
  - ONNX MediaPipe Pose AI
  - Đếm squat/thể lực streamer
  - Điều khiển camera OBS v5
```

---

## 4. Kết luận Kiến trúc
Kiến trúc GGTT là một mô hình tích hợp đồng bộ cao, giải quyết triệt để bài toán độ trễ trong livestream tương tác bằng cách chia nhỏ các tác vụ: tách riêng luồng render UI, luồng tính toán điểm số SQLite, luồng AI pose tracking và luồng phát tán WebSocket cục bộ. Mọi thành phần đều có thể được tái triển khai độc lập theo nguyên lý Clean-Room.
