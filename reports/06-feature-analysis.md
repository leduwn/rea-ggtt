# Báo cáo Phân tích Tính năng Nghiệp vụ (Phase 4 - Feature Reconstruction Analysis)

- **Thời gian thực hiện**: 2026-11-11
- **Target**: `C:\Program Files (x86)\GGTT\GGTT.exe` & `GGTT.dll`
- **Tài liệu tham chiếu**: [02-binary-inventory.md](02-binary-inventory.md), [03-technology-stack.md](03-technology-stack.md), [04-architecture.md](04-architecture.md), [05-function-map.md](05-function-map.md)
- **Workspace**: `rea-ggtiktok`

---

## 1. Phương pháp Phân tích Tính năng

Báo cáo này đối chiếu toàn bộ các bằng chứng kỹ thuật đã thu thập (CIL tokens, chuỗi ký tự #US, đồ thị cuộc gọi Call Edges, và schema cơ sở dữ liệu) với các chức năng thực tế của ứng dụng phục vụ streamer TikTok Live.
Mỗi tính năng được phân tích theo 8 tiêu chí chuẩn mực:
1. **Mô tả chức năng**: Mục đích sử dụng thực tế.
2. **Hàm kích hoạt (Entry Function)**: Tọa độ token và tên phương thức.
3. **Các hàm liên quan (Called Functions)**: Luồng phân nhánh.
4. **Logic xử lý chi tiết (Processing Logic)**: Các bước thực thi thuật toán.
5. **Đầu vào / Đầu ra (Input/Output)**: Định dạng dữ liệu.
6. **Điều kiện & Rẽ nhánh (Conditions & Branches)**: Xử lý ngoại lệ, logic phán đoán.
7. **Bằng chứng kỹ thuật (Concrete Evidence)**: Token, RVA, String literal.
8. **Trạng thái xác minh**: CONFIRMED hoặc INFERRED.

---

## 2. Danh mục 10 Tính năng Nghiệp vụ Trọng tâm

---

### Tính năng 1: Bóc tách Dữ liệu Livestream TikTok qua Trình duyệt Nhúng (TikTok Ingestion)
- **Mô tả**: Mở livestream TikTok trên nhân Chromium nhúng, tự động đăng nhập, và hook DOM để trích xuất bình luận, lượt tặng quà, số người xem theo thời gian thực mà không cần API chính thức của TikTok.
- **Hàm kích hoạt**: `GGTT.Google_Tiktok_Form.InitBrowser_TT` / `BeginDesktopLoginAsync` (`0x060002e4`).
- **Các hàm liên quan**: `SpawnWebViewTikTokMobile`, `SafeExecuteScriptAsync`, `<InjectEmbeddedScriptAsync>g__Current|210_0`, `webView21_WebMessageReceived_1`.
- **Logic xử lý**:
  1. Khởi tạo phiên WebView2 với profile riêng biệt (tách biệt Desktop và Mobile): Desktop URL: `/google_tiktok/z0-new-schema-webview-tiktok.php`, Mobile URL: `/google_tiktok/z-new-schema-webview-tiktok-mobile.php`.
  2. Nạp script nhúng `window.__ggttEmbeddedCode` vào trang web TikTok qua `CoreWebView2.ExecuteScriptAsync`.
  3. Script lắng nghe WebSocket và DOM mutations của TikTok, đóng gói sự kiện quà tặng (tên người tặng, avatar, ID quà, số xu, combo) thành JSON.
  4. Gửi JSON ngược về C# thông qua `window.chrome.webview.postMessage()`.
  5. C# tiếp nhận tại `webView21_WebMessageReceived_1`, kiểm tra tính hợp lệ và phân luồng tới máy tính điểm và server overlay.
- **Đầu vào / Đầu ra**:
  - *Input*: URL kênh TikTok, tương tác của người xem trên livestream.
  - *Output*: Đối tượng `GiftRecord` (ID quà, số xu, người tặng, timestamp).
- **Điều kiện & Rẽ nhánh**:
  - Nếu URL rỗng hoặc không thuộc miền TikTok -> ghi log `"OpenUrlSafe bỏ qua: url không hợp lệ"`.
  - Nếu JSON sai format -> ghi log `"Bỏ qua thông điệp TikTok không hợp lệ"`.
  - Nếu WebView bị treo -> kích hoạt `CleanCacheConfirm` dọn cache và reload.
- **Bằng chứng kỹ thuật**: Token `0x060002e4`, `0x060002b8`, Chuỗi `window.__ggttEmbeddedCode`, `/google_tiktok/z0-new-schema-webview-tiktok.php`.
- **Trạng thái**: **CONFIRMED**.

---

### Tính năng 2: Quản lý Trận đấu Live PK & Máy tính Điểm số (`TeamChannelPkService`)
- **Mô tả**: Tổ chức các trận đấu PK giữa 2 hoặc nhiều đội streamer. Tự động tính điểm xu quà, chuỗi combo dồn dập, đếm ngược thời gian vòng đấu và lưu vào cơ sở dữ liệu SQLite.
- **Hàm kích hoạt**: `GGTT.Team.TeamChannelPkService.Apply` (`0x0600049f`) / `Record` (`0x0600049e`).
- **Các hàm liên quan**: `SelectMember`, `MemberSelection`, `MemberAvatar`, `Recipient`, `Snapshot`, `TeamStore.Execute`, `TeamStore.Query`.
- **Logic xử lý**:
  1. Khởi động vòng đấu: Ghi nhận `RoundId`, cấu hình `RoundEndsAt`, kiểm tra cờ `InMatch`.
  2. Khi có sự kiện quà tặng từ livestream:
     - Hàm `Recipient` tra cứu bảng `channel_pk_member_choices` để xác định quà tặng tại thời điểm đó thuộc về thành viên nào trong đội.
     - Hàm `Record` chèn bản ghi vào bảng tạm `pending_channel_pk_income` và bảng chính `channel_pk_income`.
     - Nếu người tặng chưa có trong danh bạ, tự động cập nhật tên và avatar vào bảng `channel_pk_senders`.
  3. Tái tính toán điểm số tổng hợp tức thời qua view SQLite `live_channel_pk_income`:
     `SELECT COALESCE(MAX(sequence), 0) + 1 FROM live_channel_pk_income`.
  4. Đóng gói trạng thái điểm số và phát tín hiệu đồng bộ cho overlay.
- **Đầu vào / Đầu ra**:
  - *Input*: Quà tặng, lệnh chọn thành viên của streamer, tín hiệu bắt đầu/kết thúc round.
  - *Output*: Snapshot trạng thái PK (`TeamSnapshot`, JSON chứa danh sách thành viên, số điểm, quà dẫn đầu, timer).
- **Điều kiện & Rẽ nhánh**:
  - Nếu streamer chưa kết nối kênh TikTok mà chọn thành viên -> ném lỗi `"Kết nối kênh TikTok trước khi chọn thành viên."`.
  - Nếu payload trạng thái vượt ngưỡng bộ nhớ -> báo lỗi `"Trạng thái PK quá lớn."`.
  - Nếu trạng thái trận không hợp lệ -> ngắt xử lý `"Trạng thái trận không hợp lệ."`.
- **Bằng chứng kỹ thuật**: Token `0x06000498` - `0x060004a0`, DDL SQLite tại `evidence/strings/team_channel_pk_strings.json`.
- **Trạng thái**: **CONFIRMED**.

---

### Tính năng 3: Truyền phát Dữ liệu Trực tiếp đến Widget Overlay OBS qua WebSocket
- **Mô tả**: Cung cấp máy chủ WebSocket cục bộ phát các sự kiện quà tặng, điểm số và hiệu ứng thị giác tới các Browser Source trên OBS Studio.
- **Hàm kích hoạt**: `GGTT.Google_Tiktok_Form.StartWebSocketServer` (`0x060002ab`).
- **Các hàm liên quan**: `SendSocketMessageAsync` (`0x060002a1`), `StopWebSocketServer` (`0x060002ac`), `SendTeamState` (`0x06000311`).
- **Logic xử lý**:
  1. Sử dụng thư viện `Fleck` mở socket server tại địa chỉ `ws://127.0.0.1:3784`.
  2. Lắng nghe các kết nối từ OBS Browser Source (widget HTML/CSS/JS chạy trên trình duyệt OBS).
  3. Mỗi khi có sự kiện quà, bình luận, thay đổi điểm PK, hoặc kích hoạt hiệu ứng, hàm `SendSocketMessageAsync` duyệt danh sách tất cả các socket đang mở và phát broadcast chuỗi JSON.
  4. Khi tắt ứng dụng, `StopWebSocketServer` đóng an toàn toàn bộ socket.
- **Đầu vào / Đầu ra**:
  - *Input*: Chuỗi JSON định dạng sự kiện.
  - *Output*: Dòng dữ liệu WebSocket chuẩn RFC 6455.
- **Điều kiện & Rẽ nhánh**:
  - Bắt lỗi khi không khởi động được server -> `"Không dừng được WebSocket server"` / `"Không đóng được WebSocket client"`.
- **Bằng chứng kỹ thuật**: Token `0x060002ab`, chuỗi kết nối `127.0.0.1:3784`, schema JSON tại `evidence/strings/google_tiktok_form_strings.json`.
- **Trạng thái**: **CONFIRMED**.

---

### Tính năng 4: Máy chủ Đa phương tiện Cục bộ Tốc độ Cao (Local HTTP Media Server)
- **Mô tả**: Phục vụ việc truyền phát các file video hiệu ứng, âm thanh, hình ảnh và mô hình Live2D từ ổ đĩa cục bộ lên widget OBS mà không bị gián đoạn hay phụ thuộc kết nối internet.
- **Hàm kích hoạt**: `GGTT.Google_Tiktok_Form.StartMediaServer` (`0x060002a5`).
- **Các hàm liên quan**: `StartMediaServerCore` (`0x060002a6`), `HandleRequests` (`0x060002a7`), `GetMimeType` (`0x060002aa`).
- **Logic xử lý**:
  1. Khởi động HTTP Listener tại `http://localhost:6211/`.
  2. Bắt các yêu cầu HTTP GET tài nguyên tĩnh từ OBS browser source.
  3. `GetMimeType` ánh xạ đuôi file sang header Content-Type tương ứng:
     - Video: `.mp4` (`video/mp4`), `.webm` (`video/webm`), `.mov` (`video/quicktime`).
     - Âm thanh: `.mp3` (`audio/mpeg`), `.wav` (`audio/wav`), `.ogg` (`audio/ogg`), `.m4a` (`audio/mp4`).
     - Hình ảnh: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`.
     - Live2D / Cấu hình: `.moc3`, `.atlas`, `.json` (`application/json`).
  4. Đọc luồng byte từ đĩa và truyền về client qua HTTP 200 chunked stream.
- **Đầu vào / Đầu ra**:
  - *Input*: Đường dẫn URI tài nguyên (ví dụ: `http://localhost:6211/effects/dragon.mp4`).
  - *Output*: Luồng nhị phân kèm Content-Type chuẩn.
- **Bằng chứng kỹ thuật**: Token `0x060002a5` - `0x060002aa`, port `6211`, danh sách định dạng MIME trong `evidence/strings/google_tiktok_form_strings.json`.
- **Trạng thái**: **CONFIRMED**.

---

### Tính năng 5: Tương tác Game Minecraft qua Giao thức RCON (Minecraft Integration)
- **Mô tả**: Cho phép người xem livestream tặng quà TikTok để kích hoạt trực tiếp các sự kiện trong thế giới game Minecraft.
- **Hàm kích hoạt**: `GGTT.Google_Tiktok_Form.SendCommandMinecraft` (Token thuộc máy trạng thái `<SendCommandMinecraft>d__114`).
- **Các hàm liên quan**: `connect_minecraft_server`, cấu hình host/port/password trong `Google_Tiktok_Setting`.
- **Logic xử lý**:
  1. Thiết lập kết nối socket TCP tới Minecraft Server qua thư viện `CoreRCON`.
  2. Nhận sự kiện quà tặng từ TikTok: lọc theo tên quà hoặc ID quà (ví dụ: "Hoa hồng", "Mũi tên ma thuật", "Sư tử").
  3. Chuyển đổi quà tặng thành câu lệnh Minecraft Console tương ứng:
     - Tặng hoa hồng -> `/give @p rose 1`
     - Tặng bom -> `/summon tnt ~ ~ ~`
     - Tặng sấm sét -> `/summon lightning_bolt`
  4. Gửi lệnh qua RCON và nhận phản hồi thực thi từ máy chủ game.
- **Đầu vào / Đầu ra**:
  - *Input*: Tên quà tặng và cấu hình RCON (IP, Port, RCON Password).
  - *Output*: Lệnh RCON gửi qua giao thức TCP.
- **Bằng chứng kỹ thuật**: Thư viện `CoreRCON.dll`, phương thức `SendCommandMinecraft`, RVA trong `google_tiktok_form_methods_p0.json`.
- **Trạng thái**: **CONFIRMED**.

---

### Tính năng 6: AI Nhận diện Tư thế & Đếm Hình phạt Thể lực (`PunishmentTrackingService` & `ObsTrackingClient`)
- **Mô tả**: Giám sát streamer qua webcam bằng AI. Tự động đếm số lần squat/hít đất khi đội nhà thua trong trận PK và tự động điều khiển camera OBS bám theo vị trí cơ thể của streamer.
- **Hàm kích hoạt**: `GGTT.Tracking.PunishmentTrackingService.Run` (`0x0600043f`).
- **Các hàm liên quan**: `ObsTrackingClient.ConnectAsync` (`0x06000432`), `ObsTrackingClient.Call` (`0x06000433`), `Password` (`0x0600043d`), `get_Count` (`0x0600043a`).
- **Logic xử lý**:
  1. Nạp 2 mô hình ONNX: `person_detection_mediapipe_2023mar.onnx` (phát hiện người) và `pose_estimation_mediapipe_2023mar.onnx` (trích xuất 33 điểm xương).
  2. Chụp khung hình từ webcam qua `get_Frame`.
  3. Thực thi suy luận qua ONNX Runtime: Tính toán tọa độ hông, đầu gối, mắt cá chân để tính góc uốn (knee flexion angle).
  4. Khi góc uốn vượt ngưỡng quy định -> ghi nhận 1 lần squat thành công và tăng `get_Count`.
  5. Đồng thời, `ObsTrackingClient` gửi lệnh WebSocket v5 tới OBS Studio (`SetSceneItemTransform`) để pan/zoom camera bám theo chuyển động người dùng.
- **Đầu vào / Đầu ra**:
  - *Input*: Khung hình RGB từ webcam, thông số kết nối OBS WebSocket v5.
  - *Output*: Số lần đếm phạt (`Count`), tọa độ bounding box người, lệnh điều khiển OBS.
- **Điều kiện an toàn**: Mật khẩu OBS được mã hóa bằng Windows DPAPI (`Password`), yêu cầu nhập lại nếu đổi tài khoản người dùng Windows (`"Nhập lại mật khẩu OBS trên tài khoản Windows này."`).
- **Bằng chứng kỹ thuật**: Token `0x06000432` - `0x0600043f`, model files ONNX, chuỗi `GGTT.OBS.Punishment.v1` trong `evidence/strings/tracking_methods.json`.
- **Trạng thái**: **CONFIRMED**.

---

### Tính năng 7: Kịch bản Hiệu ứng Tương tác & Tách Nền Xanh (`ScenarioEngine`)
- **Mô tả**: Động cơ điều phối các chuỗi hiệu ứng phức tạp nhiều lớp (video, audio, Live2D, gắn hiệu ứng khuôn mặt) theo kịch bản có điều kiện và hỗ trợ tách nền xanh (Chroma Key).
- **Hàm kích hoạt**: `GGTT.EffectsBridge.Effects.ScenarioEngine.Tick` (`0x060003ec`).
- **Các hàm liên quan**: `Evaluate` (`0x060003ed`), `Reset` (`0x060003ea`), `LayerChromaKey`, `FaceReaction`.
- **Logic xử lý**:
  1. Quản lý trạng thái kịch bản dưới dạng một State Machine có đồng hồ nội bộ.
  2. Trong mỗi nhịp `Tick`:
     - Kiểm tra các điều kiện kích hoạt: `time` (thời gian trôi qua), `collision` (va chạm giữa các đối tượng hiệu ứng), `random` (xác suất ngẫu nhiên).
     - Đánh giá luật qua `Evaluate`: Hỗ trợ toán tử so sánh `eq`, `ne`, `any`, `all`.
     - Thực thi hành động: `set_state`, `add_state`, `cancel_pending`, `repeat`.
  3. Tích hợp thuật toán Chroma Key: Tách kênh màu nền (xanh lá cây/xanh dương) của video MP4 để tạo hiệu ứng trong suốt hiển thị trên livestream.
- **Đầu vào / Đầu ra**:
  - *Input*: Delta time (`double`), sự kiện tương tác quà, trạng thái môi trường (`WorldState`).
  - *Output*: Danh sách hiệu ứng hình ảnh cần render trên màn hình.
- **Bằng chứng kỹ thuật**: Token `0x060003ec`, `0x060003ed`, danh sách từ khóa kịch bản trong `evidence/strings/scenario_trust_strings.json`.
- **Trạng thái**: **CONFIRMED**.

---

### Tính năng 8: Phím Nóng Toàn cục & Giả lập Điều khiển Phần cứng (Hardware Hotkeys & Input)
- **Mô tả**: Cho phép streamer thao tác nhanh bằng bàn phím vật lý để điều khiển tốc độ hiệu ứng, cộng trừ điểm số PK, hoặc giả lập phím bấm để điều khiển game ngoài (GTA, game giả lập Android).
- **Hàm kích hoạt**: `GGTT.Google_Tiktok_Form.HotKeyXuLy` (`0x060002b0`) & `key_board_desktop_start` (`0x060002d4`).
- **Các hàm liên quan**: Win32 API `RegisterHotKey`, `UnregisterHotKey`, `SendInput` thông qua `user32.dll`.
- **Bảng ánh xạ phím nóng đã xác minh**:
  - `A`: `set_pause_effect(0)` — Tiếp tục phát hiệu ứng.
  - `D`: `set_pause_effect(1)` — Tạm dừng hiệu ứng đang phát.
  - `S`: `pause_effect()` — Đảo trạng thái phát/dừng hiệu ứng.
  - `Oemplus` (`+`): `win_count_update(1)` — Tăng 1 điểm thắng trận PK.
  - `OemMinus` (`-`): `win_count_update(0)` — Giảm 1 điểm thắng trận PK.
  - `U`: `set_effect_speed(2)` — Tăng tốc độ hiệu ứng (Mức 2).
  - `I`: `set_effect_speed(0)` — Tốc độ hiệu ứng bình thường (Mức 0).
  - `O`: `set_effect_speed(1)` — Tốc độ hiệu ứng nhanh (Mức 1).
- **Bằng chứng kỹ thuật**: Token `0x060002b0`, chuỗi ký tự gán lệnh hotkey trong `evidence/strings/google_tiktok_form_strings.json`.
- **Trạng thái**: **CONFIRMED**.

---

### Tính năng 9: Kế toán Quà tặng, Sao lưu Cơ sở Dữ liệu & Xuất Báo cáo CSV
- **Mô tả**: Lưu trữ toàn bộ lịch sử tặng quà vào SQLite, tự động sao lưu an toàn khi khôi phục dữ liệu, và xuất báo cáo đối soát doanh thu ra file CSV cho các thành viên trong đội.
- **Hàm kích hoạt**: `GGTT.Google_Tiktok_Form.ExportTeamReport` (`0x0600031b`), `BackupTeamData` (`0x06000319`), `RestoreTeamData` (`0x0600031a`).
- **Logic xử lý**:
  1. Sao lưu: Sao chép tệp `team.db` sang tệp có tên theo mẫu `GGTT-Team-yyyyMMdd-HHmmss.db`.
  2. Khôi phục: Trước khi ghi đè dữ liệu cũ, tự động sao lưu bản snapshot hiện tại thành `before-restore-*` để đảm bảo không mất dữ liệu.
  3. Xuất CSV: Truy vấn tổng hợp xu quà từ bảng `channel_pk_income`, tính toán số xu điều chỉnh (`adjustment`) và tổng số (`total`).
  4. Ghi file `GGTT-Team-bao-cao.csv` với cấu trúc header:
     `Thành viên,UID,Nhóm,Kênh,Xu quà,Điều chỉnh,Tổng`
- **Bằng chứng kỹ thuật**: Token `0x06000319` - `0x0600031b`, chuỗi định dạng CSV và backup trong `evidence/strings/google_tiktok_form_strings.json`.
- **Trạng thái**: **CONFIRMED**.

---

### Tính năng 10: Cơ chế Xác thực Toàn vẹn Tiến trình & Chống Can thiệp (Process Trust & Anti-Tamper)
- **Mô tả**: Bảo vệ ứng dụng trước nguy cơ bị chỉnh sửa binary, chèn mã độc, hoặc kết nối trái phép qua Named Pipe.
- **Hàm kích hoạt**: `GGTT.EffectsBridge.Effects.EffectProcessTrust.Verify` (`0x060003f0`).
- **Các hàm liên quan**: `Inspect`, `PipePeer`, `GetNamedPipeClientProcessId`, `QueryFullProcessImageName`, `NtQueryInformationProcess`.
- **Logic xử lý**:
  1. Khi một tiến trình phụ (Studio / Player / Effect renderer) kết nối qua Named Pipe:
     - Gọi `GetNamedPipeClientProcessId` để lấy Process ID của tiến trình gọi.
     - Dùng `QueryFullProcessImageName` lấy đường dẫn file thực thi trên đĩa.
     - Tính toán mã băm SHA-256 của file đó.
  2. Đối chiếu mã SHA-256 với bảng kê `effects-trust.json`.
  3. Xác thực chữ ký số của manifest bằng chuỗi public key nhúng cố định trong CIL:
     `4UcTuf6I5lpc+2Y4liRBW+2ndzZTiPHoMRrpkTcme...`.
  4. Nếu checksum hoặc chữ ký không hợp lệ, lập tức đóng pipe và từ chối cấp quyền: `"Không xác minh được tiến trình ở đầu kia của pipe."`, `"Tệp ứng dụng đã thay đổi. Hãy cài lại bản phát hành GGTT chính thức."`.
- **Bằng chứng kỹ thuật**: Token `0x060003f0`, chuỗi chữ ký điện tử và danh sách thông điệp lỗi trong `evidence/strings/scenario_trust_strings.json`.
- **Trạng thái**: **CONFIRMED**.

---

## 3. Kết luận Đánh giá Tính năng
Cả 10 tính năng cốt lõi của GGTT đã được phân tích thấu đáo về mặt thuật toán, luồng dữ liệu, các điều kiện rẽ nhánh và các phương thức thực thi cụ thể. Đây là cơ sở kỹ thuật hoàn chỉnh để tiến hành xây dựng phương án tái triển khai độc lập (Clean-Room) tại Phase 5.
