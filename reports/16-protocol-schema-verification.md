# Báo cáo Xác minh Lược đồ Giao thức Mạng & WebSocket (Phase 7 - Protocol Schema Verification)

- **Mã báo cáo**: `16-protocol-schema-verification.md`
- **Các thành phần giao thức**:
  1. **WebSocket Server**: Fleck RFC 6455 trên `ws://127.0.0.1:3784/ws`
  2. **Media Server**: `HttpListener` trên `http://*:6211/media/`
- **Phương thức CIL chịu trách nhiệm**: `0x060002ab`, `0x0600077d`, `0x06000311`, `0x060002a1`, `0x060002a6`, `0x060007f3`, `0x060002aa`

---

## 1. Giao thức WebSocket Overlay (`ws://127.0.0.1:3784/ws`)

### 1.1. Chu kỳ Kết nối & Nhận diện Client (Lifecycle & Handshake)
1. **Khởi tạo**: Máy chủ WebSocket lắng nghe trên tất cả địa chỉ cục bộ cổng 3784 (`ws://0.0.0.0:3784` hoặc `127.0.0.1:3784`).
2. **Sự kiện `OnOpen`**:
   - Khi client (OBS Browser Source / Widget HTML5) thiết lập kết nối thành công, delegate `0x0600077d` kích hoạt.
   - Máy chủ gửi ngay bản tin `SET_MACHINE_ID` xuống client mà không yêu cầu client gửi bất kỳ thông tin xác thực nào trước.
   - Socket được thêm vào danh sách quản lý `clients` được bảo vệ bởi khóa đồng bộ `Monitor.Enter(clientsLock)`.
3. **Sự kiện `OnClose` / `OnError`**:
   - Khóa `clientsLock` được kích hoạt để xóa socket khỏi danh sách.
   - Không có cơ chế thông báo trạng thái ngắt kết nối đến các client khác.

---

### 1.2. Định dạng Lược đồ JSON Chi tiết (Message Schemas)

#### Schema 1: `SET_MACHINE_ID` (Khởi tạo kết nối)
- **Chiều truyền**: Server -> Client
- **Thời điểm**: Ngay sau khi hoàn tất bắt tay RFC 6455
- **Mã CIL**: `0x0600077d` (`IL_0000 - IL_0025`)
- **JSON Schema (Draft-07)**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SetMachineIdMessage",
  "type": "object",
  "required": ["type", "machineId"],
  "properties": {
    "type": {
      "type": "string",
      "enum": ["SET_MACHINE_ID"]
    },
    "machineId": {
      "type": "string",
      "description": "Định danh phần cứng duy nhất của máy trạm chủ chạy GGTT"
    }
  },
  "additionalProperties": false
}
```

---

#### Schema 2: `TEAM_STATE_UPDATE` (Đồng bộ trạng thái bàn đấu & điểm số)
- **Chiều truyền**: Server -> Client
- **Thời điểm**: Được kích hoạt từ `SendTeamState` (`0x06000311`) với cơ chế giới hạn tần suất 250ms
- **JSON Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TeamStateUpdateMessage",
  "type": "object",
  "required": ["type", "round_id", "status", "teams", "timestamp"],
  "properties": {
    "type": {
      "type": "string",
      "enum": ["TEAM_STATE_UPDATE"]
    },
    "round_id": {
      "type": "string",
      "description": "Định danh round đấu PK hiện thời"
    },
    "status": {
      "type": "string",
      "enum": ["IDLE", "PREPARING", "RUNNING", "PAUSED", "FINISHED"]
    },
    "time_remaining_seconds": {
      "type": "integer",
      "minimum": 0
    },
    "teams": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "total_score", "members"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "total_score": { "type": "integer", "minimum": 0 },
          "members": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["id", "name", "score", "avatar_url"],
              "properties": {
                "id": { "type": "string" },
                "name": { "type": "string" },
                "score": { "type": "integer", "minimum": 0 },
                "avatar_url": { "type": "string" },
                "rank": { "type": "integer", "minimum": 1 }
              }
            }
          }
        }
      }
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Thời gian phát trạng thái chuẩn ISO 8601 UTC"
    }
  }
}
```

---

#### Schema 3: `GIFT_EVENT` (Thông báo hiệu ứng quà tặng thời gian thực)
- **Chiều truyền**: Server -> Client
- **Thời điểm**: Sau khi xử lý tính toán gia số delta > 0 thành công tại `0x06000a46`
- **JSON Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GiftEventMessage",
  "type": "object",
  "required": ["type", "gift_id", "gift_name", "sender", "recipient", "delta", "combo"],
  "properties": {
    "type": {
      "type": "string",
      "enum": ["GIFT_EVENT"]
    },
    "gift_id": { "type": "string" },
    "gift_name": { "type": "string" },
    "gift_image_url": { "type": "string" },
    "sender": {
      "type": "object",
      "required": ["user_id", "nickname", "avatar_url"],
      "properties": {
        "user_id": { "type": "string" },
        "nickname": { "type": "string" },
        "avatar_url": { "type": "string" }
      }
    },
    "recipient": {
      "type": "object",
      "required": ["member_id", "team_id"],
      "properties": {
        "member_id": { "type": "string" },
        "team_id": { "type": "string" }
      }
    },
    "delta": {
      "type": "object",
      "required": ["coins", "quantity"],
      "properties": {
        "coins": { "type": "integer", "minimum": 1 },
        "quantity": { "type": "integer", "minimum": 1 }
      }
    },
    "combo": {
      "type": "object",
      "required": ["combo_id", "current_count", "is_closed"],
      "properties": {
        "combo_id": { "type": "string" },
        "current_count": { "type": "integer", "minimum": 1 },
        "is_closed": { "type": "boolean" }
      }
    }
  }
}
```

---

#### Schema 4: `SCENARIO_TRIGGER` (Điều khiển kỹ xảo & hình phạt)
- **Chiều truyền**: Server -> Client
- **Thời điểm**: Kích hoạt từ `ScenarioEngine` khi thỏa mãn điều kiện va chạm, mốc điểm hoặc lệnh điều khiển
- **JSON Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ScenarioTriggerMessage",
  "type": "object",
  "required": ["type", "action", "asset_url"],
  "properties": {
    "type": {
      "type": "string",
      "enum": ["SCENARIO_TRIGGER"]
    },
    "action": {
      "type": "string",
      "enum": ["PLAY_VIDEO", "SHOW_IMAGE", "TRIGGER_SOUND", "SPAWN_EFFECT", "PUNISHMENT_ALERT"]
    },
    "asset_url": {
      "type": "string",
      "description": "URL media trỏ về server cục bộ cổng 6211 (e.g. http://localhost:6211/media/effects/boom.webm)"
    },
    "duration_ms": { "type": "integer", "minimum": 0 },
    "layer": { "type": "integer", "default": 0 },
    "chroma_key": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean" },
        "key_color": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" }
      }
    }
  }
}
```

---

## 2. Giao thức Máy chủ HTTP Media Cục bộ (`http://127.0.0.1:6211/media/`)

### 2.1. Cơ chế Khởi tạo, Bắt Xung đột Cổng và Nhảy Cổng (Port Hopping)
Phương thức CIL `StartMediaServerCore::MoveNext` (`0x060007f3`) thể hiện thuật toán gắn cổng như sau:

```
                  StartMediaServerCore(rootFolder, port=6211, retry=0)
                                          |
                                          v
                      Create HttpListener and Add Prefix:
                         "http://localhost:<port>/media/"
                                          |
                                          v
                                   listener.Start()
                                          |
                        +-----------------+-----------------+
                        | (Success)                         | (HttpListenerException)
                        v                                   v
             TestServer(port) succeeds?              retry >= 3 ?
                        |                                   |
             +----------+----------+             +----------+----------+
             | Yes                 | No          | Yes                 | No
             v                     v             v                     v
      Server Started!         Stop & Close   Return Failure    Task.Delay(300ms)
    BoundPort = <port>        Return Error                         |
                                                                   v
                                                     StartMediaServerCore(
                                                         rootFolder,
                                                         port + 1,
                                                         retry + 1
                                                     )
```

- **Cổng cơ sở (Base Port)**: `6211`
- **Cổng tối đa có thể nhảy tới**: `6214` (tương ứng với 3 lần thử lại)
- **Độ trễ phục hồi xung đột**: `300ms`

---

### 2.2. Bảng Tra cứu MIME Type Cố định (14 Định dạng CIL)
Trong `GetMimeType` (`0x060002aa`), switch table xử lý chính xác 14 phần mở rộng tệp tin:

| STT | Phần mở rộng (Extension) | MIME Type Header Trả về | Danh mục tài nguyên |
|---|---|---|---|
| 1 | `.mp4` | `video/mp4` | Hiệu ứng kỹ xảo video, nền động |
| 2 | `.webm` | `video/webm` | Video hỗ trợ kênh trong suốt (Alpha channel) |
| 3 | `.mp3` | `audio/mpeg` | Âm thanh hiệu ứng, nhạc nền |
| 4 | `.wav` | `audio/wav` | Âm thanh thông báo ngắn |
| 5 | `.ogg` | `audio/ogg` | Âm thanh nén Vorbis |
| 6 | `.png` | `image/png` | Avatar streamer, icon quà tặng |
| 7 | `.jpg` | `image/jpeg` | Hình ảnh tĩnh |
| 8 | `.jpeg` | `image/jpeg` | Hình ảnh tĩnh |
| 9 | `.gif` | `image/gif` | Ảnh động hiệu ứng |
| 10 | `.webp` | `image/webp` | Ảnh nén chất lượng cao |
| 11 | `.json` | `application/json` | Cấu hình Live2D model, widget layout |
| 12 | `.atlas` | `text/plain` | Texture atlas cho mô hình Spine/Live2D |
| 13 | `.moc3` | `application/octet-stream` | File nhị phân mô hình Live2D Cubism 3/4 |
| 14 | `.css` | `text/css` | Định dạng style cho widget HTML5 |
| - | *Mọi đuôi khác* | `application/octet-stream` | Luồng nhị phân chung |

---

## 3. Khả năng Tương thích Ngược & Quy tắc Clean-Room

1. **Không yêu cầu xác thực kết nối WebSocket**: Client kết nối được coi là widget hiển thị được phép truy cập cục bộ. Không thêm bắt tay bảo mật phức tạp làm hỏng widget HTML5 hiện có.
2. **Tuân thủ đúng cổng mặc định**: Ưu tiên cao nhất là bind đúng cổng `3784` cho WebSocket và `6211` cho HTTP. Nếu bị chiếm cổng, phải thông báo URL cập nhật đầy đủ (kèm cổng mới) ra giao diện quản trị để người dùng cấu hình lại OBS.
3. **CORS Headers**: Máy chủ HTTP media phải trả về `Access-Control-Allow-Origin: *` để trình duyệt OBS không chặn tài nguyên hình ảnh/video khi nạp chéo nguồn.
