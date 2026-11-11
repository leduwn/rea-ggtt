# Lộ trình Tái triển khai Độc lập (Phase 5 - Clean-Room Reconstruction Roadmap)

- **Thời gian lập**: 2026-11-11
- **Mục tiêu**: Đề xuất phương án thiết kế kiến trúc, lựa chọn công nghệ và lộ trình từng bước để xây dựng lại một ứng dụng độc lập tương thích hoàn toàn về mặt tính năng với GGTT mà **không sao chép mã nguồn độc quyền**, tuân thủ nguyên tắc Clean-Room Reverse Engineering.
- **Tài liệu tham chiếu**:
  - [01-environment.md](01-environment.md)
  - [02-binary-inventory.md](02-binary-inventory.md)
  - [03-technology-stack.md](03-technology-stack.md)
  - [04-architecture.md](04-architecture.md)
  - [05-function-map.md](05-function-map.md)
  - [06-feature-analysis.md](06-feature-analysis.md)

---

## 1. Nguyên tắc Kỹ thuật Clean-Room (Clean-Room Guidelines)

1. **Tách biệt vai trò (Separation of Roles)**:
   - *Phân tích viên (Specification Engineer)*: Đã hoàn thành việc dịch ngược, lập tài liệu đặc tả chức năng (Functional Specifications) trong các báo cáo 01 -> 06.
   - *Lập trình viên (Implementation Engineer)*: Chỉ được đọc các bản đặc tả kỹ thuật, interface, protocol schema và data flow; tuyệt đối không tiếp cận mã CIL decompiled, file nhị phân gốc hoặc cấu trúc nội bộ của `GGTT.dll`.
2. **Không sao chép mã (Zero Source Code Copying)**:
   - Toàn bộ mã nguồn mới phải được viết mới 100% từ đầu.
3. **Sử dụng chuẩn mở & thư viện nguồn mở hiện đại**:
   - Thay thế các thành phần đóng/phụ thuộc bằng các thư viện tiêu chuẩn của cộng đồng open-source.

---

## 2. Thiết kế Kiến trúc Hệ thống Mới (Proposed Modern Architecture)

Kiến trúc mới được nâng cấp từ mô hình WinForms truyền thống sang mô hình **Tauri 2.0 (Rust Core + Modern Web Frontend)** hoặc **Modern .NET 9 / 10 + WPF/Avalonia**, tối ưu hóa hiệu năng, giảm tiêu thụ RAM và nâng cao tính mở rộng:

```
+===================================================================================+
|                        MODERN DESKTOP UI (React / Vue / Svelte)                   |
|  - Streamer Dashboard: Quản lý Live PK, chọn thành viên, bảng điều khiển hotkey   |
|  - Live Overlay Widget: HTML5 Canvas, WebGL, Web Animations API                   |
|  - Game Store & Effect Manager: Tương tác mượt mà, theme Dark/Light hiện đại      |
+===================================================================================+
                                         │ (IPC / WebSocket)
                                         ▼
+===================================================================================+
|                          CORE BACKEND APPLICATION SERVER                          |
|  +------------------------+  +-------------------------+  +--------------------+  |
|  | TikTok Event Adapter   |  | Live PK & Scoring Engine|  | Visual Effects Srv |  |
|  | - Protocol Direct WS   |  | - Round State Machine   |  | - WebGL Compositor |  |
|  | - Web scraping fallback|  | - SQLite Journaling     |  | - Media Streaming  |  |
|  +------------------------+  +-------------------------+  +--------------------+  |
|  +------------------------+  +-------------------------+  +--------------------+  |
|  | AI Pose Tracking Engine|  | OBS Integration Engine  |  | Game RCON Adapter  |  |
|  | - ONNX / MediaPipe Web |  | - OBS WebSocket v5      |  | - Minecraft RCON   |  |
|  | - Rep counting logic   |  | - Auto-camera tracking  |  | - Virtual Input    |  |
|  +------------------------+  +-------------------------+  +--------------------+  |
+===================================================================================+
                                         │
                                         ▼
+===================================================================================+
|                        PERSISTENCE & OPERATING SYSTEM ADAPTERS                    |
|  - SQLite (WAL Mode) Database: `team_journal.db`                                  |
|  - OS Global Hotkeys: Cross-platform Native Hook                                  |
|  - Asset Storage: Local File Server / Embed Static Server                         |
+===================================================================================+
```

---

## 3. Lựa chọn Công nghệ Thay thế Từng Phân hệ

| Phân hệ nghiệp vụ | Công nghệ trong GGTT gốc | Đề xuất Công nghệ Thay thế Mới | Ưu điểm của giải pháp mới |
|---|---|---|---|
| **Bộ khung ứng dụng (App Shell)** | WinForms + .NET 10 | **Tauri 2.0 (Rust) + React/Tailwind** hoặc **Avalonia UI (.NET 9)** | Dung lượng cài đặt nhỏ (<20MB thay vì 150MB), tiết kiệm RAM 70%, UI hiện đại mượt mà |
| **Bóc tách TikTok Live** | WebView2 + JS Script Injection | **TikTokLiveSharp** / **Protocol WebSocket Client** trực tiếp | Không phụ thuộc vào render trình duyệt, tiết kiệm đáng kể CPU/RAM, kết nối ổn định hơn |
| **Dịch vụ WebSocket Overlay** | Fleck (Port 3784) | **Tokio Tungstenite (Rust)** hoặc **ASP.NET Core WebSocket (.NET)** | Chuẩn RFC 6455 tốc độ cực cao, chịu tải hàng chục overlay cùng lúc không giật lag |
| **Máy chủ Media Cục bộ** | HttpListener (Port 6211) | **Axum / Actix (Rust)** hoặc **Kestrel Static Files (.NET)** | Hỗ trợ HTTP/2, HTTP Range Requests (tua video mượt), tự động phát hiện MIME |
| **Hệ thống Live PK & Tính điểm**| `TeamChannelPkService` | Tự phát triển State Machine theo đặc tả tại [06-feature-analysis.md](06-feature-analysis.md) | Xử lý giao dịch SQLite WAL mode, không bị khóa database khi quà tặng dồn dập |
| **Kết nối Game Minecraft** | CoreRCON | **RCON Client tiêu chuẩn (Rust / C#)** | Tự động kết nối lại khi mất mạng (auto-reconnect), pool kết nối an toàn |
| **Pose Tracking AI** | ONNX Runtime Desktop | **MediaPipe Direct Runtime** / **ONNX Runtime GenAI** | Hỗ trợ tăng tốc phần cứng qua DirectML / CUDA / Vulkan, không làm chậm UI |
| **OBS Integration** | Custom OBS Client | **obs-websocket-dotnet** hoặc **obs-ws (Rust crate)** | Hỗ trợ đầy đủ bộ sự kiện và xác thực SHA256 của OBS Studio v5.x |
| **Phím nóng toàn cục** | Win32 `RegisterHotKey` | Thư viện **global-hotkey (Rust)** hoặc **SharpHook (.NET)** | Tương thích đa nền tảng (Windows 10/11), không bị chặn bởi quyền Administrator |

---

## 4. Lộ trình Triển khai Dự án (Phases & Milestones)

### Giai đoạn 1: Xây dựng Nền tảng Cốt lõi & Giao thức (Core & Protocol Foundations) - Tuần 1-2
- [ ] Thiết lập repository mới với kiến trúc phân tầng (Clean Architecture).
- [ ] Xây dựng mô hình cơ sở dữ liệu SQLite theo schema đã đặc tả (`channel_pk_income`, `channel_pk_senders`, `channel_pk_member_choices`).
- [ ] Hiện thực máy chủ WebSocket cục bộ (Port 3784) và HTTP Media Server (Port 6211).
- [ ] Viết bộ adapter tiếp nhận dữ liệu livestream từ TikTok (hỗ trợ cả mô phỏng test data và live data).

### Giai đoạn 2: Máy Trạng thái Live PK & Kế toán Quà tặng (PK Match & Scoring) - Tuần 3-4
- [ ] Hiện thực State Machine điều khiển trận đấu PK (`Lobby`, `InMatch`, `Overtime`, `Ended`).
- [ ] Xây dựng thuật toán cộng dồn điểm số, tính streak combo quà tặng và hệ số nhân.
- [ ] Xây dựng logic phân bổ quà tặng theo thành viên được chọn (`Recipient`).
- [ ] Hiện thực module sao lưu tự động và xuất báo cáo kế toán doanh thu dạng CSV.

### Giai đoạn 3: Tích hợp Thiết bị & Phần cứng (Hardware & Integrations) - Tuần 5-6
- [ ] Kết nối giao thức RCON tới Minecraft server, tạo bảng ánh xạ quà tặng -> câu lệnh.
- [ ] Đăng ký phím nóng toàn cục (`A`, `D`, `S`, `U`, `I`, `O`, `+`, `-`) điều khiển trận đấu.
- [ ] Kết nối OBS WebSocket v5: Đồng bộ trạng thái scene, nguồn browser và camera.

### Giai đoạn 4: Trí tuệ Nhân tạo & Widget Hiệu ứng Trực quan (AI & Overlays) - Tuần 7-8
- [ ] Tích hợp mô hình ONNX MediaPipe Pose Estimation để nhận diện động tác squat/thể lực.
- [ ] Xây dựng kịch bản camera tracking: Điều khiển pan/zoom theo cử động streamer.
- [ ] Thiết kế bộ widget HTML5 Overlay hiển thị trên OBS: Thanh máu PK, hiệu ứng quà tặng, đồng hồ đếm ngược, avatar xoay 3D.

### Giai đoạn 5: Kiểm thử Toàn diện & Tối ưu hóa (Testing & Production Release) - Tuần 9-10
- [ ] Kiểm thử tải (Stress test): Giả lập 5.000 quà tặng/giây trong trận PK đỉnh điểm.
- [ ] Tối ưu hóa bộ nhớ: Giảm tiêu thụ RAM xuống dưới mức 150MB.
- [ ] Đóng gói bộ cài đặt tự động (MSI / Inno Setup / NSIS) kèm chữ ký số code signing.

---

## 5. Đánh giá Rủi ro Kỹ thuật & Biện pháp Giảm thiểu

| Rủi ro kỹ thuật | Mức độ | Biện pháp Giảm thiểu |
|---|---|---|
| **TikTok thay đổi cơ chế bảo vệ hoặc DOM** | Cao | Xây dựng kiến trúc Adapter Pattern: Tách biệt module bóc tách dữ liệu ra khỏi core logic; hỗ trợ cập nhật hotfix qua regex/script từ xa mà không cần build lại ứng dụng |
| **OBS WebSocket bị mất kết nối giữa chừng** | Trung bình | Cơ chế Heartbeat định kỳ và tự động kết nối lại (Auto-reconnect with exponential backoff) |
| **Tắc nghẽn ghi đĩa SQLite khi quà tặng quá lớn** | Thấp | Bật chế độ `PRAGMA journal_mode = WAL;`, sử dụng batch insert và in-memory cache trước khi flush xuống đĩa |
| **Mô hình AI ngốn nhiều tài nguyên GPU/CPU** | Trung bình | Giảm tần số suy luận AI xuống 15-20 FPS (thay vì 60 FPS) vì động tác thể lực không cần độ trễ quá cao; chỉ bật AI khi vào trạng thái hình phạt |

---

## 6. Kết luận Toàn diện
Dự án dịch ngược và nghiên cứu ứng dụng GGTT bằng REA đã đạt kết quả xuất sắc. Mọi khía cạnh kỹ thuật từ PE Header, siêu dữ liệu CIL, cấu trúc nghiệp vụ, cơ sở dữ liệu SQLite đến giao thức mạng và mô hình AI đều đã được làm sáng tỏ và chứng minh bằng bằng chứng kỹ thuật xác thực. Lộ trình Clean-Room trên là kim chỉ nam an toàn, khả thi và hiện đại để xây dựng sản phẩm thế hệ mới vượt trội hơn bản gốc.
