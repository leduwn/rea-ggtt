# Kế hoạch Quan sát Thực thi Động trong Môi trường Kiểm soát (Controlled Runtime Observation Plan)

- **Mã tài liệu**: `30-controlled-runtime-test-plan.md`
- **Phiên bản kế hoạch**: `1.0.0-CONTROLLED-SPEC`
- **Mục tiêu quan sát**: `GGTT.exe` (SHA-256: `a56efabe710a75d12df8c2aacd16870e6bdde371e8f43f22873cad1c2db7d94b`) & `GGTT.dll` (SHA-256: `6ee719dd26a248e6295429e523c2220b8e87a4a98168ea0626174aa1fb0ef6b5`)
- **Đường dẫn mục tiêu**: `C:\Program Files (x86)\GGTT\GGTT.exe`
- **Nguyên tắc cốt lõi**: Phòng sạch (Clean-Room), Cách ly mạng tuyệt đối (Zero Egress), Không can thiệp mã nhị phân (Strictly Non-Invasive)
- **Trạng thái thực thi hiện tại**: **BLOCKED_PENDING_AUTHORIZATION** (Hoàn tất lập kế hoạch tĩnh; đóng băng thực thi chờ phê duyệt)
- **Ngày lập**: 2026-11-11

---

## 1. Giới thiệu & Cam kết Phòng sạch (Clean-Room Policy & Principles)

Tài liệu này xác lập quy trình kiểm thử và quan sát động học có kiểm soát đối với phần mềm GGTT trên nền tảng máy ảo/hộp cát Windows cô lập. Mục đích duy nhất của kế hoạch là thu thập các thông số hành vi động học ở cấp độ hệ thống (System-Level Behavior Metrics) để đối chiếu và chuẩn hóa tài liệu đặc tả chức năng phòng sạch (Clean-Room Specification).

### 1.1. Các Ràng buộc Nguyên tắc Bắt buộc (Mandatory Constraints)
1. **Tuyệt đối không can thiệp mã nhị phân (NO Patching / NO Byte Flipping)**:
   - Nghiêm cấm mọi hành vi sửa đổi tệp PE, can thiệp bộ nhớ runtime, sửa đổi mã IL/CIL hoặc vô hiệu hóa các cơ chế tự bảo vệ của phần mềm gốc.
2. **Tuyệt đối không bẻ khóa hoặc vượt cơ chế bản quyền (NO License Bypass / NO DRM Circumvention)**:
   - Nghiêm cấm việc crack, can thiệp thuật toán RSA trong `effects-trust.json`, hoặc giả mạo phản hồi máy chủ để chiếm quyền sử dụng trái phép các tính năng trả phí.
3. **Không tạo lưu lượng mạng ra ngoài (Zero Internet Egress)**:
   - Không được phép để lộ bất kỳ gói tin nào ra mạng Internet công cộng hoặc kết nối tới các tên miền ngoại vi thật (`jqsvn.com`, `tiktok.com`, `discord.com`, `byteoversea.com`).
4. **Không sử dụng dữ liệu thực tế (Zero Real Credentials)**:
   - Không sử dụng tài khoản TikTok thật, webhook Discord của tác giả, token phiên thật hay bất kỳ dữ liệu định danh người dùng nào trong quá trình quan sát.

---

## 2. Đặc tả Kỹ thuật Môi trường Hộp cát Cô lập (VM / Sandbox Specification)

Nhằm đảm bảo an toàn tuyệt đối và khả năng phục hồi nguyên trạng sau mỗi kịch bản, môi trường kiểm thử được thiết lập theo đặc tả kỹ thuật sau:

```
+========================================================================================+
|                        ISOLATED OBSERVATION ENVIRONMENT (WINDOWS VM)                   |
|                                                                                        |
|  [Hạ tầng Mạng Cô lập]                                                                 |
|  - Host-Only Adapter hoặc Loopback Adapter (Microsoft KM-TEST)                         |
|  - Cổng mặc định (Default Gateway): ĐỂ TRỐNG (Unset / 0.0.0.0)                         |
|  - DNS Sinkhole Cục bộ: Trỏ jqsvn.com, tiktok.com, discord.com -> 127.0.0.1            |
|  - Windows Firewall Outbound Rule: BLOCK ALL TCP/UDP (Trừ 127.0.0.1:3784 & 6211-6214)   |
|                                                                                        |
|  [Cấu hình Hệ điều hành & Người dùng]                                                  |
|  - Hệ điều hành: Windows 11 Enterprise x64 (Sandbox / Workstation Snapshot)            |
|  - Tài khoản người dùng: Non-Production Profile (User: "LabAuditor", Không có quyền AD)  |
|  - Thư mục dữ liệu: Giả lập đường dẫn %AppData%\Local và %ProgramFiles(x86)%           |
|                                                                                        |
|  [Quản lý Trạng thái & Khôi phục]                                                      |
|  - Snapshot Gốc (Clean Baseline Snapshot): Lưu sau khi cài đặt OS + .NET 10 Runtime     |
|  - Snapshot Per-Scenario: Revert về Baseline trước khi chuyển sang kịch bản tiếp theo  |
+========================================================================================+
```

### 2.1. Cấu hình Mạng Cách ly (Network Isolation Specification)
- **Kiểu Adapter**: Host-Only Network hoặc Custom Internal Virtual Switch không gắn card vật lý.
- **Bảng định tuyến (Routing Table)**:
  - Xóa bỏ tuyến đường mặc định: `route delete 0.0.0.0`.
  - Chỉ cho phép dải loopback: `127.0.0.1/32` và broadcast nội bộ `127.255.255.255`.
- **Tệp phân giải tên miền giả lập (`%SystemRoot%\System32\drivers\etc\hosts`)**:
  ```text
  127.0.0.1 jqsvn.com
  127.0.0.1 api.tiktok.com
  127.0.0.1 webstream.tiktok.com
  127.0.0.1 discord.com
  127.0.0.1 discordapp.com
  ```
- **Quy tắc Tường lửa Windows (Windows Advanced Firewall)**:
  - `Outbound Rules`: Mặc định Chặn tất cả (`Block all outbound connections`).
  - `Inbound Rules`: Mặc định Chặn tất cả (`Block all inbound connections`).
  - `Chỉ cho phép ngoại lệ cục bộ`: Cho phép tiến trình `GGTT.exe` và `msedgewebview2.exe` mở socket lắng nghe và kết nối nội bộ tới `127.0.0.1` trên các cổng `3784` và `6211..6214`.

### 2.2. Hồ sơ Người dùng Không Thực (Non-Production Windows Profile)
- Tên tài khoản: `LabAuditor` (Local Administrator hoặc Standard User độc lập).
- Không cấu hình thông tin định danh cá nhân, email, tài khoản Microsoft, ví điện tử hay token phiên.
- Thư mục làm việc của ứng dụng được đặt tại đúng vị trí mặc định để kiểm tra tương thích:
  - Thư mục cài đặt: `C:\Program Files (x86)\GGTT\`
  - Thư mục dữ liệu: `C:\Users\LabAuditor\AppData\Local\GGTT\`
  - Thư mục chuyển vùng: `C:\Users\LabAuditor\AppData\Roaming\GGTT\`

### 2.3. Quy trình Quản lý Snapshot & Revert (Snapshot Rollback Lifecycle)
1. **Base Snapshot (`SNAP_00_BASELINE`)**: Hệ thống cài mới, .NET Desktop Runtime 10.0, bộ công cụ Sysinternals, Wireshark, Fiddler, tệp nhị phân gốc `GGTT` đã sao chép vào `Program Files (x86)`.
2. **Pre-Scenario Snapshot**: Được chụp trước khi thực thi từng trường hợp kiểm thử cụ thể (TC-DYN-01 đến TC-DYN-09).
3. **Post-Scenario Rollback**: Ngay khi hoàn tất thu thập dữ liệu quan sát của trường hợp kiểm thử, máy ảo lập tức được tắt và Revert về `SNAP_00_BASELINE` để ngăn ngừa rò rỉ dữ liệu hoặc sai lệch trạng thái giữa các bài test.

---

## 3. Thiết lập Bộ Công cụ Giám sát Đo lường (Observation Instrumentation)

Để thu thập đầy đủ hành vi thực thi động mà không cần gắn debugger can thiệp luồng mã, nhóm kiểm thử sử dụng bộ công cụ giám sát thụ động (Passive Monitoring Instrumentation):

### 3.1. Sysinternals Process Monitor (ProcMon)
Cấu hình bộ lọc (ProcMon Filter Rules) chuẩn hóa để loại bỏ nhiễu từ các dịch vụ nền của Windows:

| Thuộc tính (Column) | Quan hệ (Relation) | Giá trị Lọc (Filter Value) | Hành động (Action) | Mục đích |
|---|---|---|---|---|
| `Process Name` | is | `GGTT.exe` | **Include** | Theo dõi tiến trình chủ quản .NET |
| `Process Name` | is | `msedgewebview2.exe` | **Include** | Theo dõi tiến trình con Chromium Edge |
| `Process Name` | begins with | `GGTT.` | **Include** | Theo dõi các tiến trình phụ trợ hoặc helper |
| `Path` | contains | `AppData\Local\GGTT` | **Include** | Bắt toàn bộ hoạt động tệp tin dữ liệu cục bộ |
| `Path` | contains | `HKCU\Software` | **Include** | Bắt các truy xuất Registry người dùng |
| `Operation` | is | `TCP Connect` / `TCP Accept` | **Include** | Bắt các sự kiện liên kết socket và handshake |
| `Operation` | is | `Process Create` / `Process Exit` | **Include** | Bắt vòng đời các tiến trình con |
| `Process Name` | is | `System` / `svchost.exe` | **Exclude** | Lọc bỏ tiến trình nền của hệ điều hành |

### 3.2. Sysinternals Process Explorer & Task Manager
- Cấu hình theo dõi cây tiến trình (Process Tree Hierarchy): `explorer.exe` -> `GGTT.exe` -> `msedgewebview2.exe`.
- Theo dõi các đối tượng Handle (Handles View):
  - Mutex: Tìm kiếm Mutant handle `\BaseNamedObjects\ggtt_mutex`.
  - Named Pipes: Theo dõi các pipe dạng `\\.\pipe\GGTT.Studio.Launch.*`.
  - File Locks: Theo dõi handles đang mở trên `team.db`, `team.db-wal`, `app.log`.
- Theo dõi chỉ số tài nguyên:
  - Private Bytes, Working Set, Committed Memory (MB).
  - % Processor Time (Chia theo User Time và Kernel Time).
  - .NET CLR Memory (Gen 0, Gen 1, Gen 2 Collections, LOH size).

### 3.3. Giám sát Giao thức Mạng Cục bộ (Local Loopback Packet Inspection)
- **Wireshark**:
  - Giao diện bắt gói: `Npcap Loopback Adapter` hoặc `Adapter for loopback traffic capture`.
  - Bộc lọc hiển thị (Display Filter):
    ```text
    tcp.port == 3784 || (tcp.port >= 6211 && tcp.port <= 6214)
    ```
  - Kiểm tra các cờ TCP (SYN, ACK, FIN, RST), cấu trúc framing của WebSocket (RFC 6455) và phản hồi HTTP GET header (MIME types).
- **Fiddler Classic / mitmproxy (Loopback Reverse Proxy Mode)**:
  - Trỏ proxy cục bộ lắng nghe tại `127.0.0.1:8888` (khi cần phân tích nội dung HTTP headers và payload JSON).

### 3.4. Công cụ Bắt Sai khác Tệp tin & Registry (Filesystem & Registry Diffing)
- **RegShot 2.0**:
  - `Shot 1`: Chụp trước khi khởi động ứng dụng.
  - `Shot 2`: Chụp sau khi ứng dụng chạy xong kịch bản hoặc sau khi thoát.
  - Xuất báo cáo so sánh sai khác tệp (`HTML/TXT Report`) liệt kê chính xác các khóa Registry được thêm mới, sửa đổi hoặc xóa bỏ.
- **PowerShell Hash Diffing**:
  - Script lấy mã băm SHA-256 toàn bộ cây thư mục `%LocalAppData%\GGTT\` trước và sau khi chạy.

### 3.5. Giám sát Kênh Sự kiện Hệ thống (Windows Event Viewer)
- Bật kiểm toán sự kiện (Audit Process Creation / Event ID 4688 kèm dòng lệnh chi tiết).
- Giám sát các kênh nhật ký:
  - `Applications and Services Logs` -> `Microsoft-Windows-Diagnostics-Performance`
  - `Windows Logs` -> `Application` (Lọc Event ID 1000 - Application Error, Event ID 1026 - .NET Runtime Exception).
  - `Microsoft-Windows-TerminalServices-LocalSessionManager`

---

## 4. Ma trận Kiểm thử 9 Phân hệ (9-Category Test Matrix)

Dưới đây là ma trận 9 nhóm trường hợp kiểm thử động học có kiểm soát. Toàn bộ các kịch bản đều được xác lập trạng thái kỹ thuật là: **BLOCKED_PENDING_AUTHORIZATION**.

```
+==========================================================================================================+
|                                    CONTROLLED TEST MATRIX OVERVIEW                                       |
+==========================================================================================================+
| Mã TC     | Phân hệ Kiểm thử                                          | Trạng thái Kỹ thuật              |
+-----------+-----------------------------------------------------------+----------------------------------+
| TC-DYN-01 | Chu kỳ Khởi động & Đóng Tiến trình (Startup & Shutdown)   | BLOCKED_PENDING_AUTHORIZATION    |
| TC-DYN-02 | Vòng đời Tiến trình Con (Child Processes - WebView2 & FX) | BLOCKED_PENDING_AUTHORIZATION    |
| TC-DYN-03 | Mô hình Truy cập Tệp (%LocalAppData%\GGTT\ & SQLite WAL)  | BLOCKED_PENDING_AUTHORIZATION    |
| TC-DYN-04 | Hoạt động Ghi Registry & Cấu hình Người dùng (.NET)       | BLOCKED_PENDING_AUTHORIZATION    |
| TC-DYN-05 | Ràng buộc Cổng Máy chủ WebSocket (Port 3784 Broadcast)   | BLOCKED_PENDING_AUTHORIZATION    |
| TC-DYN-06 | Ràng buộc Máy chủ HTTP Media & Nhảy Cổng (6211-6214)     | BLOCKED_PENDING_AUTHORIZATION    |
| TC-DYN-07 | Đường cơ sở Tiêu thụ Tài nguyên CPU & Bộ nhớ (Resource)   | BLOCKED_PENDING_AUTHORIZATION    |
| TC-DYN-08 | Xử lý Lỗi khi Ngắt Kết nối Loopback Đột ngột             | BLOCKED_PENDING_AUTHORIZATION    |
| TC-DYN-09 | Thu hồi Tài nguyên & Dọn dẹp Đĩa khi Thoát Ứng dụng      | BLOCKED_PENDING_AUTHORIZATION    |
+==========================================================================================================+
```

---

### TC-DYN-01: Chu kỳ Khởi động & Đóng Tiến trình (Process Startup & Shutdown Lifecycle)

- **Mục tiêu quan sát**:
  1. Xác minh cơ chế Single-Instance Mutex: `GGTT.Program.Main` khởi tạo `System.Threading.Mutex` với tên `ggtt_mutex`.
  2. Xác minh việc gọi lần 2 khi bản thể thứ nhất đang chạy sẽ dẫn tới `Environment.Exit(0)` tức thì.
  3. Quan sát chuỗi khởi tạo: `RegisterGlobalErrorHandlers` -> `AppLogger.Initialize` -> `SettingsMigration.Upgrade` -> `ApplicationConfiguration.Initialize` -> `Google_Tiktok_Form`.
- **Điều kiện tiên quyết**:
  - Môi trường sạch `SNAP_00_BASELINE`. ProcMon đang bắt đầu ghi nhận.
- **Trình tự thao tác**:
  1. Khởi chạy `GGTT.exe` từ cửa sổ lệnh PowerShell không kèm tham số.
  2. Quan sát sự xuất hiện của tiến trình trong Process Explorer và việc chiếm giữ Mutant handle `\BaseNamedObjects\ggtt_mutex`.
  3. Khởi chạy bản sao thứ hai: `GGTT.exe` trong một cửa sổ lệnh khác.
  4. Quan sát bản sao thứ hai tự kết thúc trong vòng < 200ms với mã thoát `ExitCode: 0`.
  5. Đóng giao diện chính `Google_Tiktok_Form` bằng nút đóng cửa sổ (X).
  6. Quan sát tiến trình chính chấm dứt hoàn toàn và nhả Mutex handle.
- **Bộ lọc giám sát**:
  - ProcMon: `Process Name is GGTT.exe` AND `Operation in (Process Start, Process Exit, CreateFile, RegOpenKey)`.
  - Process Explorer: Handle Filter `ggtt_mutex`.
- **Kết quả kỳ vọng**:
  - Bản sao 1 chiếm thành công `ggtt_mutex`, tạo file log `%LocalAppData%\GGTT\app.log` với dòng `Bắt đầu mở GGTT`.
  - Bản sao 2 phát hiện `createdNew == false`, lập tức thoát `Exit(0)`.
  - Khi đóng, ghi log `Ứng dụng đóng bình thường`, Mutex bị hủy, tiến trình biến mất khỏi Task Manager.
- **Tiêu chí Đạt/Không đạt (Pass/Fail Criteria)**:
  - *Pass*: Khóa đơn phiên hoạt động chính xác 100%, không xảy ra deadlock, không có crash dialog.
  - *Fail*: Hai cửa sổ ứng dụng cùng mở đồng thời hoặc tiến trình chính bị treo (hang) khi đóng.
- **Trạng thái**: **BLOCKED_PENDING_AUTHORIZATION**

---

### TC-DYN-02: Vòng đời Tiến trình Con (Child Process Lifecycle - WebView2 & Effects Renderer)

- **Mục tiêu quan sát**:
  1. Xác minh việc nạp WebView2 từ đường dẫn nhúng `SpeechRuntime\151.0.4129.107\x64\msedgewebview2.exe` (thay vì WebView2 cài sẵn trong Windows).
  2. Quan sát việc hình thành nhóm tiến trình con Chromium: GPU Process, Network Service, Renderer Process.
  3. Quan sát giao tiếp IPC qua Named Pipe `\\.\pipe\GGTT.Studio.Launch.*` khi kích hoạt phân hệ hiệu ứng kịch bản.
- **Điều kiện tiên quyết**:
  - `SNAP_00_BASELINE`. Thư mục `SpeechRuntime` nguyên bản tồn tại trong thư mục cài đặt.
- **Trình tự thao tác**:
  1. Khởi chạy `GGTT.exe`.
  2. Chờ Form chính hiển thị đầy đủ và WebView2 nạp môi trường khởi đầu (`InitializeWebViewWithProfileAsync`).
  3. Kiểm tra Process Explorer xem có bao nhiêu tiến trình `msedgewebview2.exe` xuất hiện dưới dạng con (Child PID) của `GGTT.exe`.
  4. Ghi nhận dòng lệnh khởi chạy (Command Line arguments) của các tiến trình con này (ví dụ: `--embedded-browser-webview=1`, `--user-data-dir=...`).
  5. Phát lệnh đóng Form chính và theo dõi việc thu hồi các tiến trình con.
- **Bộ lọc giám sát**:
  - ProcMon: `Process Name is msedgewebview2.exe` OR `Operation is Process Create`.
  - Process Explorer: Xem thuộc tính tiến trình cha (Parent PID) của `msedgewebview2.exe`.
- **Kết quả kỳ vọng**:
  - `GGTT.exe` tạo từ 3 đến 5 tiến trình `msedgewebview2.exe` với tham số trỏ `--user-data-dir` vào thư mục `%LocalAppData%\GGTT\WebviewTT` hoặc `WebViewJQ`.
  - Tất cả các tiến trình con phải nằm trong cùng một Windows Job Object hoặc tự động đóng sạch khi tiến trình cha `GGTT.exe` dừng.
- **Tiêu chí Đạt/Không đạt**:
  - *Pass*: Tiến trình con nạp đúng phiên bản nhúng trong `SpeechRuntime`, tự giải phóng 100% khi đóng app.
  - *Fail*: Tồn tại tiến trình `msedgewebview2.exe` mồ côi (Zombie / Orphan process) tiếp tục chạy ngầm sau khi `GGTT.exe` đã thoát.
- **Trạng thái**: **BLOCKED_PENDING_AUTHORIZATION**

---

### TC-DYN-03: Mô hình Truy cập Tệp (%LocalAppData%\GGTT\ & SQLite WAL Storage)

- **Mục tiêu quan sát**:
  1. Quan sát khởi tạo tệp cơ sở dữ liệu `team.db` thông qua Win32 P/Invoke `winsqlite3.dll`.
  2. Xác minh việc thiết lập các PRAGMA: `journal_mode=WAL`, `synchronous=FULL`, `busy_timeout=5000`.
  3. Ghi nhận sự xuất hiện của hai tệp phụ trợ: `team.db-wal` (Write-Ahead Log) và `team.db-shm` (Shared Memory index).
  4. Quan sát cơ chế xoay vòng ghi tệp log `app.log` và thư mục tải tạm `UpdateDownloadCache`.
- **Điều kiện tiên quyết**:
  - `SNAP_00_BASELINE`. Thư mục `%LocalAppData%\GGTT\` ban đầu chưa tồn tại hoặc rỗng.
- **Trình tự thao tác**:
  1. Khởi chạy `GGTT.exe`.
  2. Mở tab cấu hình hoặc quản lý phòng đấu PK (kích hoạt `TeamDatabase..ctor`).
  3. Sử dụng ProcMon lọc các thao tác I/O trên thư mục `%LocalAppData%\GGTT\`.
  4. Kiểm tra sự xuất hiện của các bảng `ledger`, `configuration`, `deliveries` trong `team.db`.
  5. Đóng ứng dụng an toàn và kiểm tra việc thu hồi tệp `-wal` về tệp chính (WAL Checkpoint).
- **Bộ lọc giám sát**:
  - ProcMon: `Path contains \AppData\Local\GGTT\` AND `Operation in (CreateFile, ReadFile, WriteFile, SetAllocationInformationFile)`.
- **Kết quả kỳ vọng**:
  - Ứng dụng tự động tạo thư mục `%LocalAppData%\GGTT\` nếu chưa có.
  - Xuất hiện `team.db`, `team.db-wal`, `team.db-shm`.
  - Quá trình ghi nhận giao dịch xu quà sử dụng chế độ WAL mà không thực hiện khóa độc quyền toàn bộ tệp database lâu hơn `busy_timeout` (5000ms).
- **Tiêu chí Đạt/Không đạt**:
  - *Pass*: SQLite vận hành chuẩn WAL mode, không gặp lỗi `database is locked`, cấu trúc bảng khớp 100% tài liệu `24-persistence-and-lifecycle.md`.
  - *Fail*: Ứng dụng crash do không tìm thấy `winsqlite3.dll` hoặc sinh lỗi ngoại lệ `IOException`.
- **Trạng thái**: **BLOCKED_PENDING_AUTHORIZATION**

---

### TC-DYN-04: Hoạt động Ghi Registry & Cấu hình Người dùng (.NET Settings)

- **Mục tiêu quan sát**:
  1. Xác minh hành vi của `GGTT.SettingsMigration.Upgrade`: đọc cờ `UpgradeRequired` và di chuyển thiết lập từ phiên bản cũ.
  2. Định vị chính xác nơi lưu trữ cấu hình: tệp XML `user.config` trong `%LocalAppData%\GGTT\GGTT.exe_Url_...\...` so với khóa Registry `HKCU\Software\GGTT`.
  3. Quan sát các khóa con được ghi nhận: proxy, kích thước cửa sổ (`Bounds`), tài khoản kênh, cấu hình âm thanh.
- **Điều kiện tiên quyết**:
  - RegShot đã thực hiện `Shot 1`. Hệ thống sạch hoàn toàn khóa Registry cũ.
- **Trình tự thao tác**:
  1. Khởi chạy `GGTT.exe`.
  2. Mở cửa sổ cấu hình (`Google_Tiktok_Setting`), thay đổi một tham số kiểm thử (ví dụ: thay đổi cổng âm thanh hoặc bật/tắt checkbox).
  3. Bấm Lưu cấu hình (`SettingsBase.Save()`).
  4. Đóng ứng dụng.
  5. RegShot thực hiện `Shot 2` và chạy thuật toán so sánh `Compare`.
- **Bộ lọc giám sát**:
  - ProcMon: `Operation in (RegCreateKey, RegSetValue, RegDeleteValue)` AND `Path contains GGTT`.
  - RegShot: Lọc các nhánh `HKEY_CURRENT_USER\Software` và thư mục `AppData`.
- **Kết quả kỳ vọng**:
  - Nếu ứng dụng sử dụng chuẩn `ApplicationSettingsBase`, tệp `user.config` được cập nhật tại `%LocalAppData%\GGTT\GGTT.exe_Url_<hash>\<version>\user.config`.
  - Nếu có sử dụng Win32 Registry, các khóa được giới hạn trong nhánh người dùng hiện tại `HKCU\Software\GGTT`, tuyệt đối không ghi trái phép vào `HKLM` (yêu cầu quyền quản trị hệ thống).
- **Tiêu chí Đạt/Không đạt**:
  - *Pass*: Cấu hình được lưu bền vững, lần khởi động tiếp theo đọc lại chính xác giá trị đã đổi, không vi phạm đặc quyền hệ thống (UAC).
  - *Fail*: Ứng dụng cố gắng ghi vào `HKLM` dẫn tới lỗi truy cập `UnauthorizedAccessException` khi chạy dưới tài khoản Standard User.
- **Trạng thái**: **BLOCKED_PENDING_AUTHORIZATION**

---

### TC-DYN-05: Ràng buộc Cổng Máy chủ WebSocket (WebSocket Binding - ws://127.0.0.1:3784)

- **Mục tiêu quan sát**:
  1. Xác minh việc gọi `StartWebSocketServerCore` mở socket nghe tại địa chỉ `ws://127.0.0.1:3784` sử dụng thư viện `Fleck`.
  2. Xác minh tính an toàn mạng: Socket CHỈ liên kết (bind) với địa chỉ loopback `127.0.0.1`, tuyệt đối KHÔNG bind vào `0.0.0.0` (mọi card mạng) tránh rò rỉ dữ liệu ra mạng LAN.
  3. Quan sát hành vi bắt tay (WebSocket Handshake) và việc định kỳ phát bản tin trạng thái `type: "team_state"` với cơ chế tiết lưu 250ms (Throttling / 4 Hz).
- **Điều kiện tiên quyết**:
  - Cổng 3784 trên máy ảo đang rỗng (chưa bị chiếm dụng bởi tiến trình khác). Wireshark loopback đang chạy.
- **Trình tự thao tác**:
  1. Khởi chạy `GGTT.exe`.
  2. Bật tính năng phòng đấu PK để kích hoạt WebSocket Server.
  3. Mở PowerShell thực thi lệnh kiểm tra socket:
     ```powershell
     Get-NetTCPConnection -LocalPort 3784 | Select-Object LocalAddress, LocalPort, State, OwningProcess
     ```
  4. Chạy một script Node.js hoặc Python client đơn giản kết nối vào `ws://127.0.0.1:3784`.
  5. Lắng nghe gói tin JSON trả về trong 10 giây; đo khoảng thời gian giữa các gói tin `team_state`.
  6. Đóng client kết nối.
- **Bộ lọc giám sát**:
  - Wireshark: `tcp.port == 3784`.
  - ProcMon: `Operation in (TCP Listen, TCP Accept, TCP Receive, TCP Send)` AND `Path contains 3784`.
- **Kết quả kỳ vọng**:
  - `LocalAddress` hiển thị chính xác `127.0.0.1` (hoặc `localhost`), trạng thái `Listen`.
  - Client kết nối thành công, nhận bản tin JSON hợp lệ chứa 13 trường dữ liệu trạng thái (`state`, `ranks`, `gifts`, ...).
  - Tần suất phát bản tin tuân thủ đúng chu kỳ điều tiết ~250ms (không spam liên tục 0ms khi có cập nhật).
- **Tiêu chí Đạt/Không đạt**:
  - *Pass*: Socket mở đúng cổng 3784 trên 127.0.0.1, bắt tay chuẩn RFC 6455, dữ liệu JSON đúng lược đồ tài liệu `11-overlay-protocol.md`.
  - *Fail*: Socket bind vào `0.0.0.0` (nguy cơ bảo mật mạng LAN) hoặc server từ chối kết nối loopback.
- **Trạng thái**: **BLOCKED_PENDING_AUTHORIZATION**

---

### TC-DYN-06: Ràng buộc Máy chủ HTTP Media & Nhảy Cổng (Media Server 6211-6214)

- **Mục tiêu quan sát**:
  1. Xác minh khởi tạo `HttpListener` trên cổng cơ sở `http://127.0.0.1:6211/`.
  2. Xác minh thuật toán nhảy cổng an toàn khi cổng bị xung đột: nếu cổng 6211 đang bận, server tự động thử lần lượt `6212` -> `6213` -> `6214`.
  3. Xác minh tiêu đề MIME Type trả về cho các tệp tĩnh qua phương thức `GetMimeType`:
     - `.mp4` -> `video/mp4`
     - `.webm` -> `video/webm`
     - `.moc3` -> `application/octet-stream`
     - `.png` -> `image/png`
- **Điều kiện tiên quyết**:
  - Kịch bản A: Cổng 6211 đang tự do.
  - Kịch bản B: Cố tình chiếm trước cổng 6211 bằng một tiến trình test giả lập (`dummy listener`).
- **Trình tự thao tác**:
  1. **Thử nghiệm A (Normal Bind)**:
     - Chạy `GGTT.exe`, kiểm tra socket cổng 6211 qua `netstat -ano | findstr 6211`.
     - Gửi yêu cầu HTTP GET bằng curl: `curl -I http://127.0.0.1:6211/test.png`.
     - Quan sát phản hồi tiêu đề HTTP (`Content-Type`).
  2. **Thử nghiệm B (Port Conflict Cascade)**:
     - Đóng `GGTT.exe`.
     - Mở PowerShell listener chiếm giữ cổng 6211:
       ```powershell
       $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add("http://127.0.0.1:6211/"); $listener.Start()
       ```
     - Khởi chạy lại `GGTT.exe`.
     - Kiểm tra xem `GGTT.exe` có tự động nhảy lên lắng nghe tại cổng `6212` hay không.
     - Dọn dẹp $listener sau khi kiểm tra xong.
- **Bộ lọc giám sát**:
  - Wireshark: `tcp.port >= 6211 && tcp.port <= 6214`.
  - ProcMon: `Operation is TCP Listen` AND `Path contains 621`.
- **Kết quả kỳ vọng**:
  - Thử nghiệm A: Lắng nghe thành công tại 6211, trả về MIME type chính xác theo phần mở rộng tệp.
  - Thử nghiệm B: Ứng dụng không bị crash bởi lỗi `HttpListenerException (Access denied / Address in use)`, tự động fallback thành công sang cổng 6212.
- **Tiêu chí Đạt/Không đạt**:
  - *Pass*: Cơ chế phân giải MIME type đúng chuẩn và chuỗi fallback 4 cổng hoạt động hoàn hảo.
  - *Fail*: Ứng dụng văng lỗi khi cổng 6211 bị chiếm hoặc trả sai header MIME type.
- **Trạng thái**: **BLOCKED_PENDING_AUTHORIZATION**

---

### TC-DYN-07: Đường cơ sở Tiêu thụ Tài nguyên CPU & Bộ nhớ (Resource Baseline - Idle vs Gift Load)

- **Mục tiêu quan sát**:
  1. Đo lường chỉ số chiếm dụng tài nguyên ở trạng thái nghỉ (Idle State): CPU < 2%, RAM ổn định.
  2. Đo lường chỉ số tài nguyên khi mô phỏng tải dồn dập (Burst Gift Load): 50 quà/giây gửi vào loopback socket.
  3. Kiểm tra rò rỉ bộ nhớ (Memory Leak) và áp lực thu gom rác .NET (.NET Garbage Collection Gen 0/1/2 pauses).
- **Điều kiện tiên quyết**:
  - `SNAP_00_BASELINE`. Mở Performance Monitor (PerfMon) hoặc ghi log counter định kỳ 1 giây qua PowerShell.
- **Trình tự thao tác**:
  1. Khởi chạy `GGTT.exe` và để ứng dụng chạy không tải trong 5 phút; ghi nhận baseline RAM (Private Bytes) và CPU.
  2. Sử dụng công cụ test loopback bơm mô phỏng sự kiện quà tặng (Gift Combo payload) với tần suất tăng dần: từ 5 quà/s đến 50 quà/s liên tục trong 3 phút.
  3. Quan sát biến động của:
     - Bộ đếm `% Processor Time` của `GGTT.exe` và `msedgewebview2.exe`.
     - Số lượng Handle đang mở.
     - Tần suất các đợt GC (`# Gen 0 Collections`, `# Gen 2 Collections`).
  4. Ngừng phát tải, chờ ứng dụng hạ nhiệt trong 2 phút; kiểm tra bộ nhớ có được thu hồi về mức an toàn không.
- **Bộ lọc giám sát**:
  - PerfMon Counters: `Process(GGTT)\% Processor Time`, `Process(GGTT)\Private Bytes`, `.NET CLR Memory(GGTT)\# Bytes in all Heaps`.
  - Task Manager / Resource Monitor.
- **Kết quả kỳ vọng**:
  - Ở trạng thái Idle: CPU trung bình < 3.0%, RAM < 350 MB.
  - Ở trạng thái tải dồn dập (Gift Storm): CPU không vượt quá 25% (trên CPU 4-core ảo), RAM không tăng vô hạn (không có memory leak trong hàng đợi `_pending` của `ScenarioEngine`), sau khi hết tải RAM ổn định trở lại.
- **Tiêu chí Đạt/Không đạt**:
  - *Pass*: Hệ thống chịu tải mượt mà, không drop FPS dưới 30, bộ nhớ được thu hồi sau khi hoàn tất combo.
  - *Fail*: Hiện tượng rò rỉ bộ nhớ (RAM tăng tuyến tính liên tục không giảm) hoặc hiện tượng nghẽn luồng giao diện chính (UI Freeze / Not Responding).
- **Trạng thái**: **BLOCKED_PENDING_AUTHORIZATION**

---

### TC-DYN-08: Cơ chế Xử lý Lỗi khi Ngắt Kết nối Loopback Đột ngột (Loopback Drop Handling)

- **Mục tiêu quan sát**:
  1. Đánh giá tính bền vững của các khối khóa đồng bộ: `clientsLock` trong `Google_Tiktok_Form` và `mediaStartLock`.
  2. Quan sát phản ứng của `GGTT.exe` khi một client WebSocket (như OBS Browser Source) đang nhận stream thì đột ngột bị đóng (gửi cờ TCP RST hoặc ngắt socket không qua FIN handshake).
  3. Đảm bảo luồng phát WebSocket không quăng ngoại lệ `SocketException` làm sập toàn bộ ứng dụng (.NET unhandled crash).
- **Điều kiện tiên quyết**:
  - `GGTT.exe` đang chạy và mở cổng 3784. Kịch bản PK đang hoạt động.
- **Trình tự thao tác**:
  1. Kết nối một tiến trình client kiểm thử vào `ws://127.0.0.1:3784`.
  2. Đang trong lúc máy chủ phát dữ liệu `team_state`, dùng lệnh `Stop-Process -Force` để giết đột ngột tiến trình client (mô phỏng OBS bị crash hoặc tắt card mạng ảo).
  3. Sử dụng ProcMon và Event Viewer quan sát phản ứng của `GGTT.exe`.
  4. Thử kết nối lại bằng một client mới để kiểm tra xem danh sách `clients` có tự động loại bỏ client chết và chấp nhận kết nối mới bình thường không.
- **Bộ lọc giám sát**:
  - Windows Event Viewer: `Application Log` (Lọc Event ID 1026 .NET Runtime).
  - Wireshark: Bắt gói tin `TCP RST` trên cổng 3784.
  - ProcMon: Bắt các ngoại lệ nội bộ qua cột `Result` (`FAST IO DISALLOWED`, `SUCCESS`, hoặc lỗi socket).
- **Kết quả kỳ vọng**:
  - Máy chủ WebSocket bắt được lỗi ngắt kết nối trong khối `try-catch`, ghi nhận thông báo vào log nội bộ, tự động loại bỏ socket chết khỏi danh sách `clients` dưới sự bảo vệ của `lock (clientsLock)`.
  - Form chính tiếp tục chạy bình thường, client mới kết nối lại ngay lập tức được phục vụ.
- **Tiêu chí Đạt/Không đạt**:
  - *Pass*: Ứng dụng hoàn toàn miễn nhiễm trước sự cố ngắt kết nối đột ngột của client, không xảy ra crash hay rò rỉ socket descriptor.
  - *Fail*: Phát sinh lỗi `UnhandledException` làm đóng ứng dụng hoặc danh sách `clients` bị kẹt khóa vĩnh viễn (Deadlock).
- **Trạng thái**: **BLOCKED_PENDING_AUTHORIZATION**

---

### TC-DYN-09: Thu hồi Tài nguyên & Dọn dẹp Đĩa khi Thoát (Resource Teardown & Cleanup)

- **Mục tiêu quan sát**:
  1. Xác minh chuỗi dọn dẹp khi người dùng đóng ứng dụng:
     - `ReleaseWebViewsForCacheAsync`: Đóng các instance WebView2.
     - Hủy token bất đồng bộ (`processingOnlineCts.Cancel()`, `desktopLoginCts.Cancel()`).
     - `StopWebSocketServer()`: Đóng và giải phóng socket 3784.
     - `mediaListener.Stop()` / `Close()`: Giải phóng cổng 6211.
     - `TeamDatabase`: Đóng handle SQLite trên `team.db`.
     - `Mutex.Dispose()`: Nhả khóa đơn phiên `ggtt_mutex`.
  2. Kiểm tra chu trình dọn dẹp cache đĩa `CleanCache` đối với các thư mục: `WebviewTT`, `WebViewJQ`, `GameStoreJQ`.
- **Điều kiện tiên quyết**:
  - Ứng dụng đã chạy qua các tính năng trong ít nhất 10 phút, đã phát sinh dữ liệu đệm trình duyệt trong `%LocalAppData%\GGTT\`.
- **Trình tự thao tác**:
  1. Bấm nút đóng Form chính hoặc kích hoạt tính năng dọn dẹp bộ nhớ đệm từ menu cài đặt.
  2. Giám sát thời gian thực bằng ProcMon chuỗi các thao tác giải phóng handle tệp, đóng kết nối socket và hủy tiến trình con.
  3. Sau khi tiến trình `GGTT.exe` biến mất khỏi danh sách tiến trình:
     - Kiểm tra trạng thái cổng 3784 và 6211 bằng `Get-NetTCPConnection`.
     - Kiểm tra xem tệp `team.db-wal` đã được checkpoint về `team.db` hoàn toàn chưa.
     - Kiểm tra xem các file khóa tạm thời có bị để lại trên đĩa không.
- **Bộ lọc giám sát**:
  - ProcMon: `Operation in (CloseFile, TCP Disconnect, Process Exit)`.
  - PowerShell kiểm tra cổng: `Get-NetTCPConnection -LocalPort 3784, 6211 -ErrorAction SilentlyContinue`.
- **Kết quả kỳ vọng**:
  - Tất cả các cổng mạng 3784, 6211..6214 được giải phóng hoàn toàn về trạng thái tự do (không bị kẹt ở `TIME_WAIT` quá lâu).
  - Không còn file rác bị khóa, `team.db` được đóng gọn gàng và toàn vẹn.
  - Toàn bộ các tiến trình con `msedgewebview2.exe` kết thúc trong vòng tối đa 3 giây sau khi cửa sổ chính đóng.
- **Tiêu chí Đạt/Không đạt**:
  - *Pass*: 100% tài nguyên mạng, bộ nhớ, handle tệp và tiến trình con được thu hồi sạch sẽ; không còn tệp khóa mồ côi.
  - *Fail*: Cổng mạng bị chiếm giữ ngầm sau khi đóng hoặc tệp database bị hỏng (corrupted) do ngắt tiến trình đột ngột không đóng connection.
- **Trạng thái**: **BLOCKED_PENDING_AUTHORIZATION**

---

## 5. Tuyên bố Trạng thái & Cơ chế Cổng Duyệt Task E (Task E Authorization Gate)

### 5.1. Khẳng định Trạng thái Kỹ thuật
- **Giai đoạn Hoạch định Tĩnh (Static Planning - Task D)**: **HOÀN TẤT (100% COMPLETED)**.
  - Toàn bộ thông số kiến trúc, bộ lọc quan sát, điều kiện biên và ma trận 9 phân hệ đã được thiết kế hoàn chỉnh dựa trên bằng chứng dịch ngược nhị phân CIL tĩnh.
- **Giai đoạn Đo kiểm Động Thực tế (Dynamic Execution - Task E)**: **BLOCKED_PENDING_AUTHORIZATION**.
  - Không có bất kỳ kịch bản thực thi động nào trong 9 phân hệ trên được phép kích hoạt tự động.
  - Toàn bộ hoạt động thực thi thực tế trên máy ảo bị khóa cứng (hard-gated) cho đến khi nhận được lệnh phê duyệt tường minh bằng văn bản từ người dùng có thẩm quyền.

### 5.2. Các Điều kiện Tiên quyết để Mở khóa Task E (Gating Prerequisites)
Trước khi người dùng cấp quyền thực thi Task E, các điều kiện an toàn sau bắt buộc phải được kiểm tra và ký xác nhận:
1. **Kiểm tra Hộp cát Độc lập (Environment Sign-off)**:
   - Đã xác minh bằng lệnh mạng rằng máy ảo không có gateway Internet (Zero egress route).
   - Đã xác minh tệp hosts chứa sinkhole đầy đủ các tên miền ngoại vi.
   - Đã tạo thành công bản snapshot gốc `SNAP_00_BASELINE`.
2. **Kiểm tra Bộ công cụ Đo lường (Tooling Readiness)**:
   - ProcMon, Wireshark, RegShot, Process Explorer đã được cài đặt và cấu hình sẵn các profile bộ lọc đúng chuẩn mục 3 của kế hoạch này.
3. **Phê duyệt Bằng văn bản của Người dùng (Explicit Human Authorization)**:
   - Người dùng trực tiếp nhập lệnh ủy quyền thực thi từng kịch bản đơn lẻ (không chạy hàng loạt không giám sát).

---

## 6. Kết luận & Hướng dẫn Chuyển giao Phòng sạch

Kế hoạch quan sát thực thi động học này cung cấp khung kỹ thuật toàn diện, an toàn và chuẩn mực nhất để kiểm chứng lại các phát hiện dịch ngược tĩnh của `GGTT.exe` và `GGTT.dll`. Khi được người dùng phê duyệt thực thi trong tương lai, dữ liệu thu thập được từ 9 trường hợp kiểm thử sẽ đóng vai trò là bằng chứng thực nghiệm cuối cùng, giúp đội ngũ kỹ sư phòng sạch hoàn thiện 100% bộ tài liệu tái hiện phần mềm mà không vi phạm bất kỳ nguyên tắc an toàn hay sở hữu trí tuệ nào.
