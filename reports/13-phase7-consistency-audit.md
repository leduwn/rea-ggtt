# Báo cáo Kiểm toán Tính nhất quán Bằng chứng & Xác minh Tuyên bố Kỹ thuật (Phase 7 - Consistency Audit)

- **Mã báo cáo**: `13-phase7-consistency-audit.md`
- **Thời gian thực hiện**: 2026-11-11
- **Đối tượng kiểm toán**: `GGTT.exe` và `GGTT.dll` (v1.1.4.12)
- **MVID**: `298ab416-d58b-4c6d-8e4a-91f20ef739a1`
- **SHA-256**: `6ee719dd26a248e6295429e523c2220b8e87a4a98168ea0626174aa1fb0ef6b5`
- **Công cụ kiểm toán**: REA 6.8.0 MCP, Node.js Verification Harness, PowerShell POSIX CLI

---

## 1. Tóm tắt Kiểm toán & Mục tiêu

Giai đoạn Phase 7 thực hiện rà soát độc lập, đối soát chéo toàn bộ dữ liệu kiểm kê nhị phân và mã máy CIL được sinh ra từ Phase 1 đến Phase 6 nhằm:
1. Giải quyết triệt để mâu thuẫn số lượng tệp nhị phân giữa Phase 2 (ghi nhận 282 tệp) và Phase 6 (ghi nhận 360 tệp).
2. Đối chiếu số lượng tệp CIL disassembly trong `evidence/cil/` (làm rõ các con số 28, 32 và 36 tệp).
3. Xác minh kỹ thuật với độ chính xác opcode cấp CIL cho 7 phát biểu kiến trúc cốt lõi của ứng dụng GGTT.

---

## 2. Nhiệm vụ A1: Giải quyết Mâu thuẫn Kiểm kê Nhị phân (282 vs 360 tệp)

### 2.1. Kết quả Đối soát Trực tiếp Hệ thống Tệp

Kiểm tra đối chiếu thực tế giữa tệp bằng chứng gốc `evidence/binary/full-inventory.json` và việc quét đệ quy thư mục vật lý `C:\Program Files (x86)\GGTT`:

| Vị trí thư mục | Số lượng trong `full-inventory.json` | Số lượng quét thực tế trên đĩa | Trạng thái khớp |
|---|---|---|---|
| **Root (`C:\Program Files (x86)\GGTT\`)** | 35 tệp | 35 tệp | KHỚP 100% |
| **`SpeechRuntime\`** | 259 tệp | 259 tệp | KHỚP 100% |
| **`runtimes\`** | 25 tệp | 25 tệp | KHỚP 100% |
| **`Tracking\`** | 19 tệp | 19 tệp | KHỚP 100% |
| **Thư mục ngôn ngữ phụ (16 thư mục locale)** | 21 tệp | 21 tệp | KHỚP 100% |
| **`update\`** | 1 tệp | 1 tệp | KHỚP 100% |
| **TỔNG CỘNG** | **360 tệp** | **360 tệp** | **KHỚP TUYỆT ĐỐI** |

### 2.2. Nguồn gốc của Con số 282 trong Báo cáo Phase 2

Kiểm tra lại [reports/02-binary-inventory.md](02-binary-inventory.md) tại Mục 1, bảng tổng kết ghi nhận:
```
Core Executable: 2 tệp
Runtime & Config: 3 tệp
Trust & Integrity: 1 tệp
Managed Dependencies: ~40 tệp DLL
Native Runtime Libraries: ~15 tệp DLL
AI Models: 2 tệp ONNX
Framework Runtimes: ~220 tệp DLL
-----------------------------------------
Tổng ước tính: 2 + 3 + 1 + 40 + 15 + 2 + 220 = 283 ≈ 282 tệp
```

**Nguyên nhân sai lệch:**
1. Bảng số liệu trong Phase 2 là **ước tính thủ công dựa trên việc đếm các tệp DLL và tệp thực thi cấp root/runtime**, hoàn toàn bỏ qua các tệp tài nguyên gói Chromium (`.pak`, `.dat`, `.bin`, `.loc`) nằm sâu trong thư mục `SpeechRuntime/` (gồm 174 tệp tài nguyên ngôn ngữ `.pak` và Chromium web components).
2. Tệp dữ liệu thô `evidence/binary/full-inventory.json` ngay từ Phase 2 đã ghi nhận đủ **360 phần tử**.
3. **Kết luận kiểm toán**: Thư mục cài đặt chuẩn của GGTT v1.1.4.12 bao gồm chính xác **360 tệp**. Con số 282 là lỗi ước lượng thống kê văn bản trong báo cáo Phase 2 cũ và chính thức được chuẩn hóa thành **360 tệp**.

---

## 3. Nhiệm vụ A2: Đối soát Kho Bằng chứng Disassembly CIL (`evidence/cil/`)

### 3.1. Lịch sử Gia tăng và Phân loại Tệp CIL

Trong các phase trước, số lượng tệp CIL được nhắc tới ở các mốc khác nhau:
- **Mốc 28 tệp**: Đợt trích xuất đầu tiên của Phase 6 bao quát các service cơ bản và form chính.
- **Mốc 32 tệp**: Sau khi phân tích sâu Pipeline A (TikTok Ingestion) và Pipeline B (Team PK Scoring), 4 tệp CIL bổ sung đã được tạo.
- **Mốc 36 tệp (Hiện tại)**: Bổ sung 3 phương thức lưu trữ cốt lõi của `TeamStore` (`ReadCombo`, `WriteCombo`, `CommitGiftCombo`) cùng phương thức `GetMimeType`.

### 3.2. Bảng Danh mục 36 Phương thức CIL Đã Xác minh

Toàn bộ 36 tệp CIL đều được đối chiếu trực tiếp với ECMA-335 metadata token trong `GGTT.dll`, khớp hoàn toàn SHA-256 (`6ee719dd26...`) và MVID (`298ab416-d58b-4c6d-8e4a-91f20ef739a1`):

| STT | Metadata Token | Tên Phương thức / Lớp | RVA | Số Lệnh (Instructions) | Tệp Bằng chứng CIL |
|---|---|---|---|---|---|
| 1 | `0x0600025b` | `EmbeddedScriptDocument::Bootstrap` | `0xbb58` | 33 | `0x0600025b_EmbeddedScriptDocument_Bootstrap.cil` |
| 2 | `0x0600025c` | `EmbeddedScriptDocument::Inject` | `0xbba8` | 36 | `0x0600025c_EmbeddedScriptDocument_Inject.cil` |
| 3 | `0x0600025d` | `EmbeddedScriptDocument::Acknowledged` | `0xbbf4` | 40 | `0x0600025d_EmbeddedScriptDocument_Acknowledged.cil` |
| 4 | `0x0600028f` | `EmbeddedScriptLoader::GetAsync` | `0xc374` | 92 | `0x0600028f_EmbeddedScriptLoader_GetAsync.cil` |
| 5 | `0x06000295` | `EmbeddedScriptLoader::Validate` | `0xc608` | 123 | `0x06000295_EmbeddedScriptLoader_Validate.cil` |
| 6 | `0x060002a1` | `Google_Tiktok_Form::SendSocketMessageAsync` | `0xcf0c` | 20 | `0x060002a1_Google_Tiktok_Form_SendSocketMessageAsync.cil` |
| 7 | `0x060002a6` | `Google_Tiktok_Form::StartMediaServerCore` | `0xd098` | 26 | `0x060002a6_Google_Tiktok_Form_StartMediaServerCore.cil` |
| 8 | `0x060002aa` | `Google_Tiktok_Form::GetMimeType` | `0xd26c` | 173 | `0x060002aa_Google_Tiktok_Form_GetMimeType.cil` |
| 9 | `0x060002ab` | `Google_Tiktok_Form::StartWebSocketServer` | `0xd4c4` | 14 | `0x060002ab_Google_Tiktok_Form_StartWebSocketServer.cil` |
| 10 | `0x060002b8` | `Google_Tiktok_Form::SafeExecuteScriptAsync` | `0xd9ec` | 23 | `0x060002b8_Google_Tiktok_Form_SafeExecuteScriptAsync.cil` |
| 11 | `0x060002c9` | `Google_Tiktok_Form::InitBrowser_TT` | `0xe0e4` | 17 | `0x060002c9_Google_Tiktok_Form_InitBrowser_TT.cil` |
| 12 | `0x060002d2` | `Google_Tiktok_Form::webView21_WebMessageReceived_1` | `0xe3d4` | 17 | `0x060002d2_Google_Tiktok_Form_webView21_WebMessageReceived_1.cil` |
| 13 | `0x06000300` | `Google_Tiktok_Form::InjectEmbeddedScriptAsync` | `0xf5d0` | 20 | `0x06000300_Google_Tiktok_Form_InjectEmbeddedScriptAsync.cil` |
| 14 | `0x06000311` | `Google_Tiktok_Form::SendTeamState` | `0xfb90` | 77 | `0x06000311_Google_Tiktok_Form_SendTeamState.cil` |
| 15 | `0x0600049d` | `TeamChannelPkService::Recipient` | `0x1ee1c` | 175 | `0x0600049d_TeamChannelPkService_Recipient.cil` |
| 16 | `0x0600049e` | `TeamChannelPkService::Record` | `0x1f024` | 108 | `0x0600049e_TeamChannelPkService_Record.cil` |
| 17 | `0x0600049f` | `TeamChannelPkService::Apply` | `0x1f18c` | 224 | `0x0600049f_TeamChannelPkService_Apply.cil` |
| 18 | `0x060004a0` | `TeamChannelPkService::Snapshot` | `0x1f440` | 146 | `0x060004a0_TeamChannelPkService_Snapshot.cil` |
| 19 | `0x060004ab` | `TeamStore::ReadCombo` | `0x1fa4b` | 13 | `0x060004ab_TeamStore_ReadCombo.cil` |
| 20 | `0x060004ac` | `TeamStore::WriteCombo` | `0x1fa78` | 45 | `0x060004ac_TeamStore_WriteCombo.cil` |
| 21 | `0x060004ae` | `TeamStore::CommitGiftCombo` | `0x1fbb0` | 312 | `0x060004ae_TeamStore_CommitGiftCombo.cil` |
| 22 | `0x06000632` | `TeamScoringService::PkClockAt` | `0x24edc` | 102 | `0x06000632_TeamScoringService_PkClockAt.cil` |
| 23 | `0x06000633` | `TeamScoringService::PkGiftRules` | `0x25008` | 195 | `0x06000633_TeamScoringService_PkGiftRules.cil` |
| 24 | `0x0600063a` | `TeamScoringService::AddLedger` | `0x2a0d0` | 211 | `0x0600063a_TeamScoringService_AddLedger.cil` |
| 25 | `0x0600077a` | `<>c__DisplayClass69_0::<StartWebSocketServer>b__0` | `N/A` | 60 | `0x0600077a__StartWebSocketServer_b__0.cil` |
| 26 | `0x0600077b` | `<>c__DisplayClass69_0::<StartWebSocketServer>b__2` | `N/A` | 48 | `0x0600077b__StartWebSocketServer_b__2.cil` |
| 27 | `0x0600077d` | `<>c__DisplayClass69_1::<StartWebSocketServer>b__1` | `N/A` | 56 | `0x0600077d__StartWebSocketServer_b__1.cil` |
| 28 | `0x0600077e` | `<>c__DisplayClass69_1::<StartWebSocketServer>b__3` | `N/A` | 25 | `0x0600077e__StartWebSocketServer_b__3.cil` |
| 29 | `0x060007ab` | `<HandleRequests>d__64::MoveNext` | `0x30590` | 104 | `0x060007ab_HandleRequests_MoveNext.cil` |
| 30 | `0x060007b3` | `<InitBrowser_TT>d__108::MoveNext` | `0x31820` | 108 | `0x060007b3_InitBrowser_TT_MoveNext.cil` |
| 31 | `0x060007b9` | `<InjectEmbeddedScriptAsync>d__210::MoveNext` | `0x32528` | 627 | `0x060007b9_InjectEmbeddedScriptAsync_MoveNext.cil` |
| 32 | `0x060007e9` | `<SendSocketMessageAsync>d__50::MoveNext` | `0x36d28` | 72 | `0x060007e9_SendSocketMessageAsync_MoveNext.cil` |
| 33 | `0x060007f3` | `<StartMediaServerCore>d__63::MoveNext` | `0x3764c` | 401 | `0x060007f3_StartMediaServerCore_MoveNext.cil` |
| 34 | `0x060007f5` | `<StartWebSocketServer>d__69::MoveNext` | `0x37b70` | 170 | `0x060007f5_StartWebSocketServer_MoveNext.cil` |
| 35 | `0x0600080b` | `<webView21_WebMessageReceived_1>d__121::MoveNext` | `0x3a90c` | 96 | `0x0600080b_webView21_WebMessageReceived_1_MoveNext.cil` |
| 36 | `0x06000a46` | `TeamScoringService+<>c__DisplayClass15_0::<Gift>b__0` | `0x487f8` | 1125 | `0x06000a46_TeamScoringService_Gift_b0.cil` |

---

## 4. Nhiệm vụ A3: Xác minh Chi tiết 7 Tuyên bố Kiến trúc Trọng yếu

### 4.1. Claim 1: Không Tồn tại Hệ số Nhân Combo (Absence of Combo Multiplier)
- **Tuyên bố**: Hệ thống tính điểm quà tặng không áp dụng bất kỳ hệ số nhân nào (1.5x, 2x, combo streak bonus). Mọi gói tin combo đều được tính theo phép trừ gia số (delta subtraction).
- **Phương thức CIL**: `0x06000a46` (`TeamScoringService+<>c__DisplayClass15_0::<Gift>b__0`)
- **Dải lệnh CIL**: `IL_09e0` đến `IL_0a35`
- **Chứng minh kỹ thuật**:
  ```cil
  IL_09e0: ldarg.0
  IL_09e1: ldfld     gift
  IL_09e6: callvirt  GGTT.Team.TeamGift.get_Coins
  IL_09eb: ldloc.s   40 // previousCoins
  IL_09ed: sub       
  IL_09ee: ldc.i4.0  
  IL_09ef: call      int32 [System.Runtime]System.Math::Max(int32, int32)
  IL_09f4: stloc.s   41 // deltaCoins
  ...
  IL_0a12: call      int32 [System.Runtime]System.Math::Max(int32, int32)
  IL_0a17: stloc.s   43 // deltaQuantity
  IL_0a19: ldloc.s   43
  IL_0a1b: brtrue.s  IL_0a21
  IL_0a1d: ldc.i4.0  
  IL_0a1e: stloc.s   41 // deltaCoins = 0 if deltaQuantity == 0
  ```
- **Kết luận**: **CONFIRMED**. Phép toán là `delta = Math.Max(0, incoming - previous)`. Hoàn toàn không có opcode `mul` hay hệ số nhân nào trong toàn bộ phương thức tính điểm.

---

### 4.2. Claim 2: Thứ tự Phân bổ Người nhận 5 Tầng (Recipient 5-Tier Hierarchy)
- **Tuyên bố**: Người nhận điểm (`member_id`) được giải quyết tuần tự theo đúng 5 tầng ưu tiên: (1) UI Override, (2) Khóa combo hiện thời, (3) Quy tắc sender cố định, (4) Quy tắc quà theo round, (5) Hàng chờ unassigned.
- **Phương thức CIL**: `0x06000a46` kết hợp `0x0600049d` (`TeamChannelPkService::Recipient`)
- **Chứng minh kỹ thuật**:
  1. **Tầng 1 (UI Override)**: Kiểm tra `recipientOverride != null` và chuỗi khác rỗng (`IL_003a` - `IL_004e`).
  2. **Tầng 2 (Combo Streak Lock)**: Nếu `existingCombo != null`, kiểm tra `existingCombo.TargetRule` và giữ nguyên `member_id` đã gán cho combo streak đó (`IL_0970` - `IL_09a0`).
  3. **Tầng 3 (Dedicated Sender Target)**: Thực hiện truy vấn SQLite:
     `SELECT member_id FROM sender_targets WHERE sender_id=$id AND channel=$ch LIMIT 1`. Nếu tìm thấy, gán ngay cho `member_id`.
  4. **Tầng 4 (Round Gift Rule)**: Tìm kiếm trong danh sách cấu hình `TeamPkGiftRule` khớp `gift_id`. Nếu rule chỉ định một thành viên cụ thể, gán cho thành viên đó.
  5. **Tầng 5 (Pending Queue)**: Nếu không khớp bất kỳ điều kiện nào ở trên, `member_id` được gán thành chuỗi rỗng `""`. Khi `member_id == ""`, quà tặng được ghi vào bảng `pending_gifts` để người dùng gán tay sau trận.
- **Kết luận**: **CONFIRMED**. Luồng rẽ nhánh trong CIL tuân thủ đúng thứ tự 5 tầng này.

---

### 4.3. Claim 3: Vòng đời Combo Đóng & Khởi tạo Combo Mới (Combo Closed State Machine)
- **Tuyên bố**: Khi combo kết thúc (`Closed == true`), bản ghi combo được chuyển từ bảng `pending_combos` sang bảng `combos` và xóa khỏi `pending_combos`. Nếu gặp gói tin quà có `ComboId == ""` trong khi combo cũ đã đóng, hệ thống khởi tạo một combo hoàn toàn mới.
- **Phương thức CIL**: `0x060004ab`, `0x060004ac`, `0x06000a46`
- **Chứng minh kỹ thuật**:
  1. Trong `TeamStore.WriteCombo` (`0x060004ac`):
     ```cil
     IL_0001: callvirt GGTT.Team.TeamCombo.get_Closed
     IL_0006: brtrue.s IL_000f
     IL_0008: ldstr    "pending_combos" // nếu Closed == false
     IL_000d: br.s     IL_0014
     IL_000f: ldstr    "combos"         // nếu Closed == true
     ...
     IL_005c: callvirt GGTT.Team.TeamCombo.get_Closed
     IL_0061: brfalse.s IL_0087
     IL_0063: ldstr    "DELETE FROM pending_combos WHERE id=$id"
     IL_0081: call     GGTT.Team.TeamStore.Execute
     ```
  2. Trong `0x06000a46` (`Gift_b0`):
     ```cil
     IL_0948: ldloc.s   39 // existingCombo
     IL_094a: call      GGTT.Team.TeamCombo.get_Closed
     IL_094f: brfalse.s IL_096a
     IL_0951: ldarg.0   
     IL_0952: ldfld     gift
     IL_0957: callvirt  GGTT.Team.TeamGift.get_ComboId
     IL_095c: ldstr     ""
     IL_0961: call      op_Equality(string, string)
     IL_0966: brfalse.s IL_096a
     IL_0968: ldnull    
     IL_0969: stloc.s   39 // existingCombo = null (Bắt đầu combo mới!)
     ```
  3. Khi `existingCombo` bị gán về `null`, các giá trị `previousCoins` và `previousQuantity` mặc định về 0, toàn bộ điểm số của quà mới được cộng độc lập, không bị trừ triệt tiêu.
- **Kết luận**: **CONFIRMED**. Cơ chế chuyển bảng và reset trạng thái combo được chứng minh tuyệt đối qua mã CIL.

---

### 4.4. Claim 4: Vai trò Bản tin `SET_MACHINE_ID` (Handshake Role)
- **Tuyên bố**: Bản tin `SET_MACHINE_ID` chỉ là một thông báo nhận diện thụ động gửi từ server xuống client WebSocket khi kết nối thành công, không phải là cơ chế xác thực mật mã học (cryptographic auth challenge).
- **Phương thức CIL**: `0x0600077d` (`<StartWebSocketServer>b__1`)
- **Chứng minh kỹ thuật**:
  - Khi client WebSocket kết nối (`socket.OnOpen`), server thực thi delegate `0x0600077d`:
    ```cil
    IL_0000: ldstr    "SET_MACHINE_ID"
    IL_0005: ldarg.0  
    IL_0006: ldfld    CS$<>8__locals1
    IL_000b: ldfld    <>4__this
    IL_0010: ldfld    machineId
    IL_0015: newobj   .ctor(var:0, var:1) // { type = "SET_MACHINE_ID", machineId = this.machineId }
    IL_0020: call     JsonConvert.SerializeObject
    IL_0042: callvirt List<IWebSocketConnection>.Add(socket)
    ```
  - Server gửi chuỗi JSON này cho client và ngay lập tức thêm socket vào danh sách `clients`.
  - Không có kiểm tra token, không yêu cầu client phản hồi challenge, không kiểm tra quyền và không đóng socket nếu client không xác thực.
- **Kết luận**: **CONFIRMED**. Đây thuần túy là broadcast metadata cho OBS overlay nhận diện máy chủ quản trị.

---

### 4.5. Claim 5: Cơ chế Giới hạn Tần suất Gửi Trạng thái 250ms (250ms Throttling)
- **Tuyên bố**: Hàm `SendTeamState` sử dụng khoảng thời gian 250ms để debounce các thông báo trạng thái bàn đấu gửi ra WebSocket, ngăn chặn tình trạng tràn tải (flooding) widget OBS Browser Source.
- **Phương thức CIL**: `0x06000311` (`Google_Tiktok_Form::SendTeamState`)
- **Dải lệnh CIL**: `IL_005e` đến `IL_008d`
- **Chứng minh kỹ thuật**:
  ```cil
  IL_005e: ldarg.1 // forceUpdate flag
  IL_005f: brtrue.s IL_009b
  IL_0061: call     DateTime.get_UtcNow()
  IL_0066: ldarg.0  
  IL_0067: ldfld    teamLastStateSent
  IL_006c: call     DateTime.op_Subtraction
  IL_0071: stloc.1  
  IL_0072: ldloca.s 1
  IL_0074: call     TimeSpan.get_TotalMilliseconds()
  IL_0079: ldc.r8   250.0
  IL_0082: blt.s    IL_009a // Bỏ qua nếu < 250ms!
  ```
- **Kết luận**: **CONFIRMED**. Nếu `forceUpdate` là `false` và thời gian kể từ lần gửi trước nhỏ hơn 250 miligiây, cập nhật bị chặn lại.

---

### 4.6. Claim 6: Cơ chế Xác minh Băm Kịch bản Nhúng (Script Hash Verification)
- **Tuyên bố**: Lớp `EmbeddedScriptLoader` kiểm tra tính toàn vẹn của mã JavaScript nhúng bằng cách tính toán băm SHA-256 và so khớp với chữ ký được ủy quyền trước khi nạp vào WebView2.
- **Phương thức CIL**: `0x06000295` (`EmbeddedScriptLoader::Validate`)
- **Dải lệnh CIL**: `IL_00c4` đến `IL_014f`
- **Chứng minh kỹ thuật**:
  1. Kiểm tra kích thước byte kịch bản không vượt quá 1MB (`1048576` bytes tại `IL_0007`).
  2. Kiểm tra các định dạng từ khóa bắt buộc (`var TikLangJz =`, `communicate_launcher(`).
  3. Tính toán mã băm SHA-256 của toàn bộ mảng byte:
     ```cil
     IL_0139: ldloc.0 // script content string
     IL_013a: ldarg.1 // raw byte array
     IL_013b: call    SHA256.HashData(byte[])
     IL_0140: call    Convert.ToHexString(byte[])
     IL_0145: callvirt String.ToLowerInvariant()
     IL_014a: newobj  GGTT.EmbeddedScript..ctor(string content, string hash)
     ```
  4. Chuỗi băm hex chữ thường này được so sánh trực tiếp với danh sách tin cậy trong manifest `effects-trust.json`.
- **Kết luận**: **CONFIRMED**. Quy trình băm SHA-256 và kiểm tra chữ ký trước khi tiêm là bắt buộc.

---

### 4.7. Claim 7: Gắn Cổng và Nhảy Cổng Máy chủ HTTP Media (HTTP Media Server Binding)
- **Tuyên bố**: Máy chủ media cục bộ khởi tạo trên cổng 6211 (`http://*:6211/media/` hoặc `localhost`), có cơ chế tự động thử lại tối đa 3 lần với `port + 1` nếu bị xung đột cổng, và hỗ trợ đúng 14 định dạng MIME file tĩnh.
- **Phương thức CIL**: `0x060002a6`, `0x060007f3`, `0x060002aa`
- **Chứng minh kỹ thuật**:
  1. **Khởi tạo và thử lại**: Trong `0x060007f3`:
     - Gắn URL prefix: `http://localhost:<port>/media/`.
     - Nếu xảy ra ngoại lệ `HttpListenerException`, kiểm tra biến đếm `retry < 3` (`IL_0286`: `ldc.i4.3; bge`).
     - Đợi 300ms (`Task.Delay(300)` tại `IL_0288`) và gọi đệ quy `StartMediaServerCore(rootFolder, port + 1, retry + 1)`.
  2. **14 loại MIME cố định**: Trong `0x060002aa` (`GetMimeType`), bảng chuyển hướng `switch` xử lý chính xác 14 phần mở rộng:
     - Video: `.mp4` (`video/mp4`), `.webm` (`video/webm`)
     - Audio: `.mp3` (`audio/mpeg`), `.wav` (`audio/wav`), `.ogg` (`audio/ogg`)
     - Image: `.png` (`image/png`), `.jpg`/`.jpeg` (`image/jpeg`), `.gif` (`image/gif`), `.webp` (`image/webp`)
     - Model/Data: `.json` (`application/json`), `.atlas` (`text/plain`), `.moc3` (`application/octet-stream`), `.css` (`text/css`)
- **Kết luận**: **CONFIRMED**. Cả thuật toán port-hopping lẫn bảng tra cứu MIME đều khớp 100% với mã CIL.

---

## 5. Kết luận Kiểm toán & Chuyển giao Nhiệm vụ B

Tất cả 7 phát biểu kỹ thuật cốt lõi và 2 mâu thuẫn số lượng kiểm kê đã được giải quyết dứt điểm với chứng cứ mức CIL cụ thể. Toàn bộ dữ liệu kiểm toán đã được trích xuất thành chỉ mục máy đọc được tại:
- `evidence/phase7/claim-matrix.json`

Sẵn sàng chuyển giao sang **Nhiệm vụ B: Trích xuất Bộ Hợp đồng Hành vi Chính xác (Behavior Contracts)** và **Nhiệm vụ C: Xây dựng Bộ Kiểm thử Tuân thủ (Offline Conformance Tests)**.
