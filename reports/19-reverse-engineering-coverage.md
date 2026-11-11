# Báo cáo Độ bao phủ Dịch ngược & Ma trận Phương thức (Phase 8 - Reverse Engineering Coverage Matrix)

- **Mã báo cáo**: `19-reverse-engineering-coverage.md`
- **Mã bằng chứng máy đọc**: `evidence/phase8/coverage-matrix.json`
- **Đối tượng phân tích**: `C:\Program Files (x86)\GGTT\GGTT.dll` (ECMA-335 Managed Assembly)
- **MVID**: `298ab416-d58b-4c6d-8e4a-91f20ef739a1`
- **SHA-256**: `6ee719dd26a248e6295429e523c2220b8e87a4a98168ea0626174aa1fb0ef6b5`
- **Tổng số phương thức (MethodDef)**: 2,685 phương thức
- **Tổng số kiểu dữ liệu (TypeDef)**: 502 kiểu (bao gồm 311 kiểu lồng ghép / compiler-generated)
- **Ngày hoàn tất**: 2026-11-11

---

## 1. Kết quả Kiểm toán & Sửa đổi Tuyên bố Kỹ thuật (Task A1)

### 1.1. Hiệu chỉnh Tuyên bố CLAIM-06: `EmbeddedScriptLoader.Validate` vs `effects-trust.json`

Trong giai đoạn Phase 7, CLAIM-06 đã đưa ra giả thiết rằng `EmbeddedScriptLoader.Validate` (`0x06000295`) thực hiện kiểm tra mã băm SHA-256 của script TikTok tải về đối chiếu với tệp `effects-trust.json`.

Qua kiểm toán chỉ lệnh CIL chuyên sâu tại Phase 8 (`evidence/cil/0x06000295_EmbeddedScriptLoader_Validate.cil` dải lệnh `IL_0139`–`IL_014f`) và phân tích đối tượng `EffectProcessTrust` (`0x06000381`–`0x0600038f`):

1. **Hành vi thực tế của `EmbeddedScriptLoader.Validate` (`0x06000295`)**:
   - Kiểm tra giới hạn kích thước script (tối đa 1MB / `1,048,576` bytes).
   - Kiểm tra các token cú pháp bắt buộc (`var TikLangJz =`, `var TikHixId =`, `var TikeqID =`, `function communicate_launcher(`).
   - Thực hiện tính toán mã băm:
     ```cil
     IL_0139: ldloc.0        // chuỗi mã nguồn JavaScript
     IL_013a: ldarg.1        // byte[] payload từ máy chủ jqsvn.com
     IL_013b: call           SHA256::HashData(u1[])
     IL_0140: call           Convert::ToHexString(u1[])
     IL_0145: callvirt       String::ToLowerInvariant()
     IL_014a: newobj         GGTT.EmbeddedScript..ctor(string, string)
     IL_014f: ret
     ```
   - **Kết luận**: `Validate` chỉ tính SHA-256 để khởi tạo thuộc tính nhận diện của mô hình dữ liệu `EmbeddedScript`, hoàn toàn **KHÔNG** đối soát hay chặn so với bất kỳ manifest ngoại vi nào.

2. **Vai trò thực tế của `effects-trust.json`**:
   - `effects-trust.json` là một tệp manifest mã hóa Base64 kèm chữ ký số RSA (`IL_01c7`: `RSA::VerifyData` với chuẩn `RSASignaturePadding.Pkcs1`).
   - Tệp này chứa danh sách 95 tệp nhị phân (`GGTT.exe`, `GGTT.dll`, `Fleck.dll`, `msedge.dll`, v.v.) cùng kích thước và mã băm SHA-256 tương ứng.
   - Tệp này được tiêu thụ duy nhất bởi phương thức `GGTT.EffectsBridge.Effects.EffectProcessTrust::Verify` (`0x06000382`) để xác minh tính toàn vẹn và bản quyền phát hành của tiến trình Studio/Player trước khi cấp quyền điều khiển hiệu ứng qua Named Pipe.

| Hạng mục đối chiếu | CLAIM-06 (Phase 7 - Cũ) | Đính chính Phase 8 (Chính xác 100% CIL) |
|---|---|---|
| **Mục đích tính SHA-256 của script** | Đối chiếu với manifest `effects-trust.json` | Khởi tạo thuộc tính `EmbeddedScript.Sha256` |
| **Nơi tiêu thụ `effects-trust.json`** | `EmbeddedScriptLoader.Validate` | `EffectProcessTrust::Verify` (`0x06000382`) |
| **Nội dung `effects-trust.json`** | Mã băm script tiêm trình duyệt | 95 tệp nhị phân đã cài đặt trên đĩa + Chữ ký số RSA |
| **Cơ chế từ chối script** | Từ chối khi sai mã băm manifest | Từ chối khi thiếu 4 token cú pháp hoặc quá 1MB |

---

### 1.2. Đối soát Lược đồ Bản tin Overlay (Overlay Message Schema Audit)

Báo cáo [16-protocol-schema-verification.md](16-protocol-schema-verification.md) đề xuất 4 lược đồ giao thức trừu tượng cho clean-room (`SET_MACHINE_ID`, `TEAM_STATE_UPDATE`, `GIFT_EVENT`, `SCENARIO_TRIGGER`). Dưới đây là đối soát với payload tuần tự hóa thực tế tại runtime:

1. **`SET_MACHINE_ID`**:
   - **Vị trí**: `GGTT.Google_Tiktok_Form.<StartWebSocketServer>b__1` (`0x0600077d`).
   - **Cơ chế tuần tự hóa**: Kiểu vô danh `new { type = "SET_MACHINE_ID", machineId = this.machineId }` qua `System.Text.Json.JsonSerializer`.
   - **Đánh giá**: Hoàn toàn trùng khớp giữa đặc tả lý thuyết và mã máy CIL.

2. **`team_state` (Thay thế cho giả định `TEAM_STATE_UPDATE`)**:
   - **Vị trí**: `Google_Tiktok_Form::SendTeamState` (`0x06000311`) và `TeamLocalServer`.
   - **Literal định danh trường `type`**: Là chuỗi `"team_state"` viết thường, không phải `"TEAM_STATE_UPDATE"`.
   - **Cấu trúc thực tế**:
     ```json
     {
       "type": "team_state",
       "data": {
         "state": { ... },
         "ranks": [ ... ],
         "widgetResults": [ ... ],
         "gifts": [ ... ],
         "openGiftCombos": [ ... ],
         "pending": [ ... ],
         "pendingTotal": 0,
         "giftJournal": [ ... ],
         "catalog": [ ... ],
         "channel": "...",
         "status": "...",
         "overlayUrl": "...",
         "serverTime": "2026-11-11T..."
       },
       "access": true,
       "allowed": true,
       "receiving": true
     }
     ```
   - **Đường truyền**: Phát qua cả WebSocket cổng 3784 và `CoreWebView2::PostWebMessageAsJson`.

3. **Luồng sự kiện quà tặng (Thay thế cho giả định `GIFT_EVENT`)**:
   - Quà tặng TikTok Live không được phát trực tiếp dưới dạng bản tin rời `"GIFT_EVENT"` ra WebSocket overlay.
   - Thay vào đó, sự kiện quà tặng đi qua `TeamScoringService::<Gift>b__0` (`0x06000a46`), cập nhật trạng thái trong SQLite (`combos`, `pending_combos`, `gift_journal`), và trạng thái tổng hợp được đồng bộ định kỳ (chu kỳ tối thiểu 250ms) trong payload `"team_state"`.

4. **Lệnh kịch bản kỹ xảo (Thay thế cho giả định `SCENARIO_TRIGGER`)**:
   - Kỹ xảo không dùng WebSocket text JSON thông thường mà truyền qua giao thức IPC Named Pipe của `EffectsBridge` dưới cấu trúc:
     `{{ action = ..., token = ..., grant = ..., frame = ... }}`.
   - Các asset video/ảnh được widget nạp qua máy chủ HTTP Media cổng 6211 (`http://127.0.0.1:6211/media/*`).

---

### 1.3. Định danh Máy trạng thái Bất đồng bộ (Async State Machine Mapping)

Trong `GGTT.dll`, trình biên dịch Roslyn tạo ra **109 kiểu cấu trúc/lớp bất đồng bộ** cài đặt giao diện `IAsyncStateMachine` (dạng `<MethodName>d__*`). 
Để đảm bảo việc phân tích không nhầm lẫn giữa Wrapper Method và Logic thực thi bên trong `MoveNext`, toàn bộ 109 cặp đã được ánh xạ chuẩn mực 100%:

| STT | Lớp bao bọc (Declaring Type) | Phương thức bao bọc (Wrapper Token) | Kiểu State Machine | Phương thức MoveNext Token | Chức năng nghiệp vụ |
|---|---|---|---|---|---|
| 1 | `GGTT.EmbeddedScriptLoader` | `0x06000293` (`DownloadAsync`) | `<DownloadAsync>d__19` | `0x060006ff` | Tải script JavaScript từ jqsvn.com |
| 2 | `GGTT.EmbeddedScriptLoader` | `0x06000294` (`ReadBodyAsync`) | `<ReadBodyAsync>d__20` | `0x06000701` | Đọc byte stream phản hồi HTTP |
| 3 | `GGTT.Google_Tiktok_Form` | `0x060002ab` (`StartWebSocketServer`) | `<StartWebSocketServer>d__202` | `0x060007f5` | Khởi động máy chủ Fleck WebSocket 3784 |
| 4 | `GGTT.Google_Tiktok_Form` | `0x060002a6` (`StartMediaServerCore`) | `<StartMediaServerCore>d__201` | `0x060007f3` | Khởi động máy chủ HTTP Media 6211 |
| 5 | `GGTT.Google_Tiktok_Form` | `0x060002a1` (`SendSocketMessageAsync`) | `<SendSocketMessageAsync>d__198` | `0x060007e9` | Gửi dữ liệu đa phát tới WebSocket clients |
| 6 | `GGTT.Google_Tiktok_Form` | `0x06000300` (`InjectEmbeddedScriptAsync`)| `<InjectEmbeddedScriptAsync>d__85` | `0x060007b9` | Tiêm mã JavaScript vào WebView2 |
| 7 | `GGTT.Google_Tiktok_Form` | `0x060002c9` (`InitBrowser_TT`) | `<InitBrowser_TT>d__84` | `0x060007b3` | Khởi tạo môi trường Chromium WebView2 |
| 8 | `GGTT.Google_Tiktok_Form` | `0x060002d2` (`webView21_WebMessageReceived_1`) | `<webView21_WebMessageReceived_1>d__212` | `0x0600080b` | Bộ nhận sự kiện IPC từ trang TikTok |
| 9 | `GGTT.DesktopLoginClient` | `0x06000223` (`StartAsync`) | `<StartAsync>d__5` | `0x060006f2` | Bắt đầu phiên xác thực desktop |
| 10 | `GGTT.DesktopLoginClient` | `0x06000224` (`WaitForConnectionAsync`) | `<WaitForConnectionAsync>d__6` | `0x060006f4` | Đợi kết nối Named Pipe xác thực |
| ... | *(Xem đầy đủ 109 cặp)* | ... | ... | ... | *Chi tiết trong coverage-matrix.json* |

---

## 2. Ma trận Phân hệ Chức năng Tổng thể (2,685 Phương thức)

Toàn bộ 2,685 MethodDefs của `GGTT.dll` được phân loại vào 10 phân hệ chức năng:

```
+-------------------------------------------------------------------------------+
|                       PHÂN HỆ CHỨC NĂNG GGTT.DLL                              |
+-------------------------------------------------------------------------------+
| 1. COMPILER & INFRASTRUCTURE       :  787 phương thức (29.3%)                 |
| 2. LIVE PK & TEAM SCORING          :  489 phương thức (18.2%)                 |
| 3. UI & FORM LIFECYCLE             :  433 phương thức (16.1%)                 |
| 4. VISUAL EFFECTS & SCENARIO ENGINE:  420 phương thức (15.6%)                 |
| 5. AI POSE TRACKING & OBS          :  130 phương thức ( 4.8%)                 |
| 6. DATA PERSISTENCE & LIFECYCLE    :  117 phương thức ( 4.4%)                 |
| 7. TIKTOK EVENT PIPELINE           :  115 phương thức ( 4.3%)                 |
| 8. CROSS-CUTTING & SECURITY        :  109 phương thức ( 4.1%)                 |
| 9. WEBSOCKET OVERLAY & MEDIA SERVER:   64 phương thức ( 2.4%)                 |
| 10. GAME HOTKEYS & AUTOMATION      :   21 phương thức ( 0.8%)                 |
+-------------------------------------------------------------------------------+
| TỔNG CỘNG                          : 2,685 phương thức (100.0%)               |
+-------------------------------------------------------------------------------+
```

---

## 3. Thống kê Trạng thái Dịch ngược (Verification Status Breakdown)

- **VERIFIED (42 phương thức)**:
  - 36 phương thức có tệp mã máy CIL độc lập tại `evidence/cil/*.cil`.
  - 6 phương thức xác thực lõi của `EffectProcessTrust` (`0x06000381` đến `0x06000386`) đã được dịch ngược đầy đủ dải lệnh và xác minh chữ ký RSA.
- **PARTIALLY_VERIFIED (1,091 phương thức)**:
  - Các phương thức thuộc nghiệp vụ cốt lõi (Scoring, Tracking, Scenario Engine, WebSocket, Persistence) đã xác định rõ chữ ký, kiểu dữ liệu tham số, đồ thị gọi hàm (Call Edges), và các truy cập trường dữ liệu (Field Accesses).
- **UNVERIFIED_STUB (1,552 phương thức)**:
  - Các phương thức tự sinh (Anonymous types `get_*`, `Equals`, `ToString`), closures phụ, accessor thuộc tính giao diện chuẩn Windows Forms, và các hàm tiện ích nhỏ.

---

## 4. Kế hoạch Triển khai các Phân hệ Tiếp theo (Phases 8.B – 8.G)

Dựa trên ma trận phương thức đã phân loại, công tác dịch ngược mở rộng sẽ được tiến hành tuần tự theo các báo cáo chuyên đề:

1. **Task B**: Giao diện & Luồng Điều khiển Ứng dụng (`reports/20-ui-and-application-control-flow.md`).
2. **Task C**: Động cơ Kỹ xảo & Kịch bản Đa lớp (`reports/21-effects-and-scenario-engine.md`, `evidence/phase8/effects-flow.json`).
3. **Task D**: AI Pose Tracking & Tích hợp OBS (`reports/22-ai-pose-and-obs-tracking.md`, `evidence/phase8/tracking-flow.json`).
4. **Task E**: Tích hợp Game Minecraft & Phím Nóng Tự động hóa (`reports/23-game-hotkeys-and-automation.md`).
5. **Task F**: Quản trị Dữ liệu & Chu kỳ Lưu trữ SQLite (`reports/24-persistence-and-lifecycle.md`).
6. **Task G**: Tích hợp Liên Phân hệ & Luồng Dữ liệu Đầu cuối (`reports/25-cross-module-integration.md`).
7. **Task H**: Mở rộng Bộ Kiểm thử Tuân thủ Ngoại tuyến (`tests/conformance/run_tests.js`).
8. **Task I**: Báo cáo Chuyển giao Toàn vẹn Phase 8 (`reports/26-phase8-handoff.md`, `evidence/phase8/sanitized-findings.json`).
