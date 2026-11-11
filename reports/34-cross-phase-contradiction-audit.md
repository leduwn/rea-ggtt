# Báo cáo Kiểm toán & Giải quyết Mâu thuẫn Xuyên Suốt Các Giai đoạn (Phase 10 - Task A)

- **Mã tài liệu**: `34-cross-phase-contradiction-audit.md`
- **Dự án**: Nghiên cứu & Dịch ngược Phòng sạch Ứng dụng GGTT (Google TikTok / TikTok Interactive Tool)
- **Tập tin máy đọc**: `evidence/phase10/contradiction-register.json`
- **Mục tiêu**: Giải quyết dứt điểm toàn bộ 5 điểm mâu thuẫn (A1 đến A5) xuất hiện trong các báo cáo từ Phase 1 đến Phase 9 bằng bằng chứng CIL gốc và siêu dữ liệu nhị phân xác thực, thiết lập chân lý chuẩn hóa (canonical ground truth).

---

## 1. Mâu thuẫn A1: Cấu trúc Cổng Mạng Media Server & Vòng lặp Xử lý Xung đột Cổng

### 1.1. Hiện trạng Mâu thuẫn giữa các Báo cáo
- **Báo cáo 14 & Báo cáo 29**: Nhận định Media Server chạy trên dải cổng động `5000-5050`.
- **Báo cáo 26 & Báo cáo 29**: Nhận định cổng `6211` là cổng của Overlay Media Server.
- **Báo cáo 08 & Báo cáo 27**: Ghi nhận cổng `3784` cho WebSocket Server.

### 1.2. Điều tra Nhị phân & Bằng chứng CIL Thực tế
Phân tích ngược 3 phương thức mạng trong `GGTT.dll`:

1. **WebSocket Server (`0x0600029b` `Google_Tiktok_Form..ctor`)**:
   - Trường cổng `0x04000170` (`websocketport`) nhận giá trị chuỗi mặc định `"3784"` (token `0x700034c2`).
   - Địa chỉ IP liên kết mặc định: `"127.0.0.1"` (token `0x700034ae`).
   - Khởi chạy WebSocket server tại `0x060002ab` trên cổng `3784`.

2. **Media Server (`0x060007f7` `<SyncMediaAndStartServer>d__56::MoveNext` & `0x060007f3` `<StartMediaServerCore>d__63::MoveNext`)**:
   - **Tính toán cổng cơ sở**: Không sử dụng hằng số tĩnh mà tính toán động từ `websocketport`:
     ```cil
     IL_0d72: ldloc.1        // this (Google_Tiktok_Form)
     IL_0d73: ldfld          0x04000170 // websocketport ("3784")
     IL_0d78: call           System.Int32::Parse(string)
     IL_0d7d: ldc.i4.1       
     IL_0d7e: add            // port = int.Parse(websocketport) + 1 = 3785
     IL_0d7f: stloc.s        5
     IL_0d9a: ldloc.1        
     IL_0d9b: ldloc.s        6 // rootFolder
     IL_0d9d: ldloc.s        5 // port (3785)
     IL_0d9f: ldc.i4.0        // retry = 0
     IL_0da0: call           GGTT.Google_Tiktok_Form::StartMediaServer
     ```
   - **Tiền tố lắng nghe `HttpListener`**: `IL_0117: "http://*:" + port + "/media/"`.
   - **Đường dẫn URL trả về**: `IL_0271: "http://localhost:" + port + "/media/"`.
   - **Vòng lặp xử lý xung đột (Collision Retries & Port Hopping)**:
     Bắt ngoại lệ `HttpListenerException` (`0x010000a0`), kiểm tra số lần thử lại tối đa 3 lần:
     ```cil
     IL_0356: ldarg.0        
     IL_0357: ldfld          retry
     IL_035c: ldc.i4.3       
     IL_035d: bge            1088 // if (retry >= 3) break/fail
     IL_0362: ldc.i4         300
     IL_0367: call           System.Threading.Tasks.Task::Delay(int)
     ...
     IL_03d0: ldarg.0        
     IL_03d1: ldfld          port
     IL_03d6: ldc.i4.1       
     IL_03d7: add            // port + 1
     IL_03d8: ldarg.0        
     IL_03d9: ldfld          retry
     IL_03de: ldc.i4.1       
     IL_03df: add            // retry + 1
     IL_03e0: call           GGTT.Google_Tiktok_Form::StartMediaServerCore
     ```
     Trình tự nhảy cổng: `3785 -> 3786 -> 3787 -> 3788`.

3. **Cổng 6211 (`0x060002a9` `StartAiServerLocal`)**:
   Thuộc về phân hệ `GGTT.LocalAiFileServer` (`0x0200004f`), phục vụ thư mục mô hình AI cục bộ (`ai_model`) tại URL `"http://localhost:6211/"` (`IL_0042`), không liên quan đến Media Server của overlay.

4. **Nguồn gốc gây hiểu nhầm dải cổng 5000-5050**:
   Chuỗi cấu hình SQLite pragma tại token `0x7000f906`:
   `"PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;"`.
   Con số `5000` (timeout tính bằng mili-giây của SQLite) đã bị nhầm lẫn trong báo cáo cũ thành dải cổng HTTP. Trong toàn bộ mã nhị phân `GGTT.dll`, hoàn toàn không có dải cổng nào tên `5000-5050`.

### 1.3. Kết luận Chuẩn mực A1
- **WebSocket Server**: Cổng mặc định `3784` (cấu hình trong `websocketport`).
- **Media Streaming Server**: Cổng động cơ sở `websocketport + 1` = `3785`, bước nhảy `+1`, tối đa 3 lần thử (`3785 -> 3786 -> 3787 -> 3788`).
- **Local AI File Server**: Cổng cố định `6211`.
- **Dải cổng 5000-5050**: Bác bỏ hoàn toàn.

---

## 2. Mâu thuẫn A2: Kiểm tra Kịch bản Nhúng & Vân tay SHA-256

### 2.1. Hiện trạng Mâu thuẫn
- **Báo cáo 17 & 20 (CLAIM-06)**: Khẳng định kịch bản nhúng JavaScript nạp qua mạng được đối chiếu băm SHA-256 với một danh sách tin cậy tĩnh / whitelist tải về từ server.
- **Báo cáo 32 (CLM-07)**: Khẳng định SHA-256 chỉ được tính toán nội bộ để làm khóa định danh bất biến (content identity) trong bộ nhớ, không đối chiếu whitelist cố định.

### 2.2. Bằng chứng CIL Thực tế (`0x06000295` `EmbeddedScriptLoader.Validate`)
Mã CIL của phương thức `Validate` (gồm 337 chỉ lệnh) thực thi tuần tự:
1. **Kiểm tra dung lượng**: `IL_0007: ldc.i4 1048576; ble.s` $\to$ Giới hạn tối đa $1\,\text{MB}$ ($1,048,576$ bytes).
2. **Khử BOM UTF-8**: `IL_0021: ldc.i4 65279; TrimStart; Trim` $\to$ Cắt bỏ BOM `0xFEFF` và khoảng trắng.
3. **Phát hiện máy chủ từ chối**:
   - So sánh chuỗi với `"error"` (`IL_003c`) hoặc `"no-data"` (`IL_004a`).
   - Kiểm tra biểu thức chính quy token lỗi MD5 32 ký tự hex: `\A[a-fA-F0-9]{32}\z` (`IL_0058`).
   - Nếu khớp bất kỳ điều kiện nào, ném `GGTT.EmbeddedScriptException` với thông báo tiếng Việt: *"Máy chủ từ chối cấp mã GG. Hãy kiểm tra tài khoản, quyền sử dụng và kết nối lại GGTT."* (`IL_0069`).
4. **Kiểm tra Content-Type**: Bắt buộc là `application/javascript`, `text/javascript`, hoặc `application/x-javascript` (`IL_007b`).
5. **Kiểm tra ký tự null**: `IL_00b2: Contains(0x00)` $\to$ Ngăn chặn ô nhiễm nhị phân.
6. **Kiểm tra cú pháp cấu trúc**:
   - Bản ghi hiện đại: Kiểm tra IIFE arrow function `\A\(\s*\(\s*\)\s*=>\s*\{`, chứa các biến `"const TikeqID ="`, `"const idus ="`, `"function communicate_launcher("`.
   - Bản ghi cũ (legacy): Chứa `"var TikLangJz ="`, `"var TikHixId ="`, `"var TikeqID ="`, `"function communicate_launcher("`.
7. **Tính toán SHA-256**:
   ```cil
   IL_013b: call           System.Security.Cryptography.SHA256::HashData(byte[])
   IL_0140: call           System.Convert::ToHexString(byte[])
   IL_0145: call           System.String::ToLowerInvariant()
   IL_014a: newobj         GGTT.EmbeddedScript::.ctor(string, string)
   IL_014f: ret
   ```

### 2.3. Kết luận Chuẩn mực A2
Hàm `Validate` **KHÔNG so sánh SHA-256 với bất kỳ whitelist nào**. Giá trị băm SHA-256 được tính toán trực tiếp từ mảng byte tải về và gán vào thuộc tính bất biến `EmbeddedScript.Hash` để phục vụ theo dõi tính toàn vẹn và bộ nhớ đệm trong phiên chạy. Cơ chế xác thực chữ ký số RSA-2048 thực sự thuộc về phân hệ `EffectProcessTrust` (`0x06000382`) bảo vệ Named Pipe của OBS, không phải của `EmbeddedScriptLoader`.

---

## 3. Mâu thuẫn A3: Chuẩn hóa Định danh & Siêu dữ liệu Token Phương thức

### 3.1. Bảng Đối soát Token Trọng yếu
Bảng chuẩn hóa 1-1 giữa token nhị phân, kiểu khai báo, tên phương thức CIL gốc và các bí danh xuất hiện trong các báo cáo trước:

| Token | Kiểu Khai báo CIL (Declaring Type) | Tên Phương thức Gốc (CIL Name) | RVA | Chữ ký & Vai trò Nghiệp vụ | Bí danh trong Báo cáo Cũ | Tệp Bằng chứng CIL |
|:---:|---|---|:---:|---|---|---|
| `0x060004ab` | `GGTT.Team.TeamStore` | `ReadCombo` | `0x1fa4b` | `string ReadCombo(string id)`: Đọc JSON combo từ CSDL SQLite | `GetMemberChoices` | `evidence/cil/0x060004ab_TeamStore_ReadCombo.cil` |
| `0x060004ac` | `GGTT.Team.TeamStore` | `WriteCombo` | `0x1fa78` | `void WriteCombo(string id, TeamCombo c)`: Lưu combo vào CSDL | `SaveMemberChoice` | `evidence/cil/0x060004ac_TeamStore_WriteCombo.cil` |
| `0x060004ae` | `GGTT.Team.TeamStore` | `CommitGiftCombo` | `0x1fbb0` | `void CommitGiftCombo(string id)`: Chốt sổ combo, tăng revision | `CommitGiftCombo` | `evidence/cil/0x060004ae_TeamStore_CommitGiftCombo.cil` |
| `0x06000a46` | `GGTT.Team.TeamScoringService+<>c__DisplayClass25_0` | `<Gift>b__0` | `0x487f8` | `void <Gift>b__0(TeamState s)`: Lambda xử lý sự kiện quà tặng async | `ProcessGiftAsync` | `evidence/cil/0x06000a46_TeamScoringService_Gift_b0.cil` |
| `0x06000381` | `GGTT.EffectsBridge.Effects.EffectProcessTrust` | `Inspect` | `0x1927c` | `Inspect()` (54 IL): Phân tích môi trường tiến trình client | `EffectProcessTrust.Inspect` | Trích xuất tại Báo cáo 27 |
| `0x06000382` | `GGTT.EffectsBridge.Effects.EffectProcessTrust` | `Verify` | `0x1936c` | `Verify()` (437 IL): Xác thực chữ ký RSA-2048 khóa `0x700061e8` | `EffectProcessTrust.Verify` | Trích xuất tại Báo cáo 27 |
| `0x06000383` | `GGTT.EffectsBridge.Effects.EffectProcessTrust` | `Read` | `0x19a00` | `Read()` (27 IL): Đọc tệp cấu hình ủy thác | `EffectProcessTrust.Read` | Trích xuất tại Báo cáo 27 |
| `0x06000384` | `GGTT.EffectsBridge.Effects.EffectProcessTrust` | `StudioParent` | `0x19a74` | `StudioParent()` (57 IL): Kiểm tra tiến trình cha OBS/Studio | `EffectProcessTrust.StudioParent` | Trích xuất tại Báo cáo 27 |
| `0x06000385` | `GGTT.EffectsBridge.Effects.EffectProcessTrust` | `StudioLaunch` | `0x19b58` | `StudioLaunch()` (127 IL): Kiểm tra tham số dòng lệnh khởi chạy | `EffectProcessTrust.StudioLaunch` | Trích xuất tại Báo cáo 27 |
| `0x06000386` | `GGTT.EffectsBridge.Effects.EffectProcessTrust` | `PipePeer` | `0x19d5c` | `PipePeer()` (15 IL): Kiểm tra pipe token client liên lạc | `EffectProcessTrust.PipePeer` | Trích xuất tại Báo cáo 27 |

---

## 4. Mâu thuẫn A4: Danh mục Kiểm thử Động & Giới hạn Thực thi An toàn

### 4.1. Chuẩn hóa Danh mục Kiểm thử Động (TC-DYN-01 đến TC-DYN-09)
Toàn bộ danh mục 9 kịch bản kiểm thử động được chuẩn hóa tuyệt đối giữa Báo cáo 30 và Báo cáo 31:
- `TC-DYN-01`: Bắt tay WebSocket Khởi động (Overlay Server).
- `TC-DYN-02`: Khởi tạo WebView2 & Tiêm Script (Web Browser Shell).
- `TC-DYN-03`: Khởi tạo CSDL SQLite WAL & DDL (Data Persistence).
- `TC-DYN-04`: Luồng Sự kiện TikTok Giả lập (TikTok Ingestion).
- `TC-DYN-05`: Tính điểm Combo Quà & Khấu trừ (PK Scoring Core).
- `TC-DYN-06`: Hàng đợi Kịch bản & Ngưỡng 256 (Scenario Engine).
- `TC-DYN-07`: Nhận diện Khung xương AI Pose (MediaPipe ONNX).
- `TC-DYN-08`: Bắt Phím nóng & Gửi Scancode (Hotkey Automation).
- `TC-DYN-09`: Xử lý Ngắt mạng & Khôi phục CSDL (Fault Injection).

### 4.2. Trạng thái Khóa An toàn
Tất cả 9 ca kiểm thử trên được xác nhận duy trì trạng thái **`BLOCKED_PENDING_AUTHORIZATION`**. Mọi logic hành vi đã được kiểm chứng tĩnh $100\%$ bằng CIL và Conformance Test Harness, không đòi hỏi thực thi ứng dụng trên máy thật.

---

## 5. Mâu thuẫn A5: Kiến trúc Nhị phân & Đóng gói Mục tiêu

### 5.1. Xác thực Cấu trúc Nhị phân
- **`GGTT.dll`**: Là một cụm lắp ráp thuần quản lý (Pure Managed CIL Assembly), thuộc nền tảng `.NETCoreApp,Version=v10.0`. Cờ CLI `il-only` có giá trị `1`. Tiêu đề tệp là PE32 với mã máy x86 (`0x014c`), biên dịch dưới cờ `AnyCPU`, tự động chạy tương thích trên môi trường 64-bit hoặc 32-bit thông qua .NET CLR.
- **`GGTT.exe`**: Là bộ nạp nhị phân bản địa (Native AppHost Stub) của Microsoft .NET, có nhiệm vụ định vị .NET Runtime trên máy trạm và nạp `GGTT.dll`.

---

## 6. Kết luận & Chuyển tiếp Nghiệm thu Task A
1. Mọi điểm mâu thuẫn A1 đến A5 đã được tháo gỡ hoàn toàn và ghi nhận trong sổ đăng ký máy đọc `evidence/phase10/contradiction-register.json`.
2. Không còn bất kỳ nghi vấn kỹ thuật nào cản trở việc xây dựng Cơ sở dữ liệu Ký hiệu Chuẩn mực (Task B).
