# Báo cáo Xác minh Chiều sâu Thuật toán Cốt lõi (Phase 9 - Task C)

- **Mã tài liệu**: `29-deep-algorithm-verification.md`
- **Dự án**: Nghiên cứu & Dịch ngược Phòng sạch Ứng dụng GGTT (Google TikTok / TikTok Interactive Tool)
- **Công cụ chủ đạo**: REA Binary Analyzer, Node.js CIL Symbol Engine & Metadata Indexer
- **Nhánh làm việc Git**: `research/phase9-behavioral-verification`
- **Ngày lập**: 2026-11-11
- **Mục tiêu**: Chứng minh bằng chỉ lệnh CIL nhị phân chính xác 4 thuật toán cốt lõi của GGTT: C1 (ScenarioEngine), C2 (AI Pose Tracking & OBS Auth), C3 (SQLite Accounting & Idempotency), C4 (WebSocket Overlay & Media Streaming Server), loại bỏ mọi phỏng đoán hành vi.

---

## 1. Thuật toán C1: Máy Đánh giá & Điều phối Kịch bản (`ScenarioEngine`)

Phân hệ kịch bản trực quan được thực thi thông qua lớp `GGTT.EffectsBridge.Effects.ScenarioEngine` (TypeDef `0x0200006f`), bao gồm hai phương thức trung tâm:
- `0x0600042f`: `bool Evaluate(Condition, double, Context, out double, out double)` (254 chỉ lệnh CIL)
- `0x0600042e`: `void Tick(double, Context)` (438 chỉ lệnh CIL)

### 1.1. Máy Trạng thái Điều kiện CIL (`0x0600042f Evaluate`)
Phương thức `Evaluate` duyệt cây điều kiện phân cấp, hỗ trợ 4 nhóm logic chính:

```cil
// Trích xuất CIL: Nhánh logic "group" (IL_0000 - IL_009f)
IL_0000: ldarg.1        // nạp condition
IL_0001: ldfld          kind
IL_0006: ldstr          "group"
IL_000b: call           op_Equality
IL_0010: brfalse        164
IL_0015: ldarg.1        
IL_0016: ldfld          logic
IL_001b: ldstr          "all"
IL_0020: call           op_Equality
...
IL_0079: ldarg.1        
IL_007a: ldfld          logic
IL_007f: ldstr          "any"
IL_0084: call           op_Equality
```

1. **Nhóm Điều kiện Phức hợp (`group`)**:
   - `logic == "all"`: Vòng lặp đệ quy qua `children`. Nếu bất kỳ điều kiện con nào trả về `false`, phương thức ngắn mạch (short-circuit) và trả về `false` ngay lập tức (`IL_006e - IL_0074`).
   - `logic == "any"`: Nếu bất kỳ điều kiện con nào trả về `true`, ngắn mạch và trả về `true` (`IL_0089 - IL_0090`).
2. **Điều kiện Thời gian (`time`) (`IL_00a4 - IL_010a`)**:
   - So sánh thời gian trôi qua `elapsed` với mốc `number`.
   - Hỗ trợ các toán tử: `"eq"` (`IL_00b6`), `"ne"` (`IL_00c8`), và biên thời gian bước nhảy (`IL_00ee`: `elapsed >= number && _previous < number`).
3. **Điều kiện Dữ liệu (`data`) (`IL_0131 - IL_015a`)**:
   - Truy vấn trường `_data[field]` và so sánh chuỗi hoặc số qua `ScenarioRules::Compare`.
4. **Điều kiện Ngẫu nhiên (`random`) (`IL_0152 - IL_0186`)**:
   - Kiểm tra xác suất ngẫu nhiên qua `_random.Test(condition)`.

### 1.2. Hàng đợi Hành động & Ngưỡng Chống Tràn CIL (`0x0600042e Tick`)
Trong hàm `Tick`, các hành động phát sinh được đưa vào hàng đợi `_pending` và điều tiết nghiêm ngặt:

```cil
// Trích xuất CIL: Ngưỡng giới hạn dung lượng hàng đợi 256 (IL_03a9 - IL_03ba)
IL_03a4: call           System.Linq.Enumerable::OrderBy
IL_03a9: ldc.i4         256
IL_03ae: call           System.Linq.Enumerable::Take
IL_03b3: call           System.Linq.Enumerable::ToList
IL_03b8: stloc.s        15
```

- **Giới hạn dung lượng**: Chỉ lệnh `IL_03a9: ldc.i4 256` kết hợp `Enumerable.Take(256)` khống chế tối đa 256 hành động được xử lý trong mỗi chu kỳ `Tick`.
- **Hành động `cancel_pending` (`IL_0404 - IL_042d`)**:
  Xóa toàn bộ hành động cùng nhóm qua `_pending.RemoveAll(...)` (`IL_0428`).
- **Hành động `set_state` (`IL_0444 - IL_046f`)**:
  Gán giá trị biến trạng thái `_variables[target] = number` (`IL_046a`).
- **Hành động `add_state` (`IL_0480 - IL_04cf`)**:
  Cộng dồn giá trị biến và kẹp trong khoảng an toàn `[-1,000,000, 1,000,000]` để chống tràn số:
  `Math.Max(-1000000, Math.Min(1000000, _variables[target] + number))` (`IL_04ad - IL_04c5`).

---

## 2. Thuật toán C2: Nhận dạng Khung xương AI & Giao thức OBS Studio

Phân hệ theo dõi hình thể và hình phạt livestream sử dụng mô hình ONNX tích hợp trong `GGTT.Tracking` và kết nối OBS Studio qua WebSocket v5.

### 2.1. Xác thực OBS WebSocket v5 SHA-256 (`0x060008d4 <ConnectAsync>d__2::MoveNext`)
CIL chứng minh ứng dụng chỉ tương thích với OBS v5 trở lên và thực hiện bắt tay mã hóa SHA-256:

```cil
// Trích xuất CIL: Chuỗi định danh và xác thực OBS v5 (0x060008d4)
IL_005e: ldstr          "ws://127.0.0.1:"
...
IL_016a: ldstr          "Cần OBS WebSocket v5 (OBS 28 trở lên)."
IL_017b: ldstr          "rpcVersion"
IL_018c: ldstr          "eventSubscriptions"
IL_019f: ldstr          "d"
IL_01ad: ldstr          "authentication"
IL_01c8: ldstr          "salt"
IL_01f2: ldstr          "authentication"
IL_0200: ldstr          "challenge"
...
IL_035c: ldstr          "Xác thực OBS thất bại. Kiểm tra mật khẩu OBS WebSocket."
```

- **Thuật toán sinh Secret Response**:
  1. `base_secret = Base64(SHA256(password + salt))`
  2. `auth_response = Base64(SHA256(base_secret + challenge))`
  3. Gửi frame `Identify` (OpCode 1) chứa `rpcVersion: 1`, `authentication: auth_response`.

### 2.2. Toán học Hậu xử lý Pose ONNX (`0x0600045b Sigmoid` & `0x0600045c Anchors`)
1. **Hàm Kích hoạt Sigmoid Kẹp Biên (`0x0600045b`)**:
   Mã CIL chứa đúng 11 chỉ lệnh tính toán:
   ```cil
   IL_0000: ldc.r8         1
   IL_0009: ldc.r8         1
   IL_0012: ldarg.0        // x
   IL_0013: ldc.r8         -80
   IL_001c: ldc.r8         80
   IL_0025: call           Math.Clamp
   IL_002a: neg            
   IL_002b: call           Math.Exp
   IL_0030: add            
   IL_0031: div            
   IL_0032: ret            
   ```
   **Công thức toán học giải mã**:
   $$\text{Sigmoid}(x) = \frac{1}{1 + e^{-\text{clamp}(x, -80.0, 80.0)}}$$
   Ngưỡng kẹp $[-80, 80]$ ngăn chặn hoàn toàn lỗi tràn số dấu phẩy động IEEE 754 (`double.PositiveInfinity` / `NaN`).

2. **Cấu trúc Lưới Neo (Anchor Generation) (`0x0600045c`)**:
   Khởi tạo mảng 3 tầng tỷ lệ đặc trưng:
   - Tầng 1: Lưới $28 \times 28$, 2 neo/điểm (`ldc.i4.s 28`, `ldc.i4.2`).
   - Tầng 2: Lưới $14 \times 14$, 2 neo/điểm (`ldc.i4.s 14`, `ldc.i4.2`).
   - Tầng 3: Lưới $7 \times 7$, 6 neo/điểm (`ldc.i4.7`, `ldc.i4.6`).
   Tổng số anchor box dự đoán: $28^2 \times 2 + 14^2 \times 2 + 7^2 \times 6 = 1568 + 392 + 294 = 2254$ hộp bao hình thể.

3. **Máy Trạng thái Đếm Squat Khớp Gối (`0x060008e8 MoveNext`)**:
   - `STANDING`: Góc gối $> 160.0^\circ$.
   - `DESCENDING`: Góc gối $< 140.0^\circ$.
   - `SQUATTING`: Góc gối $\le 100.0^\circ$.
   - Khi đứng thẳng trở lại ($> 160.0^\circ$), bộ đếm tăng thêm 1 (`reps++`).

---

## 3. Thuật toán C3: Sổ cái Kế toán SQLite, Di chuyển Phiên bản & Tính Bất biến Giao dịch

Phân hệ sổ cái SQLite (`GGTT.Team.TeamStore`, TypeDef `0x02000078`) đảm bảo không thất thoát dữ liệu quà tặng TikTok ngay cả khi ứng dụng bị tắt đột ngột (crash-consistent).

### 3.1. Tự động Sao lưu Trước Di chuyển CSDL (`0x060004b5 Upgrade`)
Trước khi thực hiện `PRAGMA user_version` nâng cấp, CIL ép buộc sao lưu toàn bộ tệp CSDL:

```cil
IL_0031: ldarg.0        
IL_0032: call           GGTT.Team.TeamStore::get_Root
IL_0037: ldstr          "backups"
IL_003c: call           System.IO.Path::Combine
IL_0041: call           System.IO.Directory::CreateDirectory
...
IL_0053: ldstr          "before-continuous-"
IL_0058: call           System.DateTime::get_Now
IL_0060: ldstr          "yyyyMMdd-HHmmss-fff"
IL_0065: call           System.DateTime::ToString
...
IL_01b8: call           System.IO.Path::Combine
IL_01bd: call           GGTT.Team.TeamStore::Backup
```

### 3.2. Cấu trúc Lược đồ CSDL v3 (`0x060004ca <Upgrade>b__24_2`)
CIL giải mã các câu lệnh SQL DDL chính xác:
1. Kiểm tra cột tồn tại qua `PRAGMA table_info(ledger)`.
2. Bổ sung các cột mới nếu thiếu:
   ```sql
   ALTER TABLE ledger ADD COLUMN channel_uid TEXT NOT NULL DEFAULT '';
   ALTER TABLE ledger ADD COLUMN widget_rounds TEXT NOT NULL DEFAULT '{}';
   ALTER TABLE ledger ADD COLUMN deleted_at TEXT NOT NULL DEFAULT '';
   ALTER TABLE ledger ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE ledger ADD COLUMN parts TEXT NOT NULL DEFAULT '{}';
   ALTER TABLE ledger ADD COLUMN journal_id TEXT NOT NULL DEFAULT '';
   ```
3. Bảng thay đổi kiểm toán (Audit Table):
   ```sql
   CREATE TABLE IF NOT EXISTS ledger_changes (
     id TEXT PRIMARY KEY,
     entry_id TEXT NOT NULL,
     action TEXT NOT NULL,
     before_json TEXT NOT NULL,
     after_json TEXT NOT NULL,
     at TEXT NOT NULL
   );
   ```
4. Chỉ mục tăng tốc truy vấn:
   ```sql
   CREATE INDEX IF NOT EXISTS ledger_group_channel ON ledger(group_id, channel_uid, channel, member_id);
   CREATE INDEX IF NOT EXISTS ledger_group_time ON ledger(group_id, occurred_at);
   ```

### 3.3. Cơ chế Khóa Giao dịch & Idempotency Combo (`0x060004ae CommitGiftCombo`)
Khi chốt sổ một combo quà tặng:
- **Tập hợp các mảnh combo (`parts`)**: Ghép nối danh sách mã giao dịch con thành chuỗi JSON mảng `parts` (`IL_0097 - IL_00b8`).
- **Ghi sổ cái duy nhất**: Truy vấn khóa chính và thực hiện cập nhật có điều kiện `revision = revision + 1` nhằm ngăn chặn race condition giữa luồng nhận sự kiện TikTok và luồng tick giao diện.

---

## 4. Thuật toán C4: Máy chủ WebSocket Overlay & Phục vụ Media HTTP

Toàn bộ luồng dữ liệu hiển thị trên OBS Browser Source và WebView2 được phục vụ qua máy chủ nội bộ trong `GGTT.Google_Tiktok_Form`.

### 4.1. Điều tiết Trạng thái Giao diện (250ms Debounce) (`0x06000311 SendTeamState`)
Để ngăn WebView2 bị treo do hàng chục ngàn sự kiện quà gửi đến trong trận PK cao điểm, mã CIL triển khai thuật toán điều tiết độ trễ 250ms:

```cil
// Trích xuất CIL: Kiểm tra mốc thời gian 250ms (0x06000311)
IL_0061: call           System.DateTime::get_UtcNow
IL_0066: ldarg.0        
IL_0067: ldfld          teamLastStateSent
IL_006c: call           System.DateTime::op_Subtraction
IL_0071: stloc.1        
IL_0072: ldloca.s       1
IL_0074: call           System.TimeSpan::get_TotalMilliseconds
IL_0079: ldc.r8         250
IL_0082: bge.un.s       155
IL_0084: ldarg.0        
IL_0085: ldfld          teamStatePending
IL_008a: brtrue.s       154
IL_008c: ldarg.0        
IL_008d: ldc.i4.1       
IL_008e: stfld          teamStatePending
IL_0093: ldarg.0        
IL_0094: call           GGTT.Google_Tiktok_Form.SendDelayedTeamStateAsync
IL_0099: pop            
IL_009a: ret            
```

- Nếu `(UtcNow - teamLastStateSent).TotalMilliseconds < 250`, đặt cờ `teamStatePending = true`, kích hoạt tác vụ trễ `SendDelayedTeamStateAsync` và thoát sớm (`ret`).
- Nếu đã đủ 250ms, cập nhật `teamLastStateSent = UtcNow`, đóng gói dữ liệu JSON `team_state` qua `TeamSnapshot()` và gửi trực tiếp qua `PostWebMessageAsJson` (`IL_00a7 - IL_00ce`).

### 4.2. Nhảy Cổng Media & Phân giải MIME (`0x060002a6` & `0x060002aa`)
- **Khởi tạo Media Server (`0x060002a6`)**: Sử dụng `HttpListener` lắng nghe trên dải cổng động từ 5000 đến 5050 (`http://127.0.0.1:{port}/`). Nếu cổng bị chiếm dụng, tự động thử cổng kế tiếp (`port++`).
- **Phân giải MIME (`0x060002aa`)**: Bản đồ tĩnh 14 phần mở rộng tệp (.html, .js, .css, .png, .jpg, .webp, .svg, .mp3, .wav, .mp4, .webm, .json, .woff2, .wasm) với giá trị mặc định là `application/octet-stream`.

---

## 5. Kết luận Xác minh Chiều sâu Thuật toán

1. Toàn bộ 4 thuật toán cốt lõi (C1, C2, C3, C4) đã được giải mã triệt để ở cấp độ từng chỉ lệnh máy CIL (IL offsets, opcodes, operand strings, exception handlers).
2. Các hằng số quan trọng (ngưỡng hàng đợi 256, kẹp sigmoid $[-80, 80]$, góc gối $100^\circ/140^\circ/160^\circ$, debounce 250ms, dải cổng 5000-5050) đều được chứng minh bằng nhị phân gốc, tạo nền tảng vững chắc cho tài liệu bàn giao phòng sạch.
