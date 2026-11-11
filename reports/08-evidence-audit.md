# Báo cáo Kiểm toán Bằng chứng Kỹ thuật (Phase 6 - Technical Evidence Audit)

- **Thời gian lập**: 2026-11-11
- **Đối tượng kiểm toán**: Toàn bộ hệ thống báo cáo kỹ thuật Phase 1–5 (`reports/01-environment.md` đến `reports/07-reconstruction-roadmap.md`) đối chiếu với file nhị phân gốc `C:\Program Files (x86)\GGTT\GGTT.exe` và `GGTT.dll`.
- **Mục tiêu**: Thẩm định tính chính xác của các kết luận kỹ thuật, truy xuất nguồn gốc bằng chứng gốc (Raw Evidence, CIL opcodes, Metadata tokens, String literals), phân biệt bằng chứng về sự tồn tại của hàm với bằng chứng về hành vi thực tế, và chính thức điều chỉnh mức độ xác minh (Downgrade/Upgrade) theo chuẩn mực kỹ thuật khắt khe.

---

## 1. Phương pháp & Tiêu chuẩn Phân loại Mức độ Xác minh

Tất cả các khẳng định kỹ thuật trong toàn bộ dự án dịch ngược GGTT được chuẩn hóa theo 3 cấp độ:
1. **CONFIRMED (Đã xác minh bằng chứng nhị phân)**:
   - Có tọa độ CIL chính xác (`MethodDef` token, RVA, Instruction offset).
   - Có chuỗi lệnh CIL giải mã đầy đủ chứng minh logic thực thi (branching, call targets, exception blocks, state machines).
   - Có dữ liệu #US string literals, TypeDef, MemberRef hoặc schema SQLite khớp hoàn toàn.
2. **INFERRED (Suy luận kỹ thuật hợp lý nhưng chưa có mã nhị phân cố định)**:
   - Dựa trên tên hàm, tham số, sự xuất hiện của thư viện phụ thuộc bên thứ ba hoặc cấu hình động từ người dùng.
   - Không có chuỗi cố định (hardcoded constants) hoặc thuật toán nội bộ trong CIL mà do phía server/client ngoại vi quyết định.
3. **UNKNOWN / SPECULATIVE (Mục tiêu dự kiến hoặc chưa có dữ liệu đo đạc)**:
   - Các thông số hiệu năng, benchmark chưa qua đo lường thực nghiệm (stress-test).
   - Các cấu trúc dữ liệu bị che giấu hoặc chưa giải mã hết mã máy/mã nguồn đóng phía server từ xa (`jqsvn.com`).

---

## 2. Kiểm toán 5 Mâu thuẫn & Điểm nghi vấn Trọng tâm

### Điểm 1: Mâu thuẫn Target Framework (.NET 8 vs .NET 10)
- **Tình trạng trong báo cáo cũ (02 & 03)**:
  - Một số phần trong báo cáo Phase 2 nêu giả định .NET 8 (do nhầm lẫn với phiên bản LTS phổ biến), trong khi phần khác lại ghi .NET 10.
- **Bằng chứng nhị phân đối soát**:
  - `GGTT.runtimeconfig.json`:
    ```json
    {
      "runtimeOptions": {
        "tfm": "net10.0",
        "frameworks": [
          { "name": "Microsoft.NETCoreApp", "version": "10.0.0" },
          { "name": "Microsoft.WindowsDesktop.App", "version": "10.0.0" }
        ]
      }
    }
    ```
  - Siêu dữ liệu ECMA-335 của `GGTT.dll`:
    - `AssemblyRef` token: `System.Runtime` Version `10.0.0.0`, PublicKeyToken `b03f5f7f11d50a3a`.
    - Custom Attribute: `target_frameworks: [".NETCoreApp,Version=v10.0"]`.
- **Kết luận kiểm toán**:
  - **CONFIRMED: .NET 10.0 (`net10.0`)**. Khẳng định .NET 8 trong các dự thảo ban đầu bị hủy bỏ hoàn toàn. Ứng dụng nhắm mục tiêu chính thức tới .NET 10 Desktop Runtime trên Windows.

---

### Điểm 2: Công thức Tính điểm PK và Chuỗi Combo Quà tặng
- **Tình trạng trong báo cáo cũ (04, 05, 06)**:
  - Báo cáo 04 và 06 suy đoán sự tồn tại của hệ số nhân combo theo cấp số nhân (ví dụ: combo x10, x50, x100 nhân điểm thưởng). Bằng chứng CIL khi đó chưa được giải mã chi tiết.
- **Bằng chứng nhị phân đối soát**:
  - Đã giải mã hoàn chỉnh 1,125 lệnh CIL của phương thức closure nghiệp vụ:
    `GGTT.Team.TeamScoringService+<>c__DisplayClass25_0.<Gift>b__0` (Token `0x06000a46`, RVA `0x02868c`).
  - Kiểm tra bảng tra cứu combo `GGTT.Team.TeamStore.ReadCombo` (Token `0x060004ad`):
    - Khóa combo: `[group, sender_id, gift_id, combo_id != "" ? combo_id : "fallback"]`.
  - Thuật toán số học quà tặng và combo thực tế tại các instruction offset:
    ```cil
    // IL_09be: Tính toán số xu gia số (delta coins)
    IL_09be: ldarg.0
    IL_09bf: ldfld     gift
    IL_09c4: callvirt  GGTT.Team.TeamGift.get_Coins
    IL_09c9: ldloc.s   39  // existingCombo
    IL_09cb: callvirt  GGTT.Team.TeamCombo.get_Coins
    IL_09d0: sub
    IL_09d1: ldc.i4.0
    IL_09d2: conv.i8
    IL_09d3: call      System.Math.Max(int64, int64)
    IL_09d8: stloc.s   15  // deltaCoins

    // IL_09da: Tính toán số lượng gia số (delta quantity)
    IL_09da: ldarg.0
    IL_09db: ldfld     gift
    IL_09e0: callvirt  GGTT.Team.TeamGift.get_Quantity
    IL_09e5: ldloc.s   39
    IL_09e7: callvirt  GGTT.Team.TeamCombo.get_Quantity
    IL_09ec: sub
    IL_09ed: ldc.i4.0
    IL_09ee: call      System.Math.Max(int32, int32)
    IL_09f3: stloc.s   16  // deltaQuantity

    // IL_09f5: Nếu deltaQuantity == 0 thì deltaCoins = 0
    IL_09f5: ldloc.s   16
    IL_09f7: brtrue.s  12
    IL_09f9: ldc.i4.0
    IL_09fa: conv.i8
    IL_09fb: stloc.s   15
    ```
  - Cập nhật combo state:
    `TeamCombo.set_Coins(Math.Max(gift.Coins, existingCombo.Coins))`
    `TeamCombo.set_Quantity(Math.Max(gift.Quantity, existingCombo.Quantity))`
- **Kết luận kiểm toán**:
  - **CONFIRMED: Thuật toán Tích lũy Vi sai (Incremental Delta Accounting)**.
  - GGTT **KHÔNG** hề có công thức nhân điểm combo (không có multiplier x1.5, x2, x3). Vì giao thức TikTok gửi các gói tin combo dồn tích lũy (ví dụ: gửi 1 hoa hồng -> coin=1; combo 2 hoa hồng -> coin=2; combo 5 -> coin=5), GGTT dùng `Math.Max(0, gift.Coins - existingCombo.Coins)` để lấy đúng phần chênh lệch điểm ghi vào `committed_ledger`. Giả thuyết "Combo Multiplier" trong báo cáo cũ chính thức bị bác bỏ.

---

### Điểm 3: Bảng Ánh xạ Quà tặng TikTok sang Lệnh Game Minecraft RCON
- **Tình trạng trong báo cáo cũ (06)**:
  - Báo cáo 06 khẳng định danh sách ánh xạ cụ thể:
    "Tặng hoa hồng -> `/give @p rose 1`"
    "Tặng bom -> `/summon tnt ~ ~ ~`"
    "Tặng sấm sét -> `/summon lightning_bolt`"
- **Bằng chứng nhị phân đối soát**:
  - Rà soát toàn bộ 2,352 chuỗi ký tự `#US` trong `metadata_index.json`:
    - Không tìm thấy bất kỳ chuỗi `/summon`, `/give`, `lightning_bolt`, hay `rose`.
  - Phân tích CIL của `<SendCommandMinecraft>d__114.MoveNext` (Token `0x060007e1`):
    - Lệnh thực thi:
      `IL_0028: ldfld command` -> chuỗi tham số truyền từ ngoài vào.
      `IL_0038: callvirt SendCommandAsync(string, ...)`
    - Lệnh `SendCommandMinecraft` nhận tham số `command` do giao diện cấu hình truyền sang (thông qua WebMessage `minecraft_cmd`).
- **Kết luận kiểm toán**:
  - **DOWNGRADE từ CONFIRMED -> INFERRED (MINH HỌA CẤU HÌNH)**.
  - Các lệnh `/summon tnt`, `/give @p rose 1` chỉ là ví dụ minh họa cho cách người dùng cấu hình trên UI/Webview, **KHÔNG PHẢI** là hằng số nhúng cứng trong mã CIL của `GGTT.dll`.

---

### Điểm 4: Cơ chế Chèn Script Hook Livestream DOM (`__ggttEmbeddedCode`)
- **Tình trạng trong báo cáo cũ (04, 06)**:
  - Báo cáo cũ suy đoán `window.__ggttEmbeddedCode` chỉ là một đoạn script string trần được chèn tùy ý qua `ExecuteScriptAsync`.
- **Bằng chứng nhị phân đối soát**:
  - Toàn bộ cơ chế injection được hiện thực qua một phân hệ lớp có cấu trúc chặt chẽ:
    1. `GGTT.EmbeddedScriptDocument` (`0x02000047`)
    2. `GGTT.EmbeddedScriptRequest` (`0x02000048`)
    3. `GGTT.EmbeddedScript` (`0x02000049`)
    4. `GGTT.EmbeddedScriptLoader` (`0x0200004b`)
    5. `GGTT.EmbeddedScriptException` (`0x0200004a`)
  - Máy trạng thái 3 bước của script hook trong CIL:
    - Bước 1: `EmbeddedScriptDocument.Bootstrap` (`0x0600025b`): Khởi tạo đối tượng `window.__ggttEmbeddedCode = { token: "<guid>", state: 'ready' }`.
    - Bước 2: `EmbeddedScriptDocument.Inject` (`0x0600025c`): Kiểm tra trạng thái `'ready'` và token bảo mật, chuyển sang state `'executing'`, chèn mã nghiệp vụ, rồi đổi state thành `'installed'`. Trả về JSON `{ ggttEmbeddedReady: "<guid>" }`.
    - Bước 3: `EmbeddedScriptDocument.Acknowledged` (`0x0600025d`): Đọc và đối chiếu token phản hồi qua `JsonDocument.Parse`.
  - Tải mã script từ xa an toàn qua `EmbeddedScriptLoader.Validate` (`0x06000295`):
    - Giới hạn kích thước: tối đa 1,048,576 bytes (1 MB).
    - Kiểm tra chữ ký hàm bắt buộc: `communicate_launcher` và `TikeqID`.
    - Băm SHA-256 mã nguồn để xác thực tính toàn vẹn.
- **Kết luận kiểm toán**:
  - **UPGRADE: CONFIRMED VỚI BẰNG CHỨNG CẤU TRÚC ĐẦY ĐỦ**.
  - Cơ chế bóc tách TikTok không phải là một đoạn mã tự do, mà là một hệ thống nạp và thực thi script có kiểm soát vòng đời (Lifecycle & State Gating), ngăn chặn việc chèn mã trùng lặp hoặc thực thi trên trang không hợp lệ.

---

### Điểm 5: Các Con số Benchmark & Hiệu năng trong Reconstruction Roadmap
- **Tình trạng trong báo cáo cũ (07)**:
  - Báo cáo 07 đề ra các chỉ số:
    - "Kiểm thử tải: Giả lập 5.000 quà tặng/giây"
    - "Tiêu thụ RAM: Dưới 150MB"
    - "Tiết kiệm 70% bộ nhớ so với bản gốc"
- **Bằng chứng kỹ thuật đối soát**:
  - Quá trình dịch ngược nhị phân sử dụng phương pháp phân tích tĩnh hoàn toàn (Static Analysis), không thực thi binary hoặc kích hoạt stress test tải thực tế với 5,000 requests/sec.
  - Các con số trong báo cáo 07 thuần túy là **Chỉ tiêu thiết kế kỹ thuật (Engineering Design Targets)** dành cho nhóm phát triển Clean-Room, không phải là kết quả đo lường thực nghiệm từ mã máy của GGTT gốc.
- **Kết luận kiểm toán**:
  - **RECLASSIFIED: SPECIFICATION TARGET (MỤC TIÊU THIẾT KẾ)**, không phải là đặc tính được kiểm chứng của ứng dụng GGTT gốc.

---

## 3. Ma trận Đánh giá & Điều chỉnh Toàn diện 10 Tính năng Báo cáo 06

| STT | Tên Tính năng Nghiệp vụ | Trạng thái Báo cáo Cũ | Trạng thái Sau Kiểm toán | Căn cứ Bằng chứng Kỹ thuật Chính |
|:---:|---|:---:|:---:|---|
| 1 | Bóc tách Livestream TikTok | CONFIRMED | **CONFIRMED** | Lớp `EmbeddedScriptLoader` (`0x0200004b`), CIL `Validate` (`0x06000295`), `Bootstrap` (`0x0600025b`). |
| 2 | Live PK & Tính điểm Quà | CONFIRMED | **CONFIRMED** | CIL closure `0x06000a46`, phép trừ vi sai `Math.Max(0, gift.Coins - existing.Coins)`. |
| 3 | WebSocket Overlay (3784) | CONFIRMED | **CONFIRMED** | `StartWebSocketServer` (`0x060002ab`), Fleck Socket server, JSON dispatch `SendSocketMessageAsync`. |
| 4 | HTTP Media Server (6211) | CONFIRMED | **CONFIRMED** | `StartMediaServerCore` (`0x060002a6`), `GetMimeType` (`0x060002aa`), HttpListener static streaming. |
| 5 | Tương tác Game Minecraft RCON | CONFIRMED | **INFERRED (Minh họa)** | Thư viện `CoreRCON.dll`, hàm `SendCommandMinecraft` (`0x060002ce`). Lệnh game là tham số động từ UI. |
| 6 | AI Pose Tracking Hình phạt | CONFIRMED | **CONFIRMED** | Model ONNX MediaPipe Pose/Person, `ObsTrackingClient` (`0x02000096`), `PunishmentTrackingService` (`0x02000097`). |
| 7 | Kịch bản Hiệu ứng ScenarioEngine | CONFIRMED | **CONFIRMED** | CIL `ScenarioEngine.Tick` (`0x060003ec`, 438 instrs), `Evaluate` (`0x060003ed`, 254 instrs). |
| 8 | Phím nóng Win32 RegisterHotKey | CONFIRMED | **CONFIRMED** | CIL `HotKeyXuLy` (`0x060002b0`), bảng phím `A`, `D`, `S`, `U`, `I`, `O`, `+`, `-` trong #US strings. |
| 9 | Kế toán Quà tặng & Báo cáo CSV | CONFIRMED | **CONFIRMED** | CIL `ExportTeamReport` (`0x0600031b`), `team.db` SQLite schema, header CSV chuẩn. |
| 10 | Xác thực Chống can thiệp tiến trình | CONFIRMED | **CONFIRMED** | CIL `EffectProcessTrust.Verify` (`0x060003f0`, 437 instrs), Public Key nhúng trong nhị phân, P/Invoke Named Pipe. |

---

## 4. Kết luận Đợt Kiểm toán Bằng chứng

Toàn bộ hệ thống bằng chứng trong `evidence/` đã được củng cố với 100% siêu dữ liệu ECMA-335 (2,352 chuỗi ký tự, 502 TypeDefs, 2,685 MethodDefs, 2,959 Fields, và 28 file mã CIL chi tiết). Báo cáo kiểm toán này thiết lập tiêu chuẩn kỹ thuật tin cậy cao nhất cho toàn bộ các pha triển khai tiếp theo.
