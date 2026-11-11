# Luồng Bóc tách Sự kiện TikTok Livestream (Pipeline A - TikTok Live Event Ingestion)

- **Thời gian lập**: 2026-11-11
- **Phân hệ**: Tầng Trình diễn & Thu thập Dữ liệu (`GGTT.Google_Tiktok_Form`, `GGTT.EmbeddedScriptLoader`, `GGTT.EmbeddedScriptDocument`)
- **Tài liệu tham chiếu**:
  - `evidence/cil/0x060002c9_Google_Tiktok_Form_InitBrowser_TT.cil`
  - `evidence/cil/0x060007b3_InitBrowser_TT_MoveNext.cil`
  - `evidence/cil/0x06000300_Google_Tiktok_Form_InjectEmbeddedScriptAsync.cil`
  - `evidence/cil/0x060007b9_InjectEmbeddedScriptAsync_MoveNext.cil`
  - `evidence/cil/0x0600028f_EmbeddedScriptLoader_GetAsync.cil`
  - `evidence/cil/0x06000295_EmbeddedScriptLoader_Validate.cil`
  - `evidence/cil/0x0600025b_EmbeddedScriptDocument_Bootstrap.cil`
  - `evidence/cil/0x0600025c_EmbeddedScriptDocument_Inject.cil`
  - `evidence/cil/0x0600025d_EmbeddedScriptDocument_Acknowledged.cil`
  - `evidence/cil/0x060002d2_Google_Tiktok_Form_webView21_WebMessageReceived_1.cil`
  - `evidence/cil/0x0600080b_webView21_WebMessageReceived_1_MoveNext.cil`

---

## 1. Sơ đồ Kiến trúc & Luồng Dữ liệu Bóc tách (Pipeline Architecture)

```
[TikTok Live Web (Chromium / WebView2)]
       │
       │ (1) InitBrowser_TT (0x060002c9 / 0x060007b3)
       ▼ EnsureCoreWebView2Async, IsScriptEnabled = true
[CoreWebView2 Container]
       │
       │ (2) InjectEmbeddedScriptAsync (0x060007b9)
       ├──────────────────────────────────────────────┐
       ▼ (Tải mã từ xa qua HTTP GET)                  ▼ (Kiểm tra an toàn URL)
[GGTT.EmbeddedScriptLoader.GetAsync]          [DesktopSafety.IsTikTokUrl]
       │ (0x0600028f)                                 │
       ▼ Xác thực cấu trúc mã                         │
[EmbeddedScriptLoader.Validate (0x06000295)]          │
  - Content-Type: application/javascript              │
  - Check Token từ chối: \A[a-fA-F0-9]{32}\z          │
  - Check hàm hook: communicate_launcher              │
  - Check biến môi trường: TikeqID, TikLangJz         │
  - Băm SHA-256 toàn vẹn mã nguồn                     │
       │                                              │
       ▼ Sinh mã nhúng có xác thực                    │
[EmbeddedScriptDocument.Bootstrap (0x0600025b)] ◄─────┘
       │ Đặt window.__ggttEmbeddedCode = { token, state: 'ready' }
       ▼
[EmbeddedScriptDocument.Inject (0x0600025c)]
       │ State Gating: 'ready' -> 'executing' -> 'installed'
       ▼
[CoreWebView2.ExecuteScriptAsync]
       │
       ▼ (3) Phản hồi xác nhận ({ ggttEmbeddedReady: token })
[EmbeddedScriptDocument.Acknowledged (0x0600025d)]
       │
       ▼ (4) Runtime Hook phát sự kiện qua window.chrome.webview.postMessage()
[webView21_WebMessageReceived_1 (0x060002d2 / 0x0600080b)]
       │ WebViewBridge.TryRead -> JSON Event Payload
       ▼
[TeamScoringService & Overlay Dispatcher]
```

---

## 2. Chi tiết Giải mã CIL Từng Giai đoạn

### Giai đoạn 1: Khởi tạo WebView2 (`InitBrowser_TT`)
- **Tọa độ CIL**: `0x060002c9` (Entry) -> Máy trạng thái `<InitBrowser_TT>d__108` (`0x060007b3`).
- **Phân tích CIL**:
  - `IL_001f - IL_0087`: Ghi log chẩn đoán luồng giao diện:
    `"InitBrowser_TT: InvokeRequired=" + InvokeRequired + ", Thread=" + CurrentManagedThreadId + ", WebViewTikTokHandle=" + IsHandleCreated`.
  - `IL_008d`: Gọi `initizated_TT` để kích hoạt `EnsureCoreWebView2Async(userDataFolder)`.
  - `IL_00ea`: Ghi nhận `"InitBrowser_TT EnsureCoreWebView2Async thành công"`.
  - `IL_00fa - IL_011a`: Đặt trang khởi đầu là `"about:blank"` và kích hoạt thuộc tính thực thi script:
    `CoreWebView2.Settings.IsScriptEnabled = true`.

---

### Giai đoạn 2: Tải & Xác thực Kịch bản Bóc tách (`EmbeddedScriptLoader`)
- **Tọa độ CIL**:
  - `GGTT.EmbeddedScriptLoader.GetAsync` (`0x0600028f`): Quản lý luồng tải bất đồng bộ kèm khóa `gate` (Monitor `Enter(object, bool&)`).
  - `GGTT.EmbeddedScriptLoader.Validate` (`0x06000295`): 123 CIL instructions.
- **Tiêu chí kiểm định nhị phân bắt buộc trong `Validate`**:
  1. **Giới hạn kích thước**:
     - `IL_0006: ldc.i4 1048576 (1MB)` -> Ném `InvalidResponse` nếu mảng byte > 1MB.
  2. **Lọc chuỗi lỗi từ máy chủ**:
     - `IL_003c: ldstr "error"` -> Bác bỏ.
     - `IL_004a: ldstr "no-data"` -> Bác bỏ.
  3. **Kiểm tra Token từ chối cấp phép (License Rejection)**:
     - `IL_0058: ldstr "\\A[a-fA-F0-9]{32}\\z"` (Chuỗi mã băm 32 ký tự hex MD5 trả về khi hết hạn dùng).
     - `IL_0069: ldstr "Máy chủ từ chối cấp mã GG. Hãy kiểm tra tài khoản, quyền sử dụng và kết nối lại GGTT."`
     - `IL_006f: newobj GGTT.EmbeddedScriptException..ctor` -> Ném ngoại lệ ngắt phiên.
  4. **Kiểm tra Content-Type**:
     - Phải thuộc 1 trong 3 MIME: `"application/javascript"`, `"text/javascript"`, `"application/x-javascript"`.
  5. **Kiểm tra Ký tự Rỗng (Null-byte Sanitization)**:
     - `IL_00b4: Contains('\0')` -> Nếu chứa byte `0x00`, ném `InvalidResponse`.
  6. **Nhận diện Mẫu mã Nguồn Bóc tách (Syntax Fingerprinting)**:
     - **Phiên bản Desktop**:
       - `StartsWith("var TikLangJz =")`
       - `Contains("var TikHixId =")`
       - `Contains("var TikeqID =")`
       - `Contains("function communicate_launcher(")`
     - **Phiên bản Mobile**:
       - Khớp Regex `\A\(\s*\(\s*\)\s*=>\s*\{`
       - `Contains("const TikeqID =")`
       - `Contains("const idus =")`
       - `Contains("function communicate_launcher(")`
  7. **Mã băm Toàn vẹn (Integrity Checksum)**:
     - `IL_013b: SHA256.HashData(payload)` -> `ToHexString().ToLowerInvariant()`.
     - Đóng gói thành `new EmbeddedScript(code, hash)`.

---

### Giai đoạn 3: Cơ chế Bơm Mã An toàn (`EmbeddedScriptDocument`)
Cơ chế bơm mã hoạt động thông qua một đối tượng bảo vệ trạng thái runtime trên trình duyệt: `window.__ggttEmbeddedCode`.

#### Bước 3.1: Khởi động DOM (`Bootstrap`, Token `0x0600025b`)
Tạo đoạn mã JavaScript khởi động có kiểm tra nguồn URL:
```javascript
(() => {
  if (location.href.split('#')[0] !== "<escapedUrl>") return 'stale';
  const old = window.__ggttEmbeddedCode;
  if (old && ['executing', 'installed', 'failed'].includes(old.state)) return old.state;
  window.__ggttEmbeddedCode = { token: "<guid_token>", state: 'ready' };
  return 'ready';
})()
```

#### Bước 3.2: Bơm Kịch bản Nghiệp vụ (`Inject`, Token `0x0600025c`)
Ràng buộc chặt chẽ trạng thái và token phiên:
```javascript
if (!window.__ggttEmbeddedCode || 
    window.__ggttEmbeddedCode.token !== "<guid_token>" || 
    window.__ggttEmbeddedCode.state !== 'ready') {
  throw new Error('GGTT_EMBED_STALE');
}
window.__ggttEmbeddedCode.state = 'executing';

// --- MÃ BÓC TÁCH NGUYÊN BẢN TỪ JQSVN.COM ---

;window.__ggttEmbeddedCode.state = 'installed';
({ ggttEmbeddedReady: "<guid_token>" });
```

#### Bước 3.3: Thẩm định Phản hồi (`Acknowledged`, Token `0x0600025d`)
- Dùng `JsonDocument.Parse(response)` để trích xuất `RootElement.GetProperty("ggttEmbeddedReady")`.
- Nếu giá trị không bằng token đã phát ra -> Ghi nhận lỗi `GGTT_EMBED_STALE` và yêu cầu tải lại.

---

### Giai đoạn 4: Tiếp nhận Sự kiện TikTok từ Trình duyệt (`webView21_WebMessageReceived_1`)
- **Tọa độ CIL**: `0x060002d2` -> Máy trạng thái `0x0600080b`.
- **Cơ chế tiếp nhận**:
  - Script trong WebView2 gửi thông điệp thông qua API:
    `window.chrome.webview.postMessage(JSON.stringify(payload))`.
  - C# lắng nghe sự kiện `WebMessageReceived`.
  - `GGTT.WebViewBridge.TryRead` bóc tách chuỗi JSON sang đối tượng sự kiện.
  - Phân luồng sự kiện:
    - Sự kiện quà tặng (`gift`): Chuyển tới `TeamScoringService.Gift`.
    - Sự kiện điều khiển hiệu ứng (`effects_bridge`): Chuyển tới `HandleLauncherCommandAsync`.
    - Sự kiện lỗi DOM / mạng: Kích hoạt ghi log lỗi qua `GGTT.AppLogger.Error`.

---

## 3. Đặc tả Giao thức Dữ liệu Nhúng (Data Contract Specification)

### 3.1. Cấu trúc Sự kiện Quà tặng TikTok (Inbound Gift JSON Schema)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TikTokGiftEvent",
  "type": "object",
  "required": ["type", "giftId", "giftName", "diamondCount", "userId", "nickname", "timestamp"],
  "properties": {
    "type": { "type": "string", "enum": ["gift", "comment", "like", "member", "room_status"] },
    "giftId": { "type": "string" },
    "giftName": { "type": "string" },
    "diamondCount": { "type": "integer", "minimum": 1 },
    "quantity": { "type": "integer", "minimum": 1, "default": 1 },
    "comboCount": { "type": "integer", "minimum": 1, "default": 1 },
    "comboId": { "type": "string" },
    "isComboFinished": { "type": "boolean", "default": false },
    "userId": { "type": "string" },
    "secUid": { "type": "string" },
    "nickname": { "type": "string" },
    "avatar": { "type": "string", "format": "uri" },
    "timestamp": { "type": "integer" }
  }
}
```

### 3.2. Vector Kiểm thử Mẫu (Synthetic Test Vectors)

#### Vector 1: Quà đơn (Single Gift - Hoa hồng)
```json
{
  "type": "gift",
  "giftId": "5655",
  "giftName": "Rose",
  "diamondCount": 1,
  "quantity": 1,
  "comboCount": 1,
  "comboId": "",
  "isComboFinished": true,
  "userId": "718294019283",
  "secUid": "MS4wLjABAAAA...",
  "nickname": "NguyenVanA",
  "avatar": "https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/sample.webp",
  "timestamp": 1731308400
}
```

#### Vector 2: Quà chuỗi combo đang tiếp diễn (Active Combo Streak)
```json
{
  "type": "gift",
  "giftId": "5655",
  "giftName": "Rose",
  "diamondCount": 15,
  "quantity": 15,
  "comboCount": 15,
  "comboId": "combo_718294019283_5655_1731308410",
  "isComboFinished": false,
  "userId": "718294019283",
  "secUid": "MS4wLjABAAAA...",
  "nickname": "NguyenVanA",
  "avatar": "https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/sample.webp",
  "timestamp": 1731308415
}
```

---

## 4. Đánh giá Mức độ Hoàn thiện & Khuyến nghị Clean-Room

- **Mức độ xác minh**: **CONFIRMED 100%**. Toàn bộ cơ chế injection, mã kiểm định cấu trúc, mã băm SHA-256 và máy trạng thái `ready -> executing -> installed` đã được chứng minh qua 11 file mã CIL chi tiết.
- **Khuyến nghị cho Clean-Room**:
  - Không cần thiết lập kiến trúc injection phức tạp nếu triển khai client độc lập bằng thư viện giao thức WebSocket TikTok trực tiếp (như `TikTokLiveSharp` hoặc Rust protocol client).
  - Nếu vẫn sử dụng WebView2, phải tuân thủ cơ chế State Gating kèm `token` để ngăn chặn chèn trùng lặp script khi trang livestream tự động reload hoặc chuyển luồng mạng.
