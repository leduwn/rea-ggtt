# Giao thức Kết nối WebSocket Cục bộ & Hiển thị Overlay (Pipeline C - Local WebSocket & Overlay Pipeline)

- **Thời gian lập**: 2026-11-11
- **Phân hệ**: Tầng Giao tiếp Thời gian thực & Máy chủ Đa phương tiện Cục bộ (`GGTT.Google_Tiktok_Form`, `Fleck`, `System.Net.HttpListener`)
- **Tài liệu tham chiếu**:
  - `evidence/cil/0x060002ab_Google_Tiktok_Form_StartWebSocketServer.cil`
  - `evidence/cil/0x060007f5_StartWebSocketServer_MoveNext.cil`
  - `evidence/cil/0x0600077a__StartWebSocketServer_b__0.cil`
  - `evidence/cil/0x0600077d__StartWebSocketServer_b__1.cil`
  - `evidence/cil/0x0600077b__StartWebSocketServer_b__2.cil`
  - `evidence/cil/0x0600077e__StartWebSocketServer_b__3.cil`
  - `evidence/cil/0x060002a1_Google_Tiktok_Form_SendSocketMessageAsync.cil`
  - `evidence/cil/0x060007e9_SendSocketMessageAsync_MoveNext.cil`
  - `evidence/cil/0x06000311_Google_Tiktok_Form_SendTeamState.cil`
  - `evidence/cil/0x060002a6_Google_Tiktok_Form_StartMediaServerCore.cil`
  - `evidence/cil/0x060007f3_StartMediaServerCore_MoveNext.cil`
  - `evidence/cil/0x060007ab_HandleRequests_MoveNext.cil`
  - `evidence/cil/0x060002aa_Google_Tiktok_Form_GetMimeType.cil`
  - `evidence/flows/flow_c_websocket_overlay.json`

---

## 1. Sơ đồ Kiến trúc & Luồng Truyền phát Dữ liệu Đa máy chủ (Dual-Server Pipeline)

```
+========================================================================================+
|                                    ỨNG DỤNG GGTT CORE                                  |
|                                                                                        |
|  [Dịch vụ Kế toán / Live PK]                                                          |
|               │                                                                        |
|               ▼                                                                        |
|  [Google_Tiktok_Form.SendTeamState (0x06000311)]                                       |
|    - Điều tiết tần số gửi (Throttling 250ms window)                                    |
|    - Trích xuất TeamSnapshot, TeamAccess, TeamAllowed                                  |
|               │                                                                        |
|               ├──────────────────────────────────────────────┐                         |
|               ▼                                              ▼                         |
|  [Fleck WebSocket Server (Port 3784)]          [HttpListener Media Server (Port 6211)]  |
|    - Khởi tạo: StartWebSocketServer (0x060002ab)  - Khởi tạo: StartMediaServerCore     |
|    - Địa chỉ: ws://127.0.0.1:3784/ws              - URL: http://localhost:6211/media/  |
|    - Lọc đường dẫn: Path == "/ws"                - Tự động nhảy cổng: port+1 (tối đa 3)|
|    - Bắt tay xác thực: SET_MACHINE_ID            - Quản lý luồng: HandleRequests       |
|    - Phát sóng: SendSocketMessageAsync           - Phân giải MIME: GetMimeType (14 đuôi)|
+===============│==============================================│=========================+
                │ (JSON Event State)                           │ (Static Media Assets)
                ▼                                              ▼
+========================================================================================+
|                             OBS STUDIO (BROWSER SOURCE OVERLAY)                        |
|                                                                                        |
|  - Kết nối WebSocket tới ws://127.0.0.1:3784/ws                                        |
|  - Nhận bản tin JSON ("team_state", "gift_effect", "pk_score")                         |
|  - Tải tài nguyên đồ họa từ http://localhost:6211/media/asset.ext                      |
|  - Render HTML5 Canvas, WebGL, Live2D Cubism (.moc3 / .atlas), Video MP4/WebM          |
+========================================================================================+
```

---

## 2. Chi tiết Giải mã CIL: WebSocket Server (Port 3784)

### 2.1. Khởi tạo & Đăng ký Lắng nghe (`StartWebSocketServer`, Token `0x060002ab`)
- Thực thi thông qua máy trạng thái bất đồng bộ `<StartWebSocketServer>d__69` (`0x060007f5`):
  - `IL_0055 - IL_006b`: Ghép chuỗi URL lắng nghe:
    `"ws://" + websocketip + ":" + websocketport` (mặc định: `ws://127.0.0.1:3784`).
  - `IL_0072 - IL_0076`: Khởi tạo thực thể `Fleck.WebSocketServer`:
    `new WebSocketServer("ws://127.0.0.1:3784", true)`.
  - `IL_00f7`: Ghi log chẩn đoán qua `AppLogger.Write`:
    `"✅ WebSocket server đang chạy tại ws://127.0.0.1:3784/ws"`.
  - `IL_010c - IL_011d`: Bơm mã JavaScript kích hoạt WebSocket client phía WebView2:
    `websocket_start('ws://127.0.0.1:3784/ws')`.

### 2.2. Kiểm soát Kết nối & Lọc Đường dẫn Hợp lệ (`<StartWebSocketServer>b__0`, Token `0x0600077a`)
Khi có kết nối WebSocket từ OBS Browser Source gửi tới:
- `IL_0006 - IL_0019`:
  ```csharp
  if (socket.ConnectionInfo.Path != "/ws")
  {
      socket.Close();
      return;
  }
  ```
  *Bảo mật giao thức*: Chỉ chấp nhận các kết nối trỏ thẳng tới endpoint `/ws`. Mọi truy cập vào root `/` hoặc path khác đều bị đóng ngay lập tức.
- Thiết lập 4 hàm phản hồi sự kiện (Delegates):
  - `set_OnOpen` -> Gọi closure `0x0600077c`
  - `set_OnMessage` -> Gọi closure `0x0600077d`
  - `set_OnClose` -> Gọi closure `0x0600077e`
  - `set_OnError` -> Ghi log lỗi kết nối.

### 2.3. Bắt tay Xác thực Máy trạm & Quản lý Danh sách Phiên (`0x0600077d` & `0x0600077e`)
- **Nhận thông điệp handshake** (`0x0600077d`):
  - Client gửi gói tin có prefix `"SET_MACHINE_ID"`.
  - Khóa đồng bộ đa luồng: `Monitor.Enter(clientsLock)`.
  - Thêm client vào danh sách `activeClients.Add(socket)`.
  - Mở khóa: `Monitor.Exit(clientsLock)`.
- **Ngắt kết nối** (`0x0600077e`):
  - `Monitor.Enter(clientsLock)`.
  - Xóa client khỏi danh sách: `activeClients.Remove(socket)`.
  - `Monitor.Exit(clientsLock)`.

### 2.4. Phát sóng Thông điệp Bất đồng bộ (`SendSocketMessageAsync`, Token `0x060002a1`)
- Thực thi qua máy trạng thái `<SendSocketMessageAsync>d__50` (`0x060007e9`):
  - `IL_000e - IL_001a`: Kiểm tra trạng thái sẵn sàng của kết nối:
    `if (client.IsAvailable)`
  - `IL_0028 - IL_0039`: Gửi chuỗi tin bất đồng bộ:
    `await client.Send(message);`
  - `IL_007f - IL_0099`: Bắt ngoại lệ và ghi log lỗi:
    `catch (Exception ex) { AppLogger.Error("Không gửi được WebSocket message", ex); }`

---

## 3. Chi tiết Giải mã CIL: Máy chủ Đa phương tiện HTTP (Port 6211)

### 3.1. Khởi động Máy chủ Tĩnh (`StartMediaServerCore`, Token `0x060002a6`)
- Thực thi qua máy trạng thái `<StartMediaServerCore>d__63` (`0x060007f3`):
  - Lắng nghe qua tiền tố: `"http://*:" + port + "/media/"` (cổng mặc định `6211`).
  - Khởi tạo `System.Net.HttpListener`:
    `mediaListener = new HttpListener();`
    `mediaListener.Prefixes.Add("http://*:" + port + "/media/");`
    `mediaListener.Start();`
  - **Cơ chế Tự động Nhảy Cổng Khi Bị Chiếm Dụng (Port Conflict Auto-Fallback)**:
    - Nếu cổng 6211 đã bị ứng dụng khác chiếm dụng hoặc không đủ quyền Administrator (`HttpListenerException`):
    - Đặt tiền tố dự phòng: `"http://localhost:" + port + "/media/"`.
    - Nếu vẫn thất bại và `retry < 3`: Chờ 300ms (`Task.Delay(300)`), thử lại với `port = port + 1` (ví dụ: `6211 -> 6212 -> 6213`).

### 3.2. Vòng lặp Xử lý Yêu cầu Tệp (`<HandleRequests>d__64`, Token `0x060007ab`)
- Sử dụng vòng lặp bất đồng bộ không chặn luồng giao diện:
  ```csharp
  while (mediaListener.IsListening)
  {
      HttpListenerContext context = await mediaListener.GetContextAsync();
      Task.Run(() => ServeFile(context, rootFolder));
  }
  ```

### 3.3. Ma trận Phân giải MIME Type (`GetMimeType`, Token `0x060002aa`)
Được giải mã hoàn chỉnh từ 173 lệnh CIL dạng cây chuyển mạch `switch`:

| Đuôi Tệp (Extension) | MIME Type Phản hồi | Mục đích Sử dụng trong GGTT |
|---|---|---|
| `.mp4` | `video/mp4` | Video hiệu ứng nền, kỹ xảo quà tặng cao cấp |
| `.webm` | `video/webm` | Video hiệu ứng kênh trong suốt (Alpha Channel) |
| `.mov` | `video/quicktime` | Video đồ họa Apple QuickTime Animation |
| `.mp3` | `audio/mpeg` | Âm thanh thông báo quà tặng, nhạc nền PK |
| `.wav` | `audio/wav` | Âm thanh hiệu ứng va chạm, tiếng đếm ngược |
| `.ogg` | `audio/ogg` | Âm thanh nén Ogg Vorbis |
| `.m4a` | `audio/mp4` | Âm thanh AAC |
| `.jpg` / `.jpeg` | `image/jpeg` | Ảnh avatar streamer, người tặng |
| `.png` | `image/png` | Icon quà tặng, khung avatar trong suốt |
| `.gif` | `image/gif` | Ảnh động hiệu ứng cơ bản |
| `.webp` | `image/webp` | Ảnh đại diện tối ưu hóa dung lượng từ CDN TikTok |
| `.json` | `application/json` | Dữ liệu cấu hình kịch bản kỹ xảo Scenario |
| `.moc3` | `application/octet-stream` | **Mô hình nhân vật ảo Live2D Cubism 3/4** |
| `.atlas` | `text/plain` | **Bản đồ tọa độ họa tiết Live2D Texture Atlas** |
| *Khác* | `application/octet-stream` | Phản hồi mặc định (Binary stream) |

---

## 4. Cơ chế Điều tiết Nhịp gửi Trạng thái (`SendTeamState`, Token `0x06000311`)

### 4.1. Thuật toán Throttling & Debounce 250ms
Trong các trận live PK có hàng nghìn lượt tương tác quà/giây, việc phát sóng WebSocket liên tục sẽ làm quá tải OBS Browser Source và gây hiện tượng drop FPS khi stream.
Phương thức `SendTeamState` triển khai cơ chế điều tiết nhịp gửi như sau:
```csharp
if ((DateTime.UtcNow - teamLastStateSent).TotalMilliseconds < 250)
{
    // Nếu chưa có lịch gửi trễ được xếp hàng, kích hoạt gửi trễ
    if (!teamStatePending)
    {
        teamStatePending = true;
        SendDelayedTeamStateAsync(); // Đợi cửa sổ 250ms kết thúc mới gửi bản mới nhất
    }
    return; // Bỏ qua nhịp gửi tức thời
}

// Cập nhật mốc thời gian gửi gần nhất
teamLastStateSent = DateTime.UtcNow;

// Đóng gói và phát sóng tức thời
var payload = new TeamStateMessage
{
    Type = "team_state",
    Snapshot = TeamSnapshot(),
    Access = teamAccess,
    Allowed = TeamAllowed,
    Receiving = TeamReceiving
};
PostWebMessageAsJson(payload);
BroadcastToWebSocketClients(payload);
```

---

## 5. Đặc tả Giao thức Thông điệp WebSocket (Message Protocol Specification)

### 5.1. Định dạng Thông điệp Đồng bộ Điểm PK (`team_state`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TeamStateMessage",
  "type": "object",
  "required": ["type", "snapshot", "timestamp"],
  "properties": {
    "type": { "type": "string", "const": "team_state" },
    "timestamp": { "type": "integer" },
    "access": { "type": "boolean" },
    "allowed": { "type": "boolean" },
    "receiving": { "type": "boolean" },
    "snapshot": {
      "type": "object",
      "required": ["roundId", "status", "teams", "timeRemaining"],
      "properties": {
        "roundId": { "type": "string" },
        "status": { "type": "string", "enum": ["idle", "matching", "in_round", "overtime", "ended"] },
        "timeRemaining": { "type": "integer", "minimum": 0 },
        "teams": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["teamId", "teamName", "totalScore", "members"],
            "properties": {
              "teamId": { "type": "string" },
              "teamName": { "type": "string" },
              "totalScore": { "type": "integer", "minimum": 0 },
              "members": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": ["memberId", "name", "score"],
                  "properties": {
                    "memberId": { "type": "string" },
                    "name": { "type": "string" },
                    "avatar": { "type": "string" },
                    "score": { "type": "integer", "minimum": 0 }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### 5.2. Vector Kiểm thử Mẫu (Synthetic Test Vectors)

#### Vector 1: Gói tin Cập nhật Điểm Đấu Nhóm (Team State Broadcast)
```json
{
  "type": "team_state",
  "timestamp": 1731308430,
  "access": true,
  "allowed": true,
  "receiving": true,
  "snapshot": {
    "roundId": "round_20261111_01",
    "status": "in_round",
    "timeRemaining": 185,
    "teams": [
      {
        "teamId": "team_red",
        "teamName": "Team Đỏ",
        "totalScore": 15200,
        "members": [
          { "memberId": "m_01", "name": "ThuThao", "avatar": "http://localhost:6211/media/avatars/thuthao.webp", "score": 9200 },
          { "memberId": "m_02", "name": "NgocMai", "avatar": "http://localhost:6211/media/avatars/ngocmai.webp", "score": 6000 }
        ]
      },
      {
        "teamId": "team_blue",
        "teamName": "Team Xanh",
        "totalScore": 14100,
        "members": [
          { "memberId": "m_03", "name": "HoangYen", "avatar": "http://localhost:6211/media/avatars/hoangyen.webp", "score": 8500 },
          { "memberId": "m_04", "name": "KimAnh", "avatar": "http://localhost:6211/media/avatars/kimanh.webp", "score": 5600 }
        ]
      }
    ]
  }
}
```

---

## 6. Đánh giá Mức độ Hoàn thiện & Khuyến nghị Clean-Room

- **Mức độ xác minh**: **CONFIRMED 100%**. Mọi cổng mạng (3784, 6211), thuật toán lọc `/ws`, bắt tay `SET_MACHINE_ID`, cơ chế nhảy cổng `port+1`, bảng 14 MIME types, và logic điều tiết 250ms đều đã được trích xuất nguyên vẹn từ mã máy CIL.
- **Khuyến nghị cho Clean-Room**:
  - Đối với Media Server: Thay thế `HttpListener` bằng Kestrel (`Microsoft.AspNetCore.Server.Kestrel`) trên .NET 9/10 hoặc Axum/Actix trên Rust để hỗ trợ HTTP/2 và HTTP Range Requests (giúp tua và đệm video MP4/WebM mượt mà trên OBS).
  - Đối với WebSocket Server: Duy trì đúng định dạng thông điệp `team_state` và tần số 4 Hz (250ms) để tương thích hoàn toàn với tất cả các widget OBS hiện có của GGTT.
