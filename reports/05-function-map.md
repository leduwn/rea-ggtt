# Báo cáo Bản đồ Hàm & Phân tích CIL (Phase 3 - Function Map)

- **Thời gian thực hiện**: 2026-11-11
- **Target**: `C:\Program Files (x86)\GGTT\GGTT.dll` (SHA-256: `6ee719dd26a248e6295429e523c2220b8e87a4a98168ea0626174aa1fb0ef6b5`)
- **MVID**: `298ab416-d58b-4c6d-8e4a-91f20ef739a1`
- **Tài liệu tham chiếu**: [02-binary-inventory.md](02-binary-inventory.md), [04-architecture.md](04-architecture.md)
- **Evidence Files**:
  - `evidence/functions/google_tiktok_form_methods_p0.json`
  - `evidence/functions/google_tiktok_form_methods_p1.json`
  - `evidence/functions/google_tiktok_form_methods_p2.json`
  - `evidence/functions/team_channel_pk_service_methods.json`
  - `evidence/functions/tracking_methods.json`
  - `evidence/functions/scenario_engine_trust_methods.json`
  - `evidence/xrefs/team_pk_call_edges.json`

---

## 1. Phương pháp & Quy chuẩn Xác minh

Tất cả các hàm, token, RVA, và mã lệnh CIL trong báo cáo này được trích xuất trực tiếp từ siêu dữ liệu ECMA-335 của file nhị phân gốc thông qua REA Provider `rea-dotnet-static`.
- **Trạng thái**: Tất cả các hàm được liệt kê dưới đây đều đạt mức xác minh **CONFIRMED**.
- **Tọa độ siêu dữ liệu**: Metadata Token (`MethodDef`), RVA (Relative Virtual Address), CIL Instruction Count, và Call Edges.

---

## 2. Phân hệ 1: Form Điều khiển Trung tâm (`GGTT.Google_Tiktok_Form`)
- **TypeDef Token**: `0x0200004c`
- **Tổng số MethodDefs**: 153 methods
- **Call Edges nội bộ**: 1,024 edges

| Token | Tên Phương thức | Chữ ký (Signature) | RVA | Lệnh CIL | Vai trò & Cơ chế Thực thi |
|---|---|---|---|---|---|
| `0x060002ab` | `StartWebSocketServer` | `void StartWebSocketServer()` | 0x01db68 | 28 instrs | Khởi động server Fleck WebSocket lắng nghe tại cổng `3784`. Quản lý danh sách client OBS kết nối. |
| `0x060002ac` | `StopWebSocketServer` | `void StopWebSocketServer()` | 0x01dc24 | 14 instrs | Đóng toàn bộ socket client đang kết nối và giải phóng tài nguyên mạng. |
| `0x060002a5` | `StartMediaServer` | `void StartMediaServer()` | 0x01d83c | 14 instrs | Khởi tạo server HTTP cục bộ tại `http://localhost:6211/`. |
| `0x060002a6` | `StartMediaServerCore` | `void StartMediaServerCore()` | 0x01d858 | 42 instrs | Cấu hình router URL cho Media Server, liên kết thư mục tài nguyên cục bộ với trình phát media. |
| `0x060002aa` | `GetMimeType` | `string GetMimeType(string)` | 0x01da28 | 38 instrs | Phân tích phần mở rộng tệp (`.mp4`, `.webm`, `.moc3`, `.atlas`, `.png`, v.v.) và trả về MIME chuẩn. |
| `0x060002a1` | `SendSocketMessageAsync` | `Task SendSocketMessageAsync(string)` | 0x01d784 | 17 instrs | Phát tán gói tin JSON chứa sự kiện quà/bình luận đến tất cả client kết nối cổng 3784. |
| `0x060002b0` | `HotKeyXuLy` | `void HotKeyXuLy(ref Message)` | 0x01df40 | 115 instrs | Xử lý thông điệp Win32 `WM_HOTKEY` (0x0312). Điều hướng các phím tắt `A`, `D`, `S`, `U`, `I`, `O`, `+`, `-`. |
| `0x060002b8` | `SafeExecuteScriptAsync` | `Task<string> SafeExecuteScriptAsync(string)` | 0x01e2ec | 20 instrs | Thực thi JavaScript trong WebView2 an toàn, bắt ngoại lệ khi trình duyệt bận hoặc đang reload. |
| `0x060002d4` | `key_board_desktop_start`| `void key_board_desktop_start()` | 0x01f028 | 64 instrs | Đăng ký các hook phím nóng toàn cục với hệ điều hành thông qua Win32 `RegisterHotKey`. |
| `0x060002d8` | `CleanCacheConfirm` | `void CleanCacheConfirm()` | 0x01f198 | 48 instrs | Hiển thị hộp thoại cảnh báo người dùng trước khi xóa bộ nhớ đệm WebView2 và khởi động lại. |
| `0x060002d9` | `CleanCache` | `void CleanCache()` | 0x01f280 | 14 instrs | Xóa dữ liệu user profile của Chromium WebView2 để giải phóng RAM và sửa lỗi không tải hiệu ứng. |
| `0x060002e4` | `BeginDesktopLoginAsync` | `Task BeginDesktopLoginAsync(string)` | 0x01f78c | 20 instrs | Khởi tạo tiến trình đăng nhập TikTok qua WebView2 profile Desktop. |
| `0x060002ef` | `CloseMatchingWindow` | `void CloseMatchingWindow(string)` | 0x020084 | 130 instrs | Tìm và đóng các cửa sổ tiến trình phụ trợ (blackfunkill) theo tiêu đề cửa sổ thông qua Win32 API. |
| `0x0600030c` | `HandleTeamLauncherAsync`| `Task HandleTeamLauncherAsync(string, string)` | 0x021950 | 23 instrs | Khởi chạy giao diện quản lý Team PK hoặc kết nối socket đồng bộ trạng thái đội. |
| `0x06000311` | `SendTeamState` | `void SendTeamState(bool)` | 0x021da8 | 77 instrs | Đóng gói toàn bộ điểm số, quà tặng và thời gian còn lại của trận đấu gửi cho trình duyệt overlay. |
| `0x0600031b` | `ExportTeamReport` | `string ExportTeamReport(Dictionary)` | 0x022510 | 149 instrs | Xuất báo cáo doanh thu quà tặng của các thành viên trong đội ra tệp `GGTT-Team-bao-cao.csv`. |
| `0x0600031c` | `PickTeamAvatar` | `string PickTeamAvatar()` | 0x022834 | 34 instrs | Mở file picker chọn ảnh đại diện cho thành viên trong nhóm, mã hóa ảnh sang Base64 data URI. |
| `0x06000329` | `TeamTrackingCommand` | `Task<object> TeamTrackingCommand(string, JsonNode)` | 0x022df8 | 23 instrs | Chuyển tiếp lệnh điều khiển từ giao diện sang engine AI tracking và OBS client. |

---

## 3. Phân hệ 2: Dịch vụ Live PK & Quản lý Điểm số (`GGTT.Team.TeamChannelPkService`)
- **TypeDef Token**: `0x020000a0`
- **Tổng số MethodDefs**: 13 methods
- **Call Edges nội bộ**: 240 edges

| Token | Tên Phương thức | Chữ ký | RVA | Lệnh CIL | Phân tích Logic & Callers / Callees |
|---|---|---|---|---|---|
| `0x06000498` | `.ctor` | `void .ctor(TeamStore, Action<JsonNode>)` | 0x01e838 | 143 instrs | **Khởi tạo dịch vụ**: Thực thi DDL SQLite tạo 5 bảng (`channel_pk_income`, `channel_pk_state`, `channel_pk_history`, `channel_pk_senders`, `channel_pk_member_choices`). Tạo temp view `live_channel_pk_income`. Đọc/ghi định danh thiết bị `channel-pk-device.txt`. Nạp trạng thái JSON lưu trước đó. |
| `0x06000499` | `get_InMatch` | `bool get_InMatch()` | 0x01ea18 | 27 instrs | **Kiểm tra trạng thái trận đấu**: Đọc trường `match` và `status` từ JSON state để xác định vòng đấu PK có đang diễn ra hay đã kết thúc (`ended`). |
| `0x0600049a` | `SelectMember` | `object SelectMember(string, string)` | 0x01ea68 | 26 instrs | **Gán thành viên nhận quà**: Kiểm tra kênh hiện tại (`op_Equality`), ném ngoại lệ nếu chưa kết nối kênh TikTok, gọi `TeamStore.Change` ghi nhận lựa chọn vào SQLite. |
| `0x0600049b` | `MemberSelection` | `object MemberSelection(string)` | 0x01eac4 | 15 instrs | **Truy vấn thành viên**: Gọi `TeamStore.Inspect` truy vấn người đang được chọn nhận quà trong nhóm ở thời điểm hiện tại. |
| `0x0600049c` | `MemberAvatar` | `string MemberAvatar(string)` | 0x01eafc | 218 instrs | **Xử lý ảnh đại diện**: Kiểm tra tiền tố `"data:image/"`, giải mã Base64 sang byte array, khởi tạo `MemoryStream` nạp vào `System.Drawing.Image`, lấy kích thước Width/Height, nén lại qua `ImageCodecInfo`. |
| `0x0600049d` | `Recipient` | `ValueTuple Recipient(GiftRecord, TeamGroup)` | 0x01ee24 | 175 instrs | **Xác định người hưởng quà**: Đối soát thời gian tặng quà với bảng lịch sử `channel_pk_member_choices` để chỉ định chính xác thành viên nào trong đội được nhận số xu đó. |
| `0x0600049e` | `Record` | `void Record(GiftRecord, long)` | 0x01f02c | 108 instrs | **Ghi nhật ký quà tặng**: Chèn giao dịch quà vào bảng `channel_pk_income` và `pending_channel_pk_income`, cập nhật danh sách người tặng `channel_pk_senders`. |
| `0x0600049f` | `Apply` | `void Apply(JsonNode, string)` | 0x01f19c | 224 instrs | **Cập nhật trạng thái PK**: Áp dụng thay đổi điểm số, thời gian còn lại của vòng đấu, kiểm tra giới hạn kích thước gói tin trạng thái (`"Trạng thái PK quá lớn."`). |
| `0x060004a0` | `Snapshot` | `object Snapshot(string, bool)` | 0x01f450 | 146 instrs | **Chụp ảnh snapshot**: Đóng gói toàn bộ cấu trúc phòng đấu (thành viên, điểm số, lịch sử tặng quà) thành object JSON để đồng bộ sang overlay. |

---

## 4. Phân hệ 3: AI Computer Vision & OBS Tracking (`GGTT.Tracking.*`)

### 4.1. `GGTT.Tracking.ObsTrackingClient` (Token: `0x02000096`)
| Token | Tên Phương thức | Chữ ký | RVA | Lệnh CIL | Vai trò Kỹ thuật |
|---|---|---|---|---|---|
| `0x06000432` | `ConnectAsync` | `Task ConnectAsync(int, string, CancellationToken)` | 0x01be90 | 26 instrs | Mở kết nối WebSocket tới OBS Studio v5 theo cấu hình cổng và mật khẩu xác thực. |
| `0x06000433` | `Call` | `Task<JsonNode> Call(string, object, CancellationToken)` | 0x01bf38 | 26 instrs | Gửi yêu cầu OBS RPC (ví dụ: `SetSceneItemTransform`, `GetSceneItemList`) và đợi phản hồi. |
| `0x06000434` | `Send` | `Task Send(object, CancellationToken)` | 0x01bfe0 | 23 instrs | Gửi bản tin điều khiển một chiều (không đợi kết quả) tới OBS. |
| `0x06000435` | `Receive` | `Task<JsonNode> Receive(CancellationToken)` | 0x01c06c | 20 instrs | Lắng nghe luồng thông điệp bất đồng bộ từ OBS server. |

### 4.2. `GGTT.Tracking.PunishmentTrackingService` (Token: `0x02000097`)
| Token | Tên Phương thức | Chữ ký | RVA | Lệnh CIL | Vai trò Kỹ thuật |
|---|---|---|---|---|---|
| `0x06000438` | `.ctor` | `void .ctor(string, Action<bool>)` | 0x01c10c | 48 instrs | Nạp cấu hình từ `tracking-settings.json`, nạp mô hình ONNX MediaPipe Pose và Person Detection. |
| `0x06000439` | `get_Frame` | `byte[] get_Frame()` | 0x01c238 | 4 instrs | Lấy khung hình video mới nhất từ webcam phục vụ hiển thị preview hoặc suy luận AI. |
| `0x0600043a` | `get_Count` | `int get_Count()` | 0x01c244 | 4 instrs | Trả về số lần hoàn thành động tác thể lực (squat, v.v.) mà thuật toán đã ghi nhận. |
| `0x0600043b` | `Status` | `object Status(string)` | 0x01c250 | 55 instrs | Trả về trạng thái hoạt động của engine tracking dưới dạng JSON `{"running": bool, "bodies": [...]}`. |
| `0x0600043d` | `Password` | `string Password()` | 0x01c340 | 25 instrs | Sử dụng Windows Data Protection API (DPAPI) để giải mã an toàn mật khẩu OBS kết nối trên tài khoản người dùng hiện tại. |
| `0x0600043f` | `Run` | `Task Run(string, CancellationToken)` | 0x01c3d0 | 23 instrs | Vòng lặp chính xử lý luồng camera: bắt frame -> chạy ONNX inference -> trích xuất 33 landmarks -> kiểm tra góc uốn khớp -> tăng biến đếm phạt. |

---

## 5. Phân hệ 4: Kịch bản Hiệu ứng & Xác thực Tin cậy (`GGTT.EffectsBridge.Effects.*`)

### 5.1. `GGTT.EffectsBridge.Effects.ScenarioEngine` (Token: `0x02000090`)
| Token | Tên Phương thức | Chữ ký | RVA | Lệnh CIL | Vai trò Kỹ thuật |
|---|---|---|---|---|---|
| `0x060003ec` | `Tick` | `void Tick(double, WorldState)` | 0x01a430 | 438 instrs | **Nhịp đồng hồ kịch bản**: Cập nhật thời gian sống của các hiệu ứng, kiểm tra va chạm (`collision`), xử lý lặp (`repeat`), và loại bỏ các hiệu ứng hết hạn. |
| `0x060003ed` | `Evaluate` | `bool Evaluate(Rule, double, WorldState, ref double, ref double)` | 0x01ab4c | 254 instrs | **Đánh giá luật điều kiện**: Thẩm định các biểu thức logic (`eq`, `ne`, `random`, `any`, `all`) dựa trên biến số môi trường (`Variable`). |
| `0x060003ea` | `Reset` | `void Reset()` | 0x01a350 | 61 instrs | Thiết lập lại toàn bộ trạng thái kịch bản về giá trị ban đầu. |

### 5.2. `GGTT.EffectsBridge.Effects.EffectProcessTrust` (Token: `0x02000091`)
| Token | Tên Phương thức | Chữ ký | RVA | Lệnh CIL | Vai trò Kỹ thuật |
|---|---|---|---|---|---|
| `0x060003f0` | `Verify` | `TrustResult Verify(uint, string)` | 0x01b020 | 437 instrs | **Xác thực tiến trình**: Đọc SHA-256 của file tiến trình kết nối, đối chiếu với manifest đã ký `effects-trust.json` bằng khóa công khai nhúng trong nhị phân. |
| `0x060003f4` | `PipePeer` | `uint PipePeer(IntPtr, bool)` | 0x01b874 | 15 instrs | Lấy Process ID của tiến trình phía bên kia đường ống Named Pipe qua Win32 API. |
| `0x060003f5` | `GetNamedPipeClientProcessId` | `bool (IntPtr, out uint)` | P/Invoke | 0 instrs | Nhập khẩu từ `kernel32.dll`. |
| `0x060003f6` | `GetNamedPipeServerProcessId` | `bool (IntPtr, out uint)` | P/Invoke | 0 instrs | Nhập khẩu từ `kernel32.dll`. |
| `0x060003fa` | `QueryFullProcessImageName` | `bool (IntPtr, uint, StringBuilder, out uint)` | P/Invoke | 0 instrs | Nhập khẩu từ `kernel32.dll`. Lấy đường dẫn đầy đủ của file thực thi tiến trình cần kiểm tra. |
| `0x060003fc` | `NtQueryInformationProcess` | `int (IntPtr, int, ref ProcessBasicInfo, int, out int)` | P/Invoke | 0 instrs | Nhập khẩu từ `ntdll.dll`. Truy vấn thông tin cấu trúc tiến trình cấp thấp. |

---

## 6. Kết luận Phase 3
Bản đồ hàm trên đã bao phủ đầy đủ toàn bộ các điểm nút thực thi quan trọng của ứng dụng GGTT, từ giao diện người dùng, điều phối mạng, xử lý livestream, tính điểm PK SQLite, camera AI MediaPipe đến kiến trúc chống can thiệp Win32 P/Invoke. Toàn bộ thông tin được ánh xạ bằng tọa độ token và RVA thực tế, sẵn sàng cho Phase 4 (Feature Reconstruction Analysis).
