# Báo cáo Phân tích 12 Trường hợp Biên Kế toán Combo (Phase 7 - Combo Accounting Edge Cases)

- **Mã báo cáo**: `15-combo-accounting-edge-cases.md`
- **Phương thức trọng tâm**: `0x06000a46` (`TeamScoringService::<Gift>b__0`), `0x060004ab` (`ReadCombo`), `0x060004ac` (`WriteCombo`), `0x060004ae` (`CommitGiftCombo`), `0x0600049d` (`Recipient`), `0x0600049e` (`Record`), `0x0600063a` (`AddLedger`)
- **Mục tiêu**: Kiểm tra toán học kế toán và xử lý trạng thái trên 12 kịch bản biên thực tế trong livestream TikTok Live, phân loại rõ ràng hành vi kế thừa trực tiếp từ CIL (`EXPECTED_FROM_CIL`) so với các khoảng trống cần quyết định thiết kế (`SPECIFICATION_DECISION_REQUIRED`).

---

## 1. Bảng Tổng hợp Phân loại 12 Trường hợp Biên

| ID | Tên Trường hợp Biên | Phân loại | Rủi ro trong Clean-Room |
|---|---|---|---|
| **EC-01** | Đảo thứ tự gói tin (Packet Re-ordering) | `EXPECTED_FROM_CIL` | Tính điểm theo thứ tự đến; chốt sổ sắp theo thời gian |
| **EC-02** | Gói tin trùng lặp (Duplicate Gift Packets) | `EXPECTED_FROM_CIL` | Triệt tiêu gia số về 0 thành công |
| **EC-03** | Gia số âm hoặc bằng 0 (Negative / Zero Delta) | `EXPECTED_FROM_CIL` | `Math.Max(0, ...)` chặn trừ ngược điểm |
| **EC-04** | Nhảy cóc chuỗi combo (Combo Streak Jump e.g. 1 -> 50) | `EXPECTED_FROM_CIL` | Cộng bù toàn phần `49 * unitPrice` |
| **EC-05** | Khóa dự phòng khi `ComboId` rỗng (`""`) | `EXPECTED_FROM_CIL` | Gom theo khóa `"fallback"` theo cặp sender/gift |
| **EC-06** | Combo đã đóng nhận gói tin đến muộn cùng `ComboId` | `EXPECTED_FROM_CIL` | Truy xuất lại từ bảng `combos` thông qua `UNION ALL` |
| **EC-07** | Combo đã đóng gặp quà mới có `ComboId` rỗng (`""`) | `EXPECTED_FROM_CIL` | Reset `existingCombo = null` để tạo chuỗi mới |
| **EC-08** | Thay đổi `recipientOverride` giữa chuỗi combo | `EXPECTED_FROM_CIL` | Tầng 1 UI override phá vỡ khóa streak hiện thời |
| **EC-09** | Thay đổi `sender_targets` giữa trận đấu | `EXPECTED_FROM_CIL` | Áp dụng ngay cho combo mới; combo cũ theo rule lưu |
| **EC-10** | Phân bổ người nhận cho round nhiều người vs 1 người | `EXPECTED_FROM_CIL` | Sổ cái giữ `member_id = ""` nếu `distinct > 1` |
| **EC-11** | Tạo `JournalId` và vòng đời dọn bảng `pending_gifts` | `EXPECTED_FROM_CIL` | Gom hàng chờ thành 1 dòng `ledger` khi commit |
| **EC-12** | Cách ly giao dịch SQLite (Transaction Isolation / Rollback) | `SPECIFICATION_DECISION_REQUIRED` | Thiếu `BEGIN TRANSACTION` dễ gây rò rỉ khi crash |

---

## 2. Phân tích Chi tiết Từng Trường hợp Biên

### EC-01: Đảo thứ tự gói tin (Packet Re-ordering: Timestamp vs Arrival Order)
- **Kịch bản**: Gói tin combo `qty=5` (`t=1005`) đến trước gói tin `qty=3` (`t=1003`) do độ trễ mạng.
- **Hành vi trong CIL**:
  - `0x06000a46` xử lý sự kiện tuần tự theo hàng đợi đến (arrival order), hoàn toàn không sắp xếp lại trước khi tính gia số.
  - Khi gói `qty=5` đến trước: `deltaQuantity = 5 - 0 = 5`. Cộng +5 vào điểm live và cập nhật `existingCombo.Quantity = 5`.
  - Khi gói `qty=3` đến sau: `deltaQuantity = Math.Max(0, 3 - 5) = 0`. Theo lệnh `IL_0a19`, `deltaCoins` bị ép về `0`. Gói tin đến muộn bị triệt tiêu an toàn.
  - Khi chạy `CommitGiftCombo` (`0x060004ae`): Câu lệnh `SELECT * FROM pending_gifts WHERE journal_id=$id ORDER BY occurred_at,rowid` sắp xếp lại các sự kiện theo `occurred_at` khi tạo báo cáo `ledger.parts`.
- **Phân loại**: `EXPECTED_FROM_CIL`

### EC-02: Gói tin trùng lặp (Duplicate Gift Packets)
- **Kịch bản**: Máy chủ nhận hai gói tin giống hệt nhau có cùng `ComboId = "c_100"`, `Quantity = 10`, `Coins = 100`.
- **Hành vi trong CIL**:
  - Gói 1: `existingCombo == null` -> `deltaCoins = 100`, `deltaQuantity = 10`. Lưu vào `pending_combos`.
  - Gói 2: `ReadCombo` tải `existingCombo` (`Coins = 100, Quantity = 10`).
  - Tính toán: `deltaCoins = Math.Max(0, 100 - 100) = 0`, `deltaQuantity = Math.Max(0, 10 - 10) = 0`.
  - Không có điểm nào được cộng thêm vào tổng điểm đội và không chèn thêm bản ghi có giá trị dương vào `pending_gifts`.
- **Phân loại**: `EXPECTED_FROM_CIL`

### EC-03: Gia số Âm hoặc Bằng 0 (Negative or Zero Delta)
- **Kịch bản**: Gói tin mới có `Coins = 50, Quantity = 5`, nhưng trạng thái đang giữ là `Coins = 100, Quantity = 10`, hoặc gói tin truyền vào `Quantity = 0` nhưng `Coins = 50`.
- **Hành vi trong CIL**:
  - Lệnh `IL_09ef` và `IL_0a12`: gọi `System.Math::Max(int32, int32)` với tham số thứ hai là `0` (`ldc.i4.0`). Do đó delta không bao giờ âm.
  - Lệnh `IL_0a19`: kiểm tra `if (deltaQuantity == 0) deltaCoins = 0`. Nếu số lượng quà tăng thêm bằng 0 (kể cả khi `gift.Coins` lớn hơn `existingCombo.Coins`), gia số xu cũng bị chặn về 0.
- **Phân loại**: `EXPECTED_FROM_CIL`

### EC-04: Nhảy cóc chuỗi combo (Combo Streak Jump: 1 -> 50)
- **Kịch bản**: Gói tin đầu là `Quantity = 1, Coins = 10`. Mạng rớt và gói kế tiếp báo `Quantity = 50, Coins = 500`.
- **Hành vi trong CIL**:
  - `deltaCoins = Math.Max(0, 500 - 10) = 490`.
  - `deltaQuantity = Math.Max(0, 50 - 1) = 49`.
  - Không có bất kỳ logic kiểm tra bước nhảy (`step validation`) hay giới hạn trần (`rate cap`) nào. Hệ thống lập tức ghi nhận toàn bộ 490 điểm và 49 đơn vị quà trong một giao dịch.
- **Phân loại**: `EXPECTED_FROM_CIL`

### EC-05: Khóa dự phòng khi `ComboId` là chuỗi rỗng (`""`)
- **Kịch bản**: Sự kiện quà tặng từ WebView2 không mang trường `combo_id` hoặc mang chuỗi rỗng `""`.
- **Hành vi trong CIL**:
  - `0x06000a46` thiết lập khóa truy vấn định danh chuỗi là `"fallback"` (kết hợp cùng định danh kênh/người gửi/ID quà).
  - Bảng `pending_combos` và `combos` tra cứu và lưu bản ghi dưới khóa dự phòng này.
- **Phân loại**: `EXPECTED_FROM_CIL`

### EC-06: Combo đã đóng nhận gói tin đến muộn có cùng `ComboId`
- **Kịch bản**: Combo `"c_200"` đã nhận cờ kết thúc (`Closed == true`, `Quantity = 10`) và chuyển sang bảng `combos`. Sau đó có gói tin `"c_200"` đến muộn.
- **Hành vi trong CIL**:
  - `ReadCombo` (`0x060004ab`) thực thi: `SELECT json FROM pending_combos WHERE id=$id UNION ALL SELECT json FROM combos WHERE id=$id LIMIT 1`. Nhờ có `UNION ALL`, hệ thống vẫn tìm thấy combo đã đóng trong bảng `combos`.
  - Tại `IL_094a - IL_0966` trong `0x06000a46`: Hệ thống kiểm tra `existingCombo.Closed && gift.ComboId == ""`. Vì `gift.ComboId` là `"c_200"` (khác rỗng), điều kiện nhánh **không nhảy tới reset**.
  - Hệ thống giữ nguyên `existingCombo` cũ để tính delta. Nếu gói đến muộn có `Quantity <= 10`, delta bị triệt tiêu về `0`. Nếu `Quantity > 10` (gói kết thúc thực sự tới sau), phần chênh lệch được cộng bổ sung và ghi đè lại vào bảng `combos`.
- **Phân loại**: `EXPECTED_FROM_CIL`

### EC-07: Combo đã đóng gặp quà mới có `ComboId` rỗng (`""`)
- **Kịch bản**: Người dùng tặng quà không có `ComboId` (khóa `fallback`). Quà trước đã đóng (`Closed == true`). Nay người dùng tặng tiếp quà mới (cũng có `ComboId == ""`).
- **Hành vi trong CIL**:
  - `ReadCombo` trả về bản ghi từ bảng `combos` với `Closed == true`.
  - Tại `IL_0948 - IL_0969` trong `0x06000a46`:
    - `existingCombo.Closed == true` (Đúng)
    - `gift.ComboId == ""` (Đúng)
    - Thực thi lệnh `IL_0968: ldnull; stloc.s 39` (`existingCombo = null`).
  - Trạng thái được reset hoàn toàn về `null`, coi đây là một chuỗi quà hoàn toàn mới với `previousCoins = 0` và `previousQuantity = 0`, cấp một `JournalId` mới.
- **Phân loại**: `EXPECTED_FROM_CIL`

### EC-08: Thay đổi `recipientOverride` trong khi chuỗi combo đang chạy
- **Kịch bản**: Chuỗi combo đang chạy ở nhịp thứ 3 cho Thành viên A. Người điều hành nhấn chọn Thành viên B trên UI (`recipientOverride = "B"`). Nhịp thứ 4 của combo tới.
- **Hành vi trong CIL**:
  - Trong kiến trúc 5 tầng phân bổ người nhận (`0x06000a46`), Tầng 1 (`recipientOverride`) được đánh giá **trước** Tầng 2 (`Combo Streak Lock`).
  - Do đó, phần gia số của nhịp thứ 4 được tính cho Thành viên B, trong khi các phần gia số của nhịp 1-3 trước đó trong `pending_gifts` vẫn giữ ID của Thành viên A.
- **Phân loại**: `EXPECTED_FROM_CIL`

### EC-09: Thay đổi quy tắc `sender_targets` giữa trận đấu
- **Kịch bản**: Người xem X ban đầu được cấu hình gửi quà cho Thành viên A. Giữa trận, streamer đổi quy tắc `sender_targets` của X sang Thành viên B.
- **Hành vi trong CIL**:
  - Truy vấn bảng SQLite `sender_targets` thực thi trực tiếp cho từng gói tin mới hoặc khi `existingCombo` không khóa cứng `TargetRule`.
  - Mọi combo **mới** từ X sẽ lập tức chuyển sang Thành viên B. Các combo **đang mở** trước đó vẫn chịu ảnh hưởng của Tầng 2 (`Combo Streak Lock`) trừ phi bị Tầng 1 ghi đè.
- **Phân loại**: `EXPECTED_FROM_CIL`

### EC-10: Phân bổ người nhận cho Round có 1 Thành viên vs Nhiều Thành viên
- **Kịch bản**: Một combo có nhiều phần tử (`pending_gifts`) thuộc về nhiều người nhận khác nhau (do thay đổi override giữa chừng như EC-08) được chốt sổ qua `CommitGiftCombo` (`0x060004ae`).
- **Hành vi trong CIL**:
  - Tại `IL_0234 - IL_0246` của `0x060004ae`: Hệ thống lọc danh sách `distinct` các `member_id` từ mảng `events`.
  - Nếu `distinctMembers.Length == 1` (`IL_0239: beq.s`): Cột `member_id` trong bảng `ledger` lưu trực tiếp ID thành viên duy nhất đó.
  - Nếu `distinctMembers.Length != 1` (ví dụ có 2 người nhận khác nhau trong cùng một `journal_id`): Cột `member_id` trong bảng `ledger` bị gán thành chuỗi rỗng `""` (`IL_023b: ldstr ""`). Dữ liệu chi tiết từng phần thuộc về ai chỉ còn nằm trong chuỗi JSON của cột `parts`.
- **Phân loại**: `EXPECTED_FROM_CIL`

### EC-11: Khởi tạo `JournalId` và Vòng đời Chốt Sổ `pending_gifts`
- **Kịch bản**: Quá trình chuyển đổi dữ liệu từ lúc quà tặng đang combo cho đến khi kết thúc combo.
- **Hành vi trong CIL**:
  - Khi combo bắt đầu (`existingCombo == null`), hệ thống sinh một `JournalId` duy nhất (GUID hoặc UUID chuỗi).
  - Mỗi lần nhận delta > 0, một hàng mới được ghi vào bảng `pending_gifts` mang `journal_id` này.
  - Khi kết thúc combo, `CommitGiftCombo(journalId, gift)` (`0x060004ae`):
    1. Đọc toàn bộ `pending_gifts` theo `journal_id`.
    2. Tính tổng `coins` và `quantity` thông qua các LINQ delegate (`0x06000963`, `0x06000964`).
    3. Kiểm tra xem trong `ledger` đã có dòng nào chứa `journal_id` này chưa (`IL_006c`). Nếu chưa có -> `INSERT INTO ledger` (`IL_0337`); nếu có -> `UPDATE ledger SET ..., revision=revision+1` (`IL_0347`).
    4. Chuyển doanh thu từ bảng tạm `pending_channel_pk_income` sang `channel_pk_income` (`IL_036c`).
    5. Xóa dữ liệu ở `pending_channel_pk_income` (`IL_0390`) và `pending_gifts` (`IL_03b4`).
- **Phân loại**: `EXPECTED_FROM_CIL`

### EC-12: Cách ly Giao dịch SQLite trong quá trình Chốt Combo (Transaction Isolation & Rollback)
- **Kịch bản**: Ứng dụng bị ngắt điện hoặc xảy ra lỗi ổ cứng ngay sau khi thực hiện câu lệnh `INSERT INTO ledger` (`IL_033e`) nhưng trước khi thực hiện câu lệnh `DELETE FROM pending_gifts` (`IL_03d1`) trong `CommitGiftCombo`.
- **Hành vi quan sát từ CIL**:
  - Kiểm tra toàn bộ 316 lệnh trong `0x060004ae_TeamStore_CommitGiftCombo.cil`: Không hề có lệnh khởi tạo giao dịch SQLite (`BEGIN TRANSACTION`, `COMMIT`, `ROLLBACK` hoặc gọi `SqliteConnection.BeginTransaction()`).
  - Các phương thức `TeamStore.Execute` được thực hiện dưới chế độ **autocommit độc lập** từng câu lệnh một.
  - **Hậu quả trong bản gốc**: Nếu ứng dụng sập giữa dòng `IL_033e` và `IL_03d1`, hàng chờ trong `pending_gifts` không bị xóa. Khi khởi động lại và chạy tiếp commit, câu lệnh `IL_006c` sẽ kích hoạt nhánh `UPDATE ledger` (cộng đè hoặc cập nhật lại), dẫn đến rủi ro thiếu nhất quán hoặc lỗi nhân đôi dữ liệu trong `channel_pk_income` nếu không khớp logic.
- **Phân loại**: `SPECIFICATION_DECISION_REQUIRED`
- **Khuyến nghị Clean-Room**: Trong thiết kế tái triển khai độc lập, phương thức `CommitGiftCombo` **BẮT BUỘC** phải được bọc trong một giao dịch nguyên tử SQLite (`BEGIN IMMEDIATE TRANSACTION ... COMMIT` kèm `ROLLBACK` khi ngoại lệ) để đảm bảo tính toàn vẹn ACID tuyệt đối.

---

## 3. Tóm tắt Kết luận Phân loại

- **11 / 12 trường hợp biên** có hành vi tất định, minh bạch hoàn toàn thông qua mã máy CIL (`EXPECTED_FROM_CIL`). Bộ kiểm thử ngoại tuyến (Offline Conformance Suite) có thể tái lập chính xác 100% logic của 11 trường hợp này để đối chiếu.
- **1 / 12 trường hợp biên (`EC-12`)** bộc lộ khiếm khuyết quản lý transaction trong ứng dụng gốc và được đánh dấu `SPECIFICATION_DECISION_REQUIRED` để xử lý khắc phục triệt để trong kiến trúc Clean-Room mới.
