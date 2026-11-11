# Đặc tả Kỹ thuật Tái triển khai Phòng Sạch (Phase 7 - Clean-Room Architectural Specification)

- **Mã tài liệu**: `17-clean-room-specification.md`
- **Mục đích**: Bản đặc tả kiến trúc phần mềm độc lập phục vụ đội ngũ phát triển xây dựng lại ứng dụng mới từ đầu mà **không sao chép mã nguồn, tài nguyên độc quyền, hay vi phạm bản quyền** của ứng dụng GGTT gốc.
- **Tiêu chuẩn tài liệu**:
  - `[OBSERVED]`: Hành vi gốc quan sát và chứng minh được từ mã máy CIL.
  - `[PROPOSED]`: Thiết kế kiến trúc đề xuất cho ứng dụng phòng sạch mới nhằm tối ưu hóa và sửa chữa khiếm khuyết gốc.
  - `[UNKNOWN]`: Ranh giới hộp đen chưa rõ không được đưa vào phụ thuộc.

---

## 1. Danh mục Tính năng Clean-Room (Feature Catalogue)

| Phân hệ chức năng | Trạng thái gốc `[OBSERVED]` | Đề xuất Clean-Room `[PROPOSED]` |
|---|---|---|
| **1. TikTok Ingestion** | Hook JS tiêm vào WebView2, tải động từ `jqsvn.com` | Bộ thu thập sự kiện độc lập (TikTok WebSocket / Web connector mở) |
| **2. PK Live Scoring** | Thuật toán trừ gia số (Delta Math.Max) không nhân hệ số | Giữ nguyên 100% thuật toán trừ gia số đã kiểm chứng từ CIL |
| **3. Combo State Machine** | Tách 2 bảng SQLite (`pending_combos` và `combos`) | Giữ nguyên máy trạng thái 2 bảng; bọc transaction ACID |
| **4. Recipient Allocation**| Thứ tự 5 tầng (UI Override -> Lock -> Sender -> Rule -> Pending) | Hiện thực hóa đúng 5 tầng ưu tiên; hỗ trợ gán lại bằng UI |
| **5. Overlay Server** | WebSocket RFC 6455 cổng 3784; bắt tay `SET_MACHINE_ID` | Máy chủ WebSocket chuẩn (e.g. `ws` / `uWebSockets`), cùng schema JSON |
| **6. Media Server** | HTTP Listener cổng 6211; tự nhảy cổng +1 tối đa 3 lần; 14 MIME | Máy chủ HTTP tĩnh cục bộ phục vụ assets; hỗ trợ CORS đầy đủ |
| **7. Game Control** | Gửi lệnh RCON sang server Minecraft | Module RCON tiêu chuẩn độc lập với command template tùy biến |
| **8. AI Pose Tracking** | MediaPipe ONNX Pose đếm rep squat khi thua | Tùy chọn (Optional plugin) qua ONNX Runtime tiêu chuẩn |
| **9. Hardware Hotkeys** | Win32 `RegisterHotKey` và `SendInput` | Bắt phím tắt toàn cục không xâm lấn qua API hệ điều hành |
| **10. Kế toán & Xuất CSV**| Quản lý bảng `ledger`, `channel_pk_income` trong SQLite | Giữ nguyên schema SQL đối soát để tương thích định dạng báo cáo |

---

## 2. Hợp đồng Hành vi Cốt lõi (Verified Behavioral Contracts)

### 2.1. Hợp đồng Kế toán Quà tặng (Gift Delta Contract)
- `[OBSERVED]`:
  ```
  deltaCoins = Math.Max(0, incomingCoins - previousCoins)
  deltaQuantity = Math.Max(0, incomingQuantity - previousQuantity)
  if (deltaQuantity == 0) deltaCoins = 0
  ```
- `[PROPOSED]`: Tuân thủ nghiêm ngặt công thức trên. Nếu gói tin đến muộn có `incomingQuantity <= previousQuantity`, gia số bằng 0 và không cập nhật điểm.

### 2.2. Hợp đồng Phân bổ Người nhận (Recipient Hierarchy Contract)
- `[OBSERVED]`:
  1. **Tầng 1 - UI Override**: Nếu streamer click chọn thành viên trên UI -> Gán ngay cho thành viên này.
  2. **Tầng 2 - Combo Streak Lock**: Nếu là gói tin nối tiếp của một combo đang mở -> Gán cho thành viên đã nhận từ đầu chuỗi.
  3. **Tầng 3 - Sender Target**: Kiểm tra cấu hình người gửi trong `sender_targets` -> Gán cho thành viên được chỉ định.
  4. **Tầng 4 - Round Gift Rule**: Kiểm tra luật quà trận đấu (`gift_id`) -> Gán cho thành viên nhận loại quà đó.
  5. **Tầng 5 - Unassigned / Pending**: Nếu không khớp 4 tầng trên -> Gán `member_id = ""` và đẩy vào hàng chờ `pending_gifts`.
- `[PROPOSED]`: Tái lập chính xác 5 tầng logic này trong clean-room service.

### 2.3. Hợp đồng Chuyển trạng thái Combo (Combo State Transition Contract)
- `[OBSERVED]`:
  - Khi `combo.Closed == false`: Ghi vào bảng `pending_combos`.
  - Khi `combo.Closed == true`: Ghi vào bảng `combos` và thực hiện `DELETE FROM pending_combos WHERE id=$id`.
  - Nếu combo trước đó đã đóng và gói tin mới có `combo_id == ""` -> Reset trạng thái về `null` để tạo chuỗi quà mới.
- `[PROPOSED]`: Giữ nguyên mô hình hai bảng để đảm bảo tương thích hoàn toàn về mặt ngữ nghĩa dữ liệu.

---

## 3. Mô hình Dữ liệu Cơ sở Dữ liệu (Database Schema Specification)

Được chuẩn hóa dựa trên cơ sở dữ liệu SQLite cục bộ `team.db`:

```sql
-- 1. Bảng lưu trữ combo đang diễn ra
CREATE TABLE IF NOT EXISTS pending_combos (
    id TEXT PRIMARY KEY,
    json TEXT NOT NULL
);

-- 2. Bảng lưu trữ combo đã kết thúc
CREATE TABLE IF NOT EXISTS combos (
    id TEXT PRIMARY KEY,
    json TEXT NOT NULL
);

-- 3. Bảng hàng chờ các phần tử quà tặng chờ chốt sổ
CREATE TABLE IF NOT EXISTS pending_gifts (
    id TEXT PRIMARY KEY,
    shift_id TEXT,
    group_id TEXT,
    channel TEXT,
    member_id TEXT,
    sender_id TEXT,
    gift_id TEXT,
    coins INTEGER,
    quantity INTEGER,
    occurred_at TEXT,
    round_id TEXT,
    kind TEXT,
    note TEXT,
    source TEXT,
    channel_uid TEXT,
    widget_rounds TEXT,
    deleted_at TEXT,
    revision INTEGER DEFAULT 0,
    journal_id TEXT,
    parts TEXT
);

-- 4. Bảng sổ cái chính thức (Ledger)
CREATE TABLE IF NOT EXISTS ledger (
    id TEXT PRIMARY KEY,
    shift_id TEXT,
    group_id TEXT,
    channel TEXT,
    member_id TEXT,
    sender_id TEXT,
    gift_id TEXT,
    coins INTEGER,
    quantity INTEGER,
    occurred_at TEXT,
    round_id TEXT,
    kind TEXT,
    note TEXT,
    source TEXT,
    channel_uid TEXT,
    widget_rounds TEXT,
    deleted_at TEXT,
    revision INTEGER DEFAULT 0,
    journal_id TEXT,
    parts TEXT
);

-- 5. Bảng cấu hình người nhận cố định theo người gửi
CREATE TABLE IF NOT EXISTS sender_targets (
    channel TEXT,
    sender_id TEXT,
    member_id TEXT,
    PRIMARY KEY(channel, sender_id)
);

-- 6. Bảng doanh thu người nhận quà PK
CREATE TABLE IF NOT EXISTS channel_pk_income (
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT,
    channel TEXT,
    at TEXT,
    coins INTEGER,
    sender_id TEXT
);
```

---

## 4. Mô hình Đồng thời & Đồng bộ hóa (Concurrency & Synchronization Model)

- `[OBSERVED]`:
  - Ứng dụng gốc sử dụng `object lock` (`clientsLock` trong `0x0600077d`) cho danh sách kết nối WebSocket.
  - Sử dụng cờ nguyên tử `MediaServerStarted` cho HttpListener.
  - Kiểm tra `teamLastStateSent` để hạn chế tần suất phát WebSocket 250ms.
- `[PROPOSED]`:
  - Trong kiến trúc mới (Node.js/Go/Rust/C#), sử dụng Single-threaded Event Loop hoặc Thread-safe Concurrent Collections (`ConcurrentDictionary`).
  - Sử dụng Token Bucket hoặc Sliding Window Timer 250ms cho kênh WebSocket broadcast ra OBS.

---

## 5. Cải tiến Tính toàn vẹn Giao dịch (Transaction Integrity Improvement)

- `[OBSERVED]`: Khiếm khuyết `EC-12` trong bản gốc: `CommitGiftCombo` chạy các lệnh SQL độc lập ở chế độ autocommit, có rủi ro mất đồng bộ khi sập nguồn giữa chừng.
- `[PROPOSED]`: Trong kiến trúc Clean-Room, **BẮT BUỘC** gói trọn vẹn tiến trình chốt sổ trong một Transaction nguyên tử:
  ```sql
  BEGIN IMMEDIATE TRANSACTION;
  -- 1. Insert/Update ledger
  -- 2. Chuyển pending_channel_pk_income sang channel_pk_income
  -- 3. Xóa pending_channel_pk_income
  -- 4. Xóa pending_gifts
  COMMIT;
  ```
  Nếu có lỗi xảy ra ở bất kỳ bước nào, toàn bộ giao dịch được `ROLLBACK` an toàn.

---

## 6. Ranh giới Bảo mật & Loại bỏ Thành phần Ngoại vi (Security Boundary & Isolation)

1. **Loại bỏ Hoàn toàn Phụ thuộc `jqsvn.com`**:
   - `[UNKNOWN]`: Logic cấp mã và xác thực của server `jqsvn.com`.
   - `[PROPOSED]`: Không kết nối tới máy chủ `jqsvn.com`. Sử dụng cấu hình người dùng cục bộ (local config) hoặc máy chủ tự quản (self-hosted).
2. **Loại bỏ Mã Báo cáo Discord**:
   - `[OBSERVED]`: GGTT chứa webhook URL cứng gửi crash report về Discord riêng của tác giả.
   - `[PROPOSED]`: Tuyệt đối không tích hợp webhook bên thứ ba; ghi log chẩn đoán nội bộ vào tệp `logs/app.log` trên máy người dùng.
3. **Phân tách Tài nguyên Độc quyền**:
   - `[OBSERVED]`: Ứng dụng gốc mang các hình ảnh, avatar, mô hình Live2D bản quyền.
   - `[PROPOSED]`: Bản clean-room chỉ cung cấp framework phần mềm mã nguồn mở; người dùng tự nạp tài nguyên media hoặc sử dụng tài nguyên miễn phí bản quyền (Creative Commons / MIT).
