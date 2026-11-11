# Báo cáo Đặc tả Hợp đồng Hành vi Được Xác minh (Phase 7 - Verified Behavior Contracts)

- **Mã báo cáo**: `14-verified-behavior-contracts.md`
- **Phiên bản chuẩn hóa**: 1.0.0 (Clean-Room Spec Ready)
- **Cơ sở phân tích**: Mã máy ECMA-335 CIL của 36 phương thức lõi trong `GGTT.dll` (v1.1.4.12)
- **Tệp định danh nguồn**: `evidence/phase7/contract-provenance.json`

---

## 1. Pipeline A: Hợp đồng Thu thập Dữ liệu Sự kiện TikTok Live (TikTok Ingestion Contract)

### 1.1. Ranh giới Kiến trúc & Cơ chế Cầu nối (IPC Bridge)
Pipeline A là giao diện giữa engine trình duyệt nhúng (`Microsoft.Web.WebView2.WinForms.WebView2`) và tiến trình WinForms quản lý.
- **Tiêm kịch bản nhúng**: Được kích hoạt tại `Google_Tiktok_Form::InitBrowser_TT` (`0x060002c9`) và `InjectEmbeddedScriptAsync` (`0x06000300`).
- **Xác thực toàn vẹn kịch bản**: Lớp `EmbeddedScriptLoader::Validate` (`0x06000295`) kiểm tra kích thước (< 1MB) và tính băm SHA-256 đối chiếu với danh sách tin cậy.
- **Kênh truyền tin IPC**: Sử dụng API chuẩn `window.chrome.webview.postMessage(JSON.stringify(payload))` bên trong trình duyệt và bắt sự kiện qua handler `webView21_WebMessageReceived_1` (`0x060002d2`).

### 1.2. Phân loại Trường Dữ liệu Hợp đồng (Data Field Provenance)

Mã CIL trong `0x060002d2` và bộ giải mã sự kiện chấp nhận cấu trúc JSON với sự phân biệt rõ ràng giữa 3 nhóm trường:

#### A. Trường Nghiệp vụ TikTok Chuẩn (Client-Accepted Fields)
Các trường này được trích xuất trực tiếp từ luồng WebSocket/Protobuf của TikTok Live trên web frontend:
| Tên trường | Kiểu dữ liệu | Vai trò nghiệp vụ | Hành vi xác thực CIL |
|---|---|---|---|
| `type` | `string` | Bộ phân loại sự kiện (`gift`, `comment`, `like`, `member`) | `0x060002d2` kiểm tra chuỗi để dispatch sang service tương ứng |
| `gift_id` | `string` | Định danh danh mục quà tặng TikTok | Sử dụng để tra cứu cấu hình điểm trong `TeamPkGiftRule` |
| `gift_name` | `string` | Tên hiển thị quà tặng (e.g. "Rose", "Galaxy") | Cập nhật vào đối tượng `TeamGift` và lưu nhật ký |
| `diamond_count` | `int32` | Giá trị kim cương / xu đơn vị cho 1 quà | Gán vào `gift.Coins` nếu `repeat_count == 1` |
| `repeat_count` | `int32` | Số lượng quà cộng dồn trong streak combo hiện tại | Gán vào `gift.Quantity` |
| `combo_count` | `int32` | Số chuỗi combo liên tiếp do TikTok gán | Gán vào `gift.ComboCount` |
| `user_id` | `string` | ID định danh người gửi quà (UID số) | Dùng để tra cứu bảng `sender_targets` |
| `nickname` | `string` | Tên hiển thị người gửi | Lưu trữ trong `TeamGift.SenderName` |
| `avatar_url` | `string` | URL ảnh đại diện của người gửi | Cập nhật avatar streamer / sender trên overlay |
| `sec_uid` | `string` | Mã định danh bảo mật của TikTok (`MS4wLj...`) | Gán vào `TeamGift.SecUid` |
| `timestamp` | `int64` | Dấu thời gian sự kiện (Unix Epoch Milliseconds) | Chuyển đổi thành ISO 8601 UTC string (`"O"`) |

#### B. Trường Bổ sung từ Hook Nhúng (Injected Hook Fields)
Được sinh ra trực tiếp bởi đoạn mã JavaScript hook `window.__ggttEmbeddedCode`:
| Tên trường | Kiểu dữ liệu | Nguồn gốc sinh dữ liệu | Mục đích sử dụng trong GGTT |
|---|---|---|---|
| `client_time` | `int64` | `Date.now()` thực thi trong JS | Đo độ trễ IPC giữa JS hook và C# host |
| `page_url` | `string` | `window.location.href` | Xác định phòng live đang theo dõi |
| `session_uuid` | `string` | `crypto.randomUUID()` trong JS | Định danh phiên chạy hook trình duyệt |

#### C. Trường Ngoại vi Bị Bỏ qua (Unverified / Dropped Fields)
- `to_user_id`: Mặc dù TikTok Live protobuf chứa trường ID người nhận phòng live, GGTT **hoàn toàn bỏ qua trường này trong CIL**. GGTT tự quản lý toàn bộ logic phân bổ người nhận thông qua thuật toán 5 tầng nội bộ (`Recipient`).
- `trace_id` / `log_pb`: Metadata truy vết của máy chủ TikTok bị loại bỏ trước khi truyền qua cầu nối IPC.

---

## 2. Pipeline B: Hợp đồng Kế toán Điểm PK & Combo Streak (PK Scoring & Combo Accounting Contract)

### 2.1. Kiến trúc Cơ sở Dữ liệu & State Machine
Pipeline B được hiện thực hóa qua `TeamScoringService` (`0x06000a46`) và `TeamStore` (`0x060004ab`, `0x060004ac`, `0x060004ae`):

```
                   +-----------------------+
                   | Incoming Gift Packet  |
                   +-----------+-----------+
                               |
                               v
                   +-----------------------+
                   | 5-Tier Recipient Rule | ---> member_id
                   +-----------+-----------+
                               |
                               v
                     ReadCombo(comboKey)
                               |
            +------------------+------------------+
            | (Found in pending_combos or combos)  | (Not found)
            v                                     v
    existingCombo != null                 existingCombo = null
            |                                     |
            v                                     v
    Check Closed & ComboId                 previousCoins = 0
            |                              previousQuantity = 0
            +------------------+------------------+
                               |
                               v
                    Delta Calculation (Math.Max)
                    deltaCoins = Max(0, Coins - prevCoins)
                    deltaQuantity = Max(0, Qty - prevQty)
                    if (deltaQuantity == 0) deltaCoins = 0
                               |
            +------------------+------------------+
            | (deltaCoins > 0)                    | (deltaCoins == 0)
            v                                     v
    Apply Team Score                     Drop live score update
    Insert pending_gifts
            |
            v
    WriteCombo(comboKey, updatedCombo)
    - If Closed == false: Upsert pending_combos
    - If Closed == true:  Upsert combos & DELETE pending_combos
            |
            v (On Combo Closed or Finalize)
    CommitGiftCombo(journalId)
    - Read pending_gifts ORDER BY occurred_at, rowid
    - Insert/Update ledger
    - Delete pending_gifts
```

### 2.2. Hợp đồng Tính Toán Gia số (Delta Arithmetic Contract)
Mọi phép tính điểm trong CIL (`0x06000a46`, `IL_09e0` - `IL_0a35`) đều tuân theo hợp đồng bất biến:
1. `deltaCoins = Math.Max(0, gift.Coins - existingCombo.Coins)`
2. `deltaQuantity = Math.Max(0, gift.Quantity - existingCombo.Quantity)`
3. `if (deltaQuantity == 0) { deltaCoins = 0; }`
4. `existingCombo.Coins = gift.Coins; existingCombo.Quantity = gift.Quantity;`
5. `if (gift.ComboId != "") { existingCombo.ComboId = gift.ComboId; }`

### 2.3. Hợp đồng Chốt Sổ Kế toán (`CommitGiftCombo`)
Phương thức `TeamStore::CommitGiftCombo` (`0x060004ae`) thực hiện hợp đồng chốt dữ liệu từ hàng chờ tạm `pending_gifts` vào sổ cái vĩnh viễn `ledger`:
- **Gộp sự kiện**: Gom tất cả các phần tử con thành mảng JSON `parts` chứa `events`.
- **Phân định người nhận**:
  - Nếu tất cả các phần quà trong combo đều gán cho đúng 1 thành viên (`distinct_members.Length == 1` tại `IL_0238`), trường `member_id` của bản ghi `ledger` mang ID thành viên đó.
  - Nếu có sự phân tán nhiều người nhận trong cùng một journal ID, trường `member_id` của `ledger` được đặt thành chuỗi rỗng `""`, và chi tiết từng người nhận được bảo toàn trong JSON `parts`.
- **Tổng hòa điểm**: Điểm xu (`$coins`) và số lượng (`$quantity`) trong bản ghi `ledger` là tổng tích lũy chính xác từ danh sách các phần tử đã cộng dồn.

---

## 3. Pipeline C: Hợp đồng Giao thức WebSocket Overlay & Media Server

### 3.1. Hợp đồng Máy chủ WebSocket (`ws://127.0.0.1:3784/ws`)
- **Engine**: Fleck RFC 6455 WebSocket Server (`0x060002ab`).
- **Giao thức thông điệp**: JSON Text Frame qua WebSocket connection.
- **Sự kiện kết nối (`OnOpen`)**:
  - Gửi ngay lập tức bản tin nhận diện:
    ```json
    {
      "type": "SET_MACHINE_ID",
      "machineId": "<MAC_OR_HARDWARE_UUID>"
    }
    ```
- **Hạn chế tần suất phát trạng thái (`SendTeamState`)**:
  - Thuật toán Throttle: Kiểm tra `(DateTime.UtcNow - teamLastStateSent).TotalMilliseconds < 250.0`.
  - Ngoại lệ: Nếu cờ `forceUpdate == true` được truyền vào, bỏ qua kiểm tra 250ms và phát ngay lập tức.
- **Cấu trúc bản tin đồng bộ bàn đấu (`TEAM_STATE_UPDATE`)**:
  ```json
  {
    "type": "TEAM_STATE_UPDATE",
    "round_id": "rnd_20261111_001",
    "status": "RUNNING",
    "time_remaining": 180,
    "teams": [
      {
        "id": "team_a",
        "name": "Team Đỏ",
        "score": 15420,
        "members": [
          {"id": "m1", "name": "Streamer 1", "score": 10200, "avatar": "http://localhost:6211/media/avatars/m1.png"}
        ]
      }
    ]
  }
  ```

### 3.2. Hợp đồng Máy chủ HTTP Media Cục bộ (`http://127.0.0.1:6211/media/`)
- **Engine**: `System.Net.HttpListener` (`0x060002a6`, `0x060007f3`).
- **Prefix đăng ký**: `http://localhost:6211/media/` hoặc `http://*:6211/media/`.
- **Khả năng chịu lỗi xung đột cổng**:
  - Bắt lỗi `HttpListenerException` khi cổng bị chiếm dụng.
  - Số lần thử lại tối đa: 3 lần (`retry < 3`).
  - Độ trễ giữa các lần thử lại: 300ms (`Task.Delay(300)`).
  - Cổng thay thế: `base_port + retry` (tối đa tới cổng 6214).
- **Hợp đồng Content-Type Header (14 định dạng cố định)**:
  Phục vụ tĩnh trực tiếp từ thư mục cài đặt / tài nguyên media:
  - Video: `.mp4` -> `video/mp4`, `.webm` -> `video/webm`
  - Âm thanh: `.mp3` -> `audio/mpeg`, `.wav` -> `audio/wav`, `.ogg` -> `audio/ogg`
  - Hình ảnh: `.png` -> `image/png`, `.jpg` / `.jpeg` -> `image/jpeg`, `.gif` -> `image/gif`, `.webp` -> `image/webp`
  - Dữ liệu Live2D & Giao diện: `.json` -> `application/json`, `.atlas` -> `text/plain`, `.moc3` -> `application/octet-stream`, `.css` -> `text/css`
  - Mọi định dạng khác -> Mặc định trả về `application/octet-stream`.

---

## 4. Bảng Tổng hợp Ma trận Hợp đồng Hành vi (Behavior Contract Matrix)

| Pipeline | Hợp đồng chức năng | Phương thức chịu trách nhiệm | Trạng thái xác thực CIL |
|---|---|---|---|
| **Pipeline A** | Tiếp nhận quà tặng và giải mã trường chuẩn | `0x060002d2` (`webView21_WebMessageReceived_1`) | **CONFIRMED** |
| **Pipeline A** | Loại bỏ trường TikTok ngoại vi (`to_user_id`) | `0x060002d2` | **CONFIRMED** |
| **Pipeline A** | Xác thực băm kịch bản nhúng SHA-256 | `0x06000295` (`EmbeddedScriptLoader::Validate`) | **CONFIRMED** |
| **Pipeline B** | Phân bổ người nhận theo thứ tự 5 tầng | `0x06000a46`, `0x0600049d` | **CONFIRMED** |
| **Pipeline B** | Tính toán gia số phép trừ (Delta Math.Max) | `0x06000a46` (`Gift_b0`) | **CONFIRMED** |
| **Pipeline B** | Không có hệ số nhân (No combo multiplier) | `0x06000a46` | **CONFIRMED** |
| **Pipeline B** | Tách bạch bảng `pending_combos` và `combos` | `0x060004ab`, `0x060004ac` | **CONFIRMED** |
| **Pipeline B** | Gom sổ cái và dọn hàng chờ `pending_gifts` | `0x060004ae` (`CommitGiftCombo`) | **CONFIRMED** |
| **Pipeline C** | Bản tin bắt tay `SET_MACHINE_ID` khi mở kết nối | `0x0600077d` (`StartWebSocketServer_b1`) | **CONFIRMED** |
| **Pipeline C** | Giới hạn phát trạng thái 250ms (Debounce) | `0x06000311` (`SendTeamState`) | **CONFIRMED** |
| **Pipeline C** | Nhảy cổng tự động +1 tối đa 3 lần trên HTTP media | `0x060007f3` (`StartMediaServerCore_MoveNext`) | **CONFIRMED** |
| **Pipeline C** | Bảng tra cứu 14 loại MIME cố định | `0x060002aa` (`GetMimeType`) | **CONFIRMED** |
