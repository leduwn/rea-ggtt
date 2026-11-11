# Báo cáo Dịch ngược Động cơ Kịch bản & Kỹ xảo Đa lớp (Phase 8 - Visual Effects & Scenario Engine)

- **Mã báo cáo**: `21-effects-and-scenario-engine.md`
- **Mã đặc tả luồng máy đọc**: `evidence/phase8/effects-flow.json`
- **Phân hệ phân tích**: `GGTT.EffectsBridge.Effects` và `GGTT.Effects` (420 phương thức, 66 kiểu dữ liệu)
- **Chuẩn bộ tổng hợp (Compositor)**: `compositor-v2`
- **Giao thức liên tiến trình (IPC)**: Named Pipe (`GGTT.Studio.Launch.*`) kết hợp xác thực chữ ký RSA
- **Ngày hoàn tất**: 2026-11-11

---

## 1. Kiến trúc Phân tầng của Hệ thống Kỹ xảo (Layered Architecture)

Hệ thống kỹ xảo của GGTT được phân tách thành 2 namespace chính với ranh giới trách nhiệm rõ ràng:

```
+---------------------------------------------------------------------------------------+
|                          GGTT VISUAL EFFECTS ARCHITECTURE                             |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   | 1. Quản lý Bản quyền & Tải Hiệu ứng (GGTT.Effects)                           |   |
|   |    - EffectDeliveryClient: Tải danh mục (Catalog), nạp asset (Download)       |   |
|   |    - EffectsBridgeClient: Kênh IPC Client gửi lệnh sang Studio/Player         |   |
|   |    - LicenseEnvelope, OwnedEffect, OwnedEffects: Kiểm tra quyền hiệu ứng     |   |
|   +---------------------------------------+---------------------------------------+   |
|                                           | IPC (Named Pipe + RSA)                    |
|   +---------------------------------------v---------------------------------------+   |
|   | 2. Động cơ Kịch bản & Máy trạng thái (GGTT.EffectsBridge.Effects)             |   |
|   |    - ScenarioEngine: Đánh giá điều kiện, đồng hồ Tick, hàng đợi hành động    |   |
|   |    - ScenarioRule, ScenarioCondition, ScenarioAction, ScenarioRandom          |   |
|   |    - EffectProcessTrust: Xác thực PID, tính toàn vẹn 95 file qua RSA SHA-256 |   |
|   +---------------------------------------+---------------------------------------+   |
|                                           | Layout / Transform                        |
|   +---------------------------------------v---------------------------------------+   |
|   | 3. Bộ Tổng hợp Đa lớp (Compositor V2)                                         |   |
|   |    - CompositeLayer (44 trường cấu hình): content, media, solid, camera, text |   |
|   |    - LayerChromaKey: Tách nền xanh (KeyColor, Similarity, Smoothness, Spill)   |   |
|   |    - InteractionZone: Va chạm vùng hình học (Shape, X, Y, Width, Height)     |   |
|   |    - FaceReaction, CameraCutout, RegionState, ShapeMask, LayerPose, Keyframe   |   |
|   +---------------------------------------+---------------------------------------+   |
|                                           | Render Stream                             |
|   +---------------------------------------v---------------------------------------+   |
|   | 4. Phân phối Tài nguyên (Local Media Server)                                  |   |
|   |    - HttpListener (Port 6211): Truyền phát video MP4/WebM, âm thanh, Live2D    |   |
|   +-------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------+
```

---

## 2. Chi tiết Động cơ Kịch bản (ScenarioEngine Execution Model)

Lớp `GGTT.EffectsBridge.Effects.ScenarioEngine` (`0x02000093`) vận hành một máy trạng thái phản ứng theo sự kiện (event-driven reactive state machine) kết hợp đồng hồ thời gian thực (`Tick`).

### 2.1. Cấu trúc Trạng thái Nội bộ (Internal State Fields)
- `_rules`: Mảng quy tắc `ScenarioRule[]`.
- `_rulesState`: Từ điển `Dictionary<string, ScenarioRuleState>` theo dõi lịch sử bắn của từng quy tắc.
- `_variables`: Bảng biến toàn cục `Dictionary<string, double>` lưu trữ chỉ số kịch bản động.
- `_pending`: Hàng đợi `Queue<ScenarioActionPending>` chứa các hành động chờ đến hạn thực thi.
- `_observed` & `_since`: Lưu thời điểm gần nhất thỏa mãn từng điều kiện (`ScenarioCondition`).
- `_sequence` & `_batch`: Bộ đếm tăng tuần tự để sắp xếp độ ưu tiên thực thi.
- `FiredCount`: Tổng số hành động đã bắn trong phiên hiện tại.
- `Warning`: Cảnh báo an toàn khi hàng đợi vượt ngưỡng (`"Quá nhiều hành động đang chờ; giảm lặp kịch bản."`).

### 2.2. Bộ Từ khóa Điều kiện (Condition Evaluation Grammar)
Phương thức `Evaluate` (`0x0600042f`) phân giải các biểu thức điều kiện sau:

1. **`time`**: Kiểm tra mốc thời gian trôi qua so với ngưỡng cấu hình.
2. **`state`**: So sánh biến nội bộ trong `_variables` bằng toán tử `eq` (bằng) hoặc `ne` (khác).
3. **`data`**: Bóc tách trường dữ liệu từ payload sự kiện TikTok/PK (`EffectEventData::Get`) và so sánh giá trị.
4. **`random`**: Điều kiện ngẫu nhiên theo xác suất xác định (gọi `ScenarioRandom::Test(double probability)` sử dụng `System.Random`).
5. **`collision`**: Kiểm tra giao cắt hình học giữa hai vùng `InteractionZone` hoặc giữa tọa độ khung xương bám đuổi (`AnchorInfo`) với vùng tương tác.
6. **`all`**: Phép toán logic VÀ (conjunction) — tất cả điều kiện con phải đồng thời thỏa mãn.
7. **`any`**: Phép toán logic HOẶC (disjunction) — chỉ cần một điều kiện con thỏa mãn.

### 2.3. Bộ Từ khóa Hành động (Action Dispatch Grammar)
Phương thức `Tick` (`0x0600042e`) xử lý và kích hoạt các hành động theo chu kỳ:

1. **`once`**: Hành động bắn duy nhất một lần trong toàn bộ vòng đời hoặc vòng đấu PK; tự động đánh dấu đã bắn trong `_rulesState`.
2. **`repeat`**: Hành động lặp lại định kỳ sau một khoảng trễ xác định (`intervalMs`).
3. **`set_state`**: Gán trực tiếp giá trị vào bảng biến: `_variables[key] = value`.
4. **`add_state`**: Cộng dồn biến kèm cơ chế kẹp giá trị an toàn: `_variables[key] = Math.Clamp(_variables[key] + delta, min, max)`.
5. **`cancel_pending`**: Hủy bỏ các hành động đang chờ trong hàng đợi `_pending` khớp với điều kiện lọc.
6. **`exit`**: Ngắt luồng kịch bản hiện tại, dừng đánh giá các nhánh con.

---

## 3. Bộ Tổng hợp Đa lớp & Kỹ xảo Hình ảnh (Compositor V2)

GGTT triển khai kiến trúc tổng hợp theo chuẩn `compositor-v2` (`0x70007d46`), quản lý danh sách các lớp `CompositeLayer` (`0x0200007a`).

### 3.1. Các Giới hạn Gói Kỹ xảo (Engine Safety & Package Limits)
Mã kiểm tra tính hợp lệ trong `CompositeRules::Validate` (`0x060003ca`) áp đặt các ràng buộc nghiêm ngặt:
- **Số lớp hiển thị**: Từ 1 đến tối đa 32 lớp (`"Use 1..32 layers."`).
- **Lớp âm thanh**: Tối đa 4 lớp âm thanh trên mỗi gói hiệu ứng (`"Use at most four audio layers per package."`).
- **Phản ứng camera (Face Reaction)**: Tối đa 8 phản ứng camera (`"Use at most 8 camera reactions per package."`).
- **Khóa chuyển động (Track Keys)**: Tối đa 512 keyframes (`"Use 1..512 track keys."`).
- **Điểm bám (Layer Points)**: Tối đa 16 điểm trên mỗi layer (`"Use at most 16 points per layer."`).
- **Hiệu ứng & Mặt nạ nhánh con**: Tối đa 8 hiệu ứng và 8 mặt nạ hình học trên một nhánh cha/con.
- **Hệ tọa độ chuẩn hóa**: Tất cả tọa độ điểm (points) phải nằm trong dải `[0.0, 1.0]`.

### 3.2. Thuật toán Tách nền Xanh (LayerChromaKey)
Lớp `LayerChromaKey` (`0x02000079`) cung cấp bộ tham số tách màu trực tiếp trên GPU/Shader:
- `enabled` (`bool`): Kích hoạt tính năng Chroma Key trên layer.
- `color` (`string`): Mã màu nền cần loại bỏ (chuỗi định dạng Hex RGB: `#00FF00` hoặc `#0000FF`).
- `similarity` (`double`, dải `0.0` đến `1.0`): Ngưỡng độ lệch Euclidean trong không gian màu YUV/RGB; xác định phạm vi màu bị trong suốt.
- `smoothness` (`double`, dải `0.0` đến `1.0`): Hệ số làm mềm biên viền (Anti-aliasing / Feathering) để tránh răng cưa quanh tóc và thân thể.
- `spill` (`double`, dải `0.0` đến `1.0`): Hệ số khử ám màu xanh phản chiếu (Spill Suppression) lên quần áo và da người mẫu.

### 3.3. Các Chế độ Hòa trộn & Khung hình (Blend Modes & Fit Modes)
- **Fit Modes**: `contain` (giữ tỉ lệ vừa khít), `cover` (phủ kín cắt viền), `stretch` (kéo giãn).
- **Blend Modes**: `normal`, `alpha`, `linear`, `add` (cộng sáng), `multiply` (nhân tối), `screen` (chiếu sáng), `luma` (độ sáng), `step` (ngưỡng nhị phân).

---

## 4. Giao thức Liên tiến trình (IPC Protocol & Security Handshake)

Để điều khiển phần mềm hiển thị bên ngoài (GGTT Studio hoặc GGTT Player) mà không bị can thiệp bởi mã độc, GGTT sử dụng cơ chế IPC Named Pipe có xác thực chữ ký:

### 4.1. Cơ chế Tạo Pipe & Định danh Tiến trình
- Tên Named Pipe tuân thủ biểu thức chính quy:
  `^GGTT\.Studio\.Launch\.[a-f0-9]{32}$`
- Khi client kết nối vào pipe, máy chủ gọi `GetNamedPipeClientProcessId` (`0x06000387`) để lấy PID thực của tiến trình phía bên kia.
- `OpenProcess` (`0x06000389`) mở tiến trình với quyền `PROCESS_QUERY_LIMITED_INFORMATION`.
- `QueryFullProcessImageName` (`0x0600038c`) trích xuất đường dẫn tuyệt đối của tệp thực thi.

### 4.2. Quy trình Xác minh Toàn vẹn (EffectProcessTrust::Verify)
Phương thức `0x06000382` thực hiện chuỗi kiểm tra bảo mật:
1. Đọc tệp `effects-trust.json` trong thư mục cài đặt GGTT.
2. Kiểm tra liên kết mềm/cứng (`LocalEffectLibrary::RejectLinks`).
3. Giải mã chữ ký số RSA (`RSA::VerifyData` với chuẩn SHA-256 + PKCS#1 padding) sử dụng khóa công khai cứng 2048-bit lưu tại literal `0x700061e8`.
4. Sau khi chữ ký hợp lệ, giải mã Base64 payload thành danh sách 95 tệp cài đặt hợp pháp.
5. Quét tệp của tiến trình đang kết nối pipe, tính mã băm SHA-256 thực tế và đối soát với danh sách đã ký.
6. Nếu hợp lệ, lưu kết quả vào bộ đệm bộ nhớ đệm (`Dictionary<string, Cached>`) với thời hạn hiệu lực **15 phút** (`DateTime.UtcNow.AddMinutes(15)`).

---

## 5. Khuyến nghị Tái hiện Phòng sạch (Clean-Room Guidelines)

1. **Tách biệt Engine Kịch bản khỏi Engine Đồ họa**:
   - `ScenarioEngine` là một bộ tính toán trạng thái thuần túy (pure state evaluator), không phụ thuộc vào DirectX/OpenGL. Có thể tái hiện bằng bất kỳ ngôn ngữ nào (C#, TypeScript, Rust, Go) dựa trên lược đồ điều kiện/hành động tại `evidence/phase8/effects-flow.json`.
2. **Không sao chép khóa ký RSA**:
   - Không đưa chuỗi khóa cứng độc quyền của GGTT vào mã nguồn mới. Sử dụng mô hình kiểm soát quyền tiến trình tiêu chuẩn (OS-level user isolation hoặc token-based local IPC authentication).
3. **Phân phối Media qua HTTP**:
   - Duy trì máy chủ HTTP tĩnh (Static Media File Server) với các kiểu MIME chuẩn (`video/mp4`, `video/webm`, `image/png`, `application/octet-stream`) để các widget OBS Browser Source có thể nạp tài nguyên mượt mà.
