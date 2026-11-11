# Báo cáo Dịch ngược Lưu trữ Dữ liệu & Vòng đời Ứng dụng (Phase 8 - Data Persistence & Lifecycle)

- **Mã báo cáo**: `24-persistence-and-lifecycle.md`
- **Phân hệ phân tích**: `GGTT.Team.TeamDatabase`, `GGTT.Team.TeamStore`, `GGTT.Team.TeamGiftJournalService`, `GGTT.SettingsMigration`, `GGTT.UpdateDownloadCache` (117 phương thức)
- **Công nghệ nền tảng**: Win32 `winsqlite3` P/Invoke, SQLite WAL mode, `System.Configuration.ApplicationSettingsBase`, AutoUpdater.NET
- **Mục đích chức năng**: Lưu trữ kế toán xu quà tặng bất biến (Ledger), cấu hình phòng đấu PK, bộ nhớ đệm Chromium WebView2, xoay vòng dọn dẹp đĩa và quy trình cập nhật nhị phân
- **Ngày hoàn tất**: 2026-11-11

---

## 1. Kiến trúc Tầng Lưu trữ Cơ sở Dữ liệu (SQLite Architecture)

Khác với nhiều ứng dụng desktop sử dụng gói NuGet `System.Data.SQLite` hay `Microsoft.Data.Sqlite` cồng kềnh, GGTT tận dụng trực tiếp thư viện SQLite tích hợp sẵn của hệ điều hành Windows (`winsqlite3.dll`):

```
+---------------------------------------------------------------------------------------------------+
|                                 PERSISTENCE & STORAGE ARCHITECTURE                                |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|   1. MANAGED DATA ACCESS LAYER                                                                    |
|   +------------------------------------+          +-------------------------------------------+   |
|   | GGTT.Team.TeamStore                | -------> | GGTT.Team.TeamDatabase                    |   |
|   | (Business logic, Gift combos,      |          | (Transaction wrapper, UTF-8 conversion,   |   |
|   |  audit log, ledger reporting)      |          |  prepared statements, busy retry)         |   |
|   +------------------------------------+          +---------------------+---------------------+   |
|                                                                         |                         |
|   2. NATIVE WIN32 INTEROP                                               v                         |
|   +-------------------------------------------------------------------------------------------+   |
|   | C-Decl P/Invoke to winsqlite3.dll:                                                        |   |
|   | sqlite3_open_v2, sqlite3_prepare_v2, sqlite3_step, sqlite3_column_text, sqlite3_finalize  |   |
|   +-------------------------------------+-----------------------------------------------------+   |
|                                         |                                                         |
|                                         v                                                         |
|   3. PHYSICAL STORAGE                                                                             |
|   +-------------------------------------------------------------------------------------------+   |
|   | - team.db (WAL Mode, synchronous=FULL, busy_timeout=5000)                                 |   |
|   | - In-Memory Temp Tables: pending_gifts, pending_deliveries, pending_combos                |   |
|   | - Live Views: committed_ledger UNION ALL pending_gifts                                    |   |
|   +-------------------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------------------+
```

### 1.1. Khởi tạo & Cấu hình PRAGMA (`TeamDatabase..ctor` 0x060004a1)
Khi mở kết nối `team.db`, ứng dụng áp dụng các PRAGMA bắt buộc để đảm bảo an toàn giao dịch tài chính:
```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=FULL;
PRAGMA busy_timeout=5000;
PRAGMA temp_store=MEMORY;
```
- `journal_mode=WAL`: Cho phép ghi và đọc đồng thời giữa luồng nhận quà TikTok và luồng phát OBS WebSocket mà không khóa cơ sở dữ liệu.
- `temp_store=MEMORY`: Giữ toàn bộ các bảng tạm chờ xử lý (`pending_gifts`, `pending_deliveries`) trên RAM để đạt hiệu năng tối đa.

---

## 2. Lược đồ Cơ sở Dữ liệu & Sổ cái Bất biến (Schema & Ledger Accounting)

### 2.1. Bảng Cấu hình & Phiên PK
1. **`configuration`**: Lưu trữ toàn bộ trạng thái PK và thiết lập đội dưới dạng JSON duy nhất.
   ```sql
   CREATE TABLE IF NOT EXISTS configuration (
       id INTEGER PRIMARY KEY CHECK(id=1),
       json TEXT NOT NULL
   );
   ```
2. **`deliveries`**: Lưu ID các gói quà đã nhận để chống xử lý trùng lặp (Idempotency).
   ```sql
   CREATE TABLE IF NOT EXISTS deliveries (
       id TEXT PRIMARY KEY,
       received_at TEXT NOT NULL
   );
   ```
3. **`sender_targets`**: Ánh xạ người tặng quà với thành viên cụ thể trong ca làm việc (`shift_id`).
   ```sql
   CREATE TABLE IF NOT EXISTS sender_targets (
       shift_id TEXT NOT NULL,
       sender_id TEXT NOT NULL,
       member_id TEXT NOT NULL,
       PRIMARY KEY(shift_id, sender_id)
   );
   ```

### 2.2. Sổ cái Quà tặng Bất biến (`ledger`)
Bảng trung tâm lưu vết toàn bộ xu phát sinh trong trận đấu:
```sql
CREATE TABLE IF NOT EXISTS ledger (
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    member_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    gift_id TEXT NOT NULL,
    coins INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    occurred_at TEXT NOT NULL,
    round_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    note TEXT NOT NULL,
    source TEXT NOT NULL,
    channel_uid TEXT NOT NULL DEFAULT '',
    widget_rounds TEXT NOT NULL DEFAULT '{}',
    deleted_at TEXT NOT NULL DEFAULT '',
    revision INTEGER NOT NULL DEFAULT 0,
    parts TEXT NOT NULL DEFAULT '{}',
    journal_id TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ledger_report ON ledger(occurred_at, group_id, member_id);
CREATE INDEX IF NOT EXISTS ledger_shift ON ledger(shift_id, round_id);
```

### 2.3. Bảng Tạm Bộ nhớ & View Trực tiếp (In-Memory Buffer & Live View)
Để duy trì độ phản hồi tức thì của thanh điểm PK trên OBS, GGTT tách biệt giữa quà đã chốt và quà đang combo:
1. **Bảng tạm**: `pending_gifts`, `pending_deliveries`, `pending_combos` được tạo với cấu trúc tương tự `ledger` nhưng nằm trong bộ nhớ RAM (`WHERE 0`).
2. **`committed_ledger`**: View bóc tách các sự kiện bộ phận (`parts.events`) nếu có quà chia nhỏ cho nhiều thành viên.
3. **`live_ledger`**: Hợp nhất thời gian thực giữa quà đã ghi đĩa và quà tạm:
   ```sql
   CREATE TEMP VIEW live_ledger AS 
   SELECT * FROM committed_ledger 
   UNION ALL 
   SELECT * FROM pending_gifts;
   ```
4. **Triggers Kiểm toán (`gift_journal`)**:
   Khi có cập nhật hoặc xóa bản ghi trên `ledger`, các trigger tự động tăng số hiệu `revision = revision + 1` trên bảng `gift_journal` để client phát hiện thay đổi và đồng bộ lại.

---

## 3. Quản lý Cấu hình & Nâng cấp Phiên bản (Settings Migration)

Lớp `GGTT.SettingsMigration` (`0x02000053`) đảm bảo người dùng không bị mất cấu hình (token, tài khoản, proxy, bố cục cửa sổ) khi ứng dụng được cập nhật nhị phân mới:

```cil
// SettingsMigration.Upgrade (0x0600035c)
IL_0000: call        Settings::get_Default()
IL_0007: callvirt    Settings::get_UpgradeRequired()
IL_000c: brfalse.s   IL_0033
IL_0010: ldloc.0
IL_0011: callvirt    ApplicationSettingsBase::Upgrade()
IL_0016: ldloc.0
IL_0017: ldc.i4.0
IL_0018: callvirt    Settings::set_UpgradeRequired(false)
IL_001d: ldloc.0
IL_001e: callvirt    SettingsBase::Save()
...
IL_0026: ldstr       "Lỗi nâng cấp settings"
IL_002c: call        AppLogger::Error(string, Exception)
```
- Khi chạy phiên bản mới lần đầu, trường `UpgradeRequired` mặc định là `true`.
- Ứng dụng tự động sao chép các giá trị cấu hình từ thư mục phiên bản cũ trong `%AppData%\Local\GGTT\...` sang phiên bản mới và lưu lại.

---

## 4. Quản lý Bộ nhớ Đệm & Vòng đời Lưu trữ (Cache & Storage Lifecycle)

### 4.1. Giám sát Dung lượng Đĩa Cục bộ
Trong `InitHealthMonitor` (`0x060002bb`), GGTT liên tục kiểm tra 2 ngưỡng:
- `MinFreeDiskBytes`: Dung lượng đĩa tối thiểu cần duy trì.
- `MaxLocalSaveBytes`: Dung lượng tối đa mà bộ nhớ đệm GGTT được phép chiếm dụng.
- Khi vượt ngưỡng, hệ thống kích hoạt chu trình dọn dẹp tự động hoặc nhắc nhở người dùng qua `CleanCacheConfirm`.

### 4.2. Chu trình Làm sạch Đệm Trình duyệt (`CleanCache` 0x060002d9 / 0x0600078b)
Quá trình làm sạch dữ liệu trình duyệt diễn ra theo trình tự nghiêm ngặt để tránh lỗi khóa tệp (`file in use`):
1. **Giải phóng WebView2**: Gọi `ReleaseWebViewsForCacheAsync` (`0x06000304`) để đóng tiến trình con Chromium Edge và hủy liên kết bộ nhớ.
2. **Xóa 3 phân vùng lưu trữ**:
   - `WebviewTT`: Thư mục hồ sơ người dùng WebView2 của phiên bản TikTok Desktop (chứa cache video live stream, cookie).
   - `WebViewJQ`: Thư mục hồ sơ người dùng WebView2 của TikTok Mobile (JQSVN).
   - `GameStoreJQ`: Thư mục chứa tài nguyên đồ họa game, file video MP4, avatar, âm thanh được tải về.
3. **Xử lý Ngoại lệ Tệp**: Bắt lỗi `IOException` / `UnauthorizedAccessException` và thông báo chi tiết qua log: `"🚨 Lỗi khi xóa thư mục WebviewTT"`, `"🚨 Lỗi khi xóa thư mục WebViewJQ"`.

---

## 5. Cơ chế Tự động Cập nhật Nhị phân (Auto-Updater & Binary Staging)

GGTT tích hợp thư viện `AutoUpdater.NET` để phân phối các bản cập nhật mà không gián đoạn luồng stream của người dùng.

### 5.1. Thư mục Lưu tạm Bản cập nhật (`GGTT.UpdateDownloadCache`)
- Vị trí: `%LocalAppData%\GGTT\update`.
- Lớp `UpdateDownloadCache` (`0x02000057`) triển khai cơ chế dọn dẹp các file rác cũ thông qua biểu thức chính quy (Regex):
  ```regex
  \A(?:v[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\.zip|GGTT-Installer-(?:[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+-)?(?:vi|en)\.exe|ZipExtractor\.(?:exe|log))\z
  ```
- Định kỳ xóa các file `.zip`, `.exe` cài đặt cũ hoặc file log của `ZipExtractor` trước khi tải bản cập nhật mới.

### 5.2. Xử lý Thất bại Cập nhật An toàn (Fail-Safe Strategy)
Khi quá trình kiểm tra hoặc tải gói cập nhật gặp sự cố (mất mạng, máy chủ cập nhật offline):
- Phương thức `AutoUpdaterOnCheckForUpdateEvent` (`0x06000783`) ghi nhận thông báo lỗi đa ngôn ngữ (`vi-VN` / `en-US`):
  - Tiếng Việt: `"Cập nhật thất bại, tiếp tục phiên bản hiện tại"`
  - Tiếng Anh: `"Update failed. GGTT will continue with the current version."`
- Ứng dụng **không bao giờ bị crash hoặc dừng hoạt động**, đảm bảo streamer vẫn tiếp tục phiên live bình thường với phiên bản hiện tại.

---

## 6. Khuyến nghị Tái hiện Phòng sạch (Clean-Room Guidelines)

1. **Chuẩn hóa ORM / Data Layer**:
   - Thay thế Win32 `winsqlite3` bằng thư viện ADO.NET chuẩn `Microsoft.Data.Sqlite` để hỗ trợ đa nền tảng (Windows, macOS, Linux) mà không cần phụ thuộc vào DLL hệ điều hành cụ thể.
2. **Tính Toàn vẹn Tài chính & Kiểm toán (Audit Trails)**:
   - Cơ chế Ledger bất biến (`ledger` + `parts` + `gift_journal`) là một thiết kế chuẩn mực cho kế toán xu quà tặng. Cần duy trì cấu trúc này để đảm bảo có thể tái hiện lại chính xác mọi phép tính điểm PK khi có tranh chấp.
3. **Cơ chế Cập nhật Tách rời**:
   - Sử dụng giải pháp cập nhật hiện đại (như Squirrel.Windows, Velopack, hoặc MSIX) cho phép cập nhật nhị phân dưới nền (silent background update) và tự động khởi động lại khi người dùng tắt ứng dụng.
