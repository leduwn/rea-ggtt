# Luồng Tính điểm Live PK & Phân bổ Quà tặng (Pipeline B - Team PK & Scoring Pipeline)

- **Thời gian lập**: 2026-11-11
- **Phân hệ**: Nghiệp vụ Trọng tâm & Kế toán Quà tặng (`GGTT.Team.TeamChannelPkService`, `GGTT.Team.TeamScoringService`, `GGTT.Team.TeamCombo`, `GGTT.Team.TeamStore`)
- **Tài liệu tham chiếu**:
  - `evidence/cil/0x06000a46_TeamScoringService_Gift_b0.cil` (Closure `<Gift>b__0` của `TeamScoringService.Gift` `0x0600063c`, 1,125 CIL instructions)
  - `evidence/cil/0x0600049f_TeamChannelPkService_Apply.cil`
  - `evidence/cil/0x0600049e_TeamChannelPkService_Record.cil`
  - `evidence/cil/0x0600049d_TeamChannelPkService_Recipient.cil`
  - `evidence/cil/0x060004a0_TeamChannelPkService_Snapshot.cil`
  - `evidence/cil/0x0600063a_TeamScoringService_AddLedger.cil`
  - `evidence/cil/0x06000632_TeamScoringService_PkClockAt.cil`
  - `evidence/cil/0x06000633_TeamScoringService_PkGiftRules.cil`
  - `evidence/flows/flow_b_team_pk_scoring.json`

---

## 1. Sơ đồ Hoạt động & Kiến trúc Tính điểm (Pipeline Flowchart)

```
[Sự kiện Quà tặng TikTok Live]
       │
       ▼ (1) Tiếp nhận tại TeamScoringService.Gift (0x0600063c)
[TeamScoringService+<>c__DisplayClass25_0.<Gift>b__0 (0x06000a46)]
       │
       ├─────────────────────────────────────────┐
       ▼ (2) Lọc ID quà hệ thống & Kiểm tra giờ  ▼ (3) Lọc Diamond / Spam
[Kiểm tra Round Boundary & Valid Time]    [ID 9981 / 12210 check]
       │ (Hết giờ -> ném "invalid_time")         │ (Bỏ qua -> "ignored")
       ▼                                         ▼
[Xác định Thành viên Nhận quà (5 Tầng Phân cấp)]
  ├── Tầng 1: recipientOverride (Chỉ định trực tiếp từ Streamer)
  ├── Tầng 2: Khóa Combo (Giữ nguyên MemberId của combo streak đang chạy)
  ├── Tầng 3: Tra cứu sender_targets (Quy tắc người tặng đã gán trước)
  ├── Tầng 4: Tra cứu TeamPkGiftRule (Luật mục tiêu quà tặng của vòng đấu)
  └── Tầng 5: Chờ phân bổ thủ công (memberId = '', pending_gifts)
       │
       ▼ (4) Đọc Trạng thái Combo cũ từ SQLite
[TeamStore.ReadCombo: key = [group, sender, gift, comboId || "fallback"]]
       │
       ▼ (5) Thuật toán Tính Điểm Vi sai Tích lũy (Incremental Delta)
  deltaCoins = Math.Max(0, gift.Coins - existingCombo.Coins)
  deltaQuantity = Math.Max(0, gift.Quantity - existingCombo.Quantity)
  Nếu deltaQuantity == 0 -> deltaCoins = 0
       │
       ├─────────────────────────────────────────┐
       ▼ (6) Cập nhật Bản ghi Combo              ▼ (7) Ghi Sổ cái Doanh thu
[TeamStore.WriteCombo]                    [TeamScoringService.AddLedger (0x0600063a)]
  - set_Coins(Math.Max)                     - INSERT INTO ledger (committed_ledger)
  - set_Quantity(Math.Max)                  - coins = deltaCoins, qty = deltaQuantity
  - set_Closed(isFinished)                  - journal_id, member_id, occurred_at
       │                                         │
       └────────────────────┬────────────────────┘
                            ▼ (8)
          [TeamStore.Commit / Broadcast State]
```

---

## 2. Giải mã Chi tiết 5 Tầng Phân cấp Xác định Người Hưởng Quà (`Recipient`)

Trong CIL của phương thức closure `0x06000a46`, logic gán người nhận quà (`member_id`) được tổ chức thành 5 tầng ưu tiên nghiêm ngặt:

1. **Tầng 1: Streamer Ghi đè Trực tiếp (`recipientOverride`)**:
   - `IL_070e - IL_078b`: Kiểm tra tham số `recipientOverride`. Nếu streamer đã bấm chọn thành viên trên UI điều khiển, kiểm tra `MemberId` có nằm trong danh sách nhóm hiện tại (`group.get_Members()`). Nếu hợp lệ, gán `targetMemberId = override.MemberId`.
2. **Tầng 2: Khóa Chuỗi Combo Đang Tiếp diễn (Active Streak Target Locking)**:
   - `IL_0948 - IL_09a0`: Tra cứu `existingCombo = TeamStore.ReadCombo(...)`.
   - Nếu `existingCombo != null` và `existingCombo.get_TargetRule() == currentTargetRule`:
     - Giữ nguyên thành viên đã nhận các phần quà trước của combo này: `targetMemberId = existingCombo.get_MemberId()`.
     - *Ý nghĩa nghiệp vụ*: Đảm bảo khi một khán giả đang combo 100 hoa hồng cho Thành viên A, toàn bộ 100 hoa hồng đó sẽ thuộc về Thành viên A ngay cả khi streamer bấm chuyển nút chọn người khác giữa chừng.
3. **Tầng 3: Tra cứu Bảng Người tặng Trung thành (`sender_targets`)**:
   - `IL_0425 - IL_046c`:
     `SELECT member_id FROM sender_targets WHERE shift_id=$scope AND sender_id=$sender`
   - Nếu người tặng đã được cấu hình cố định tặng cho một thành viên cụ thể trong phiên live, quà sẽ tự động chuyển cho thành viên đó.
4. **Tầng 4: Bản đồ Mục tiêu Quà tặng Trận đấu (`TeamPkGiftRule`)**:
   - `IL_06e0 - IL_070c`:
     Tạo mảng tra cứu `["pk2", widget.get_WidgetId(), widget.get_RoundId(), gift.get_GiftId()]`.
     Ánh xạ theo luật quà riêng biệt của vòng PK (ví dụ: Tặng quà X tính cho Team 1, Tặng quà Y tính cho Team 2).
5. **Tầng 5: Chờ Phân bổ Thủ công (Unassigned Pending Ledger)**:
   - Nếu không thỏa mãn bất kỳ tầng nào ở trên: `member_id = ''`.
   - Bản ghi được đưa vào bảng `pending_gifts`. Streamer có thể phân bổ thủ công sau trận đấu qua giao diện `TeamManagerForm` (gọi câu lệnh `UPDATE ledger SET member_id=$member WHERE id=$id AND member_id=''`).

---

## 3. Bản chất Thuật toán Tính điểm & Combo (Bác bỏ Giả thuyết Multiplier)

### 3.1. Tại sao không có hệ số nhân Combo Multiplier?
Trong giao thức tương tác của TikTok Live, khi người xem tặng quà dạng combo (ví dụ: gõ liên tục vào nút quà), mỗi gói tin gửi về máy chủ mang **tổng số quà lũy tiến**:
- Nhịp 1: `coins = 1`, `quantity = 1`
- Nhịp 2: `coins = 2`, `quantity = 2`
- Nhịp 3: `coins = 3`, `quantity = 3`
- ...
- Nhịp 100: `coins = 100`, `quantity = 100`

Nếu ứng dụng cộng trực tiếp `gift.Coins` vào điểm số, tổng điểm sẽ bị đội lên thành `1 + 2 + 3 + ... + 100 = 5050` điểm thay vì `100` điểm thực tế.

### 3.2. Mã lệnh CIL Thực thi Phép trừ Vi sai
Tại các dòng lệnh `IL_09be` đến `IL_09fb`:
```csharp
// Đọc số xu và số lượng đã ghi nhận trước đó của combo này
long previousCoins = (existingCombo != null) ? existingCombo.Coins : 0L;
int previousQuantity = (existingCombo != null) ? existingCombo.Quantity : 0;

// Tính toán phần gia số thực tế phát sinh trong nhịp này
long deltaCoins = Math.Max(0L, gift.Coins - previousCoins);
int deltaQuantity = Math.Max(0, gift.Quantity - previousQuantity);

// Kiểm tra toàn vẹn: nếu không có số lượng mới tăng thêm, số xu gia số bằng 0
if (deltaQuantity == 0)
{
    deltaCoins = 0L;
}

// Cập nhật lại trạng thái combo mới nhất
TeamCombo updatedCombo = new TeamCombo
{
    JournalId = journalId,
    MemberId = targetMemberId,
    TargetRule = targetRule,
    Coins = Math.Max(gift.Coins, previousCoins),
    Quantity = Math.Max(gift.Quantity, previousQuantity),
    RoundId = currentRoundId,
    Closed = gift.IsComboFinished
};
store.WriteCombo(comboKey, updatedCombo);
```

---

## 4. Hệ thống Lưu trữ & Nhật ký SQLite Sổ cái (`TeamStore`)

### 4.1. Cấu trúc Bảng Sổ cái (`ledger`)
Tại `TeamScoringService.AddLedger` (`0x0600063a`):
```sql
INSERT INTO ledger (
    id, shift_id, group_id, channel, channel_uid, 
    member_id, sender_id, gift_id, coins, quantity, 
    occurred_at, round_id, kind, note, source, 
    widget_rounds, journal_id, deleted_at, revision, parts
) VALUES (
    $id, '', $group, $channel, $uid, 
    $member, $sender, $gift, $coins, $qty, 
    $time, '', $kind, $note, $source, 
    $rounds, $journal, '', 0, '{}'
);
```

### 4.2. View Tính điểm Thời gian thực (`live_channel_pk_income`)
Để phục vụ hiển thị tức thời trên widget OBS mà không bị nghẽn do khóa bảng SQLite, GGTT tạo một View tạm thời kết hợp giữa bảng chính và bảng tạm:
```sql
CREATE TEMP VIEW IF NOT EXISTS live_channel_pk_income AS
SELECT rowid AS sequence, id, channel, at, coins, sender_id FROM channel_pk_income
UNION ALL
SELECT rowid AS sequence, id, channel, at, coins, sender_id FROM pending_channel_pk_income;
```

---

## 5. Đặc tả Giao thức & Vector Kiểm thử Mẫu (Synthetic Test Vectors)

### 5.1. Kịch bản Kiểm thử 1: Chuỗi Combo Đơn giản (Normal Combo Sequence)
Khán giả `User_001` gửi quà Hoa hồng (1 xu/bông) theo combo 3 nhịp:

| Nhịp | Gói tin TikTok Input | `existingCombo` trước khi xử lý | `deltaCoins` được ghi vào Ledger | `existingCombo` sau khi cập nhật |
|:---:|---|---|---|---|
| 1 | `coins: 1, qty: 1, finished: false` | `null` (chưa có) | **+1 xu** | `coins: 1, qty: 1, closed: false` |
| 2 | `coins: 2, qty: 2, finished: false` | `coins: 1, qty: 1` | **+1 xu** | `coins: 2, qty: 2, closed: false` |
| 3 | `coins: 3, qty: 3, finished: true` | `coins: 2, qty: 2` | **+1 xu** | `coins: 3, qty: 3, closed: true` |

**Tổng xu thực tế ghi vào Sổ cái**: `1 + 1 + 1 = 3 xu` (Chính xác tuyệt đối 100%).

### 5.2. Kịch bản Kiểm thử 2: Gói tin Bị Lặp Mạng (Network Retransmission / Duplicate Packet)
Khán giả gửi combo nhịp 2 bị mạng gửi trùng lặp 2 lần:

| Nhịp | Gói tin TikTok Input | `existingCombo` trước khi xử lý | `deltaCoins` | Hành vi Xử lý |
|:---:|---|---|---|---|
| 2a | `coins: 2, qty: 2, finished: false` | `coins: 1, qty: 1` | **+1 xu** | Ghi nhận +1 xu |
| 2b | `coins: 2, qty: 2, finished: false` | `coins: 2, qty: 2` | **0 xu** | `deltaQty = 0 -> deltaCoins = 0`. Không bị nhân đôi điểm! |

---

## 6. Đánh giá Mức độ Hoàn thiện & Khuyến nghị Clean-Room

- **Mức độ xác minh**: **CONFIRMED 100%**. Thuật toán trừ vi sai tích lũy và cấu trúc 5 tầng phân bổ người nhận đã được trích xuất nguyên vẹn từ 1,125 lệnh CIL của closure `0x06000a46`.
- **Khuyến nghị cho Clean-Room**:
  - Triển khai SQLite ở chế độ `PRAGMA journal_mode = WAL;` và `PRAGMA synchronous = NORMAL;` để đảm bảo tốc độ chèn sổ cái đạt hàng nghìn bản ghi/giây mà không gây giật lag giao diện OBS.
  - Sử dụng đúng công thức `Math.Max(0, gift.Coins - existingCombo.Coins)` để triệt tiêu hoàn toàn lỗi nhân đôi điểm khi TikTok gửi lại gói tin combo.
