# Hồ sơ Nghiên cứu Kỹ thuật & Báo cáo Chuyên đề Toàn diện (Phase 10 - Task G)

- **Mã tài liệu**: `40-final-technical-research-dossier.md`
- **Dự án**: Nghiên cứu & Dịch ngược Phòng sạch Ứng dụng GGTT (Google TikTok / TikTok Interactive Tool)
- **Tập tin cơ sở dữ liệu liên kết**:
  * `evidence/phase10/canonical-symbol-index.json`
  * `evidence/phase10/canonical-claims.json`
  * `evidence/phase10/contradiction-register.json`
  * `evidence/phase10/coverage-delta.json`
  * `specifications/` (SPEC-01 đến SPEC-06)
- **Mục tiêu**: Đóng vai trò là Hồ sơ Nghiên cứu Kỹ thuật Chung quyết (Final Technical Research Dossier), tổng hợp toàn bộ tri thức dịch ngược tích lũy qua 10 giai đoạn nghiên cứu, cung cấp cái nhìn toàn diện từ cấu trúc nhị phân, thuật toán cốt lõi, cơ chế bảo mật, đến lộ trình tái thiết kế phòng sạch.

---

## 1. Tóm tắt Điều hành (Executive Summary)

Dự án phân tích và dịch ngược phòng sạch ứng dụng **GGTT** (Google TikTok / TikTok Interactive Tool v1.1.4.12) được tiến hành qua 10 giai đoạn nghiên cứu nghiêm ngặt, tuân thủ nguyên tắc an toàn tuyệt đối (Zero-Host Execution & Strict Read-Only Policy).

### Các Cột mốc Đạt được:
1. **Kiểm kê & Giải mã Toàn vẹn 100% Cấu trúc Nhị phân**:
   - Đối tượng phân tích: `GGTT.dll` (7,709,184 bytes, SHA-256: `6ee719dd26a248e6295429e523c2220b8e87a4a98168ea0626174aa1fb0ef6b5`, MVID: `298ab416-d58b-4c6d-8e4a-91f20ef739a1`).
   - Lập chỉ mục đầy đủ 502 `TypeDef`, 2,685 `MethodDef`, 2,959 `Field`, 2,339 `MemberRef`, và 2,352 chuỗi ký tự người dùng `#US`.
2. **Giải quyết Triệt để 5 Điểm Mâu thuẫn Lịch sử (Task A)**:
   - Thống nhất kiến trúc cổng: WebSocket (`3784`), Media HTTP Server (`3785`, bước nhảy `+1`, max 3 retries đến `3788`), Local AI Server (`6211`), bác bỏ hoàn toàn dải cổng `5000-5050`.
   - Làm rõ vân tay kịch bản nhúng: SHA-256 phục vụ nhận diện nội bộ trong bộ nhớ, không đối chiếu whitelist tĩnh.
   - Chuẩn hóa định danh token vi mã và xác thực 6 phương thức bảo mật `EffectProcessTrust`.
3. **Đóng băng 6 Khế ước Hành vi Phòng sạch (Task D)**:
   - Ban hành các tài liệu đặc tả chuẩn hóa `SPEC-01` đến `SPEC-06` bao trùm toàn bộ thuật toán tính điểm PK, kế toán SQLite, giao thức WebSocket/Media, động cơ kịch bản, AI Pose và ranh giới bảo mật.
4. **Hệ thống Kiểm chứng Độ nhạy Tuyệt đối (Task E)**:
   - 100% ca kiểm thử tuân thủ đạt (54/54 assertions PASS).
   - 100% ca kiểm thử biên đạt (15/15 PASS).
   - 100% đột biến logic toán học bị tiêu diệt (11/11 mutants killed).

---

## 2. Kiến trúc Hệ thống & Ngăn xếp Công nghệ GGTT

Ứng dụng GGTT là một công cụ máy trạm Windows phức hợp gồm 8 tầng công nghệ:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TẦNG GIAO DIỆN & VỎ BỌC                         │
│  - Microsoft WinForms (.NET 10 Desktop App)                             │
│  - Microsoft Edge WebView2 (Chromium Web Runtime & DevTools IPC)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    TẦNG ĐIỀU PHỐI & LOGIC NGHIỆP VỤ                    │
│  - GGTT.Google_Tiktok_Form: Message pump, IPC điều phối trung tâm      │
│  - GGTT.Team.TeamScoringService: Máy trạng thái PK, round, deadline    │
│  - GGTT.Team.TeamChannelPkService: Định tuyến người nhận 5 tầng        │
│  - GGTT.EffectsBridge.ScenarioEngine: Cây điều kiện, hàng đợi 256 tick │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                 TẦNG TRÍ TUỆ NHÂN TẠO & PHẦN CỨNG                      │
│  - Microsoft.ML.OnnxRuntime: Mô hình MediaPipe BlazePose ONNX          │
│  - Đếm Squat: Máy trạng thái góc khớp gối 160° -> 140° -> 100°         │
│  - Tự động hóa: Win32 RegisterHotKey & Phát xung scancode DirectX      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                 TẦNG MẠNG, OVERLAY & LƯU TRỮ DỮ LIỆU                   │
│  - WebSocket Overlay: Fleck Server (ws://127.0.0.1:3784)               │
│  - Media Server: HttpListener (http://*:3785..3788/media/)             │
│  - OBS Integration: OBS WebSocket v5 RPC SHA-256                       │
│  - Persistence: winsqlite3 WAL Mode, busy_timeout=5000, revision lock  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tổng kết 4 Thuật toán Trọng yếu Được Giải mã Cấp độ CIL

### 3.1. Thuật toán Tính Điểm Delta Quà tặng PK (Scoring Engine)
- **Công thức CIL**:
  $$\Delta \text{Coins} = \begin{cases} 0 & \text{nếu } \Delta \text{Quantity} == 0 \\ \max(0, \text{Coins} - \text{Coins}_{\text{prev}}) & \text{ngược lại} \end{cases}$$
- **Quy tắc Thừa kế Streak**: Không nhân hệ số (không có opcode `mul`). Khóa streak và reset khi gặp streak đã đóng với `ComboId` rỗng.

### 3.2. Thuật toán Định tuyến 5 Tầng (Recipient Hierarchy)
- **Thứ tự Ưu tiên Ngắn mạch**:
  1. Ghi đè giao diện (`overrideMemberId != null`).
  2. Khóa chuỗi combo đang chạy (`ExistingCombo.TargetRule`).
  3. Cấu hình người gửi cụ thể (`sender_targets`).
  4. Quy tắc quà của round hiện tại (`TeamPkGiftRule`).
  5. Hàng đợi chưa gán (`pending_gifts`, `member_id = ""`).

### 3.3. Thuật toán Điều phối Kịch bản (Scenario Engine)
- **Đánh giá Cây Điều kiện**: Hỗ trợ đệ quy 4 nhóm điều kiện: `group` (ngắn mạch `all`/`any`), `time` (mốc thời gian, bước nhảy cạnh), `data` (trường dữ liệu động), `random` (xác suất ngẫu nhiên).
- **Điều tiết Hàng đợi & Kẹp Số học**:
  * Giới hạn cứng 256 hành động mỗi chu kỳ tick: `Enumerable.Take(256)`.
  * Kẹp giá trị biến trạng thái: $\text{clamp}(v, -1\,000\,000, 1\,000\,000)$.

### 3.4. Thuật toán Xử lý Khung xương AI Pose (MediaPipe BlazePose)
- **Hàm kích hoạt Sigmoid Kẹp**: $\text{Sigmoid}(x) = \frac{1}{1 + e^{-\text{clamp}(x, -80, 80)}}$.
- **Lưới neo 3 tầng**: Tổng cộng 2,254 anchor box ($28 \times 28 \times 2 + 14 \times 14 \times 2 + 7 \times 7 \times 6$).
- **Máy trạng thái đếm Squat**: `STANDING` ($> 160^\circ$) $\to$ `DESCENDING` ($< 140^\circ$) $\to$ `SQUATTING` ($\le 100^\circ$) $\to$ `STANDING` ($\implies \text{reps}++$).

---

## 4. Ranh giới Bảo mật, Rủi ro & Bản quyền Phòng sạch

1. **Ranh giới Bản quyền & Khóa Bí mật**:
   - Chuỗi khóa công khai RSA-2048 `0x700061e8` trong `EffectProcessTrust`: Phải loại bỏ, thay bằng cặp khóa RSA riêng do nhóm phòng sạch tự sinh.
   - Điểm cuối từ xa: Cấm tuyệt đối việc kết nối đến `jqsvn.com` hoặc webhook Discord cá nhân của tác giả cũ.
2. **An toàn Thực thi**:
   - Mọi hoạt động nạp mã nhị phân gốc trên máy trạm tiếp tục bị khóa (`BLOCKED_PENDING_AUTHORIZATION`).
   - Các đặc tả đã đủ 100% độ sâu toán học và giao thức để nhóm phát triển phòng sạch làm việc độc lập.

---

## 5. Danh mục Tạo phẩm Chuyển giao Toàn dự án (Master Artifact Registry)

### 5.1. Hệ thống Báo cáo Kỹ thuật (Reports 01 đến 41)
- **Phase 1-3 (Nền tảng & Kiến trúc)**: `reports/01-environment.md` đến `05-function-map.md`.
- **Phase 4-5 (Tính năng & Lộ trình)**: `reports/06-feature-analysis.md`, `07-reconstruction-roadmap.md`.
- **Phase 6-7 (Luồng Dữ liệu & Khế ước Sơ khởi)**: `reports/08-evidence-audit.md` đến `18-phase7-handoff.md`.
- **Phase 8-9 (Độ Bao phủ & Xác minh Chiều sâu Thuật toán)**: `reports/19-...` đến `33-phase9-handoff.md`.
- **Phase 10 (Kiểm toán Chung quyết, Cơ sở Dữ liệu Ký hiệu & Đặc tả Đóng băng)**:
  * `reports/34-cross-phase-contradiction-audit.md`: Giải quyết 5 điểm mâu thuẫn A1-A5.
  * `reports/35-canonical-symbol-and-evidence-index.md`: Chỉ mục 2,685 phương thức và siêu dữ liệu.
  * `reports/36-high-value-method-verification.md`: Giải mã 55 phương thức bổ sung và 136 record DTOs.
  * `reports/37-canonical-behavioral-contracts.md`: Tổng kết đóng băng khế ước kỹ thuật.
  * `reports/38-test-validity-and-coverage.md`: Kiểm toán chất lượng kiểm thử tuân thủ và đột biến.
  * `reports/39-external-boundaries-and-security.md`: Đặc tả ranh giới mạng, IPC và an toàn.
  * `reports/40-final-technical-research-dossier.md`: Hồ sơ nghiên cứu kỹ thuật chung quyết.
  * `reports/41-phase10-handoff.md`: Báo cáo nghiệm thu và chuyển giao Phase 10.

### 5.2. Thư mục Đặc tả Phòng sạch (`specifications/`)
- `specifications/01-scoring-engine-contract.md`: Khế ước tính điểm PK và định tuyến quà.
- `specifications/02-data-persistence-contract.md`: Khế ước lưu trữ SQLite WAL và tính bất biến.
- `specifications/03-network-protocol-contract.md`: Khế ước giao thức mạng, cổng và MIME streaming.
- `specifications/04-scenario-engine-contract.md`: Khế ước máy điều phối kịch bản và hàng đợi.
- `specifications/05-ai-pose-tracking-contract.md`: Khế ước AI Pose và xác thực OBS Studio v5.
- `specifications/06-security-boundaries-contract.md`: Khế ước ranh giới bảo mật, kịch bản và IPC.

### 5.3. Cơ sở Dữ liệu Bằng chứng Máy đọc (`evidence/phase10/`)
- `evidence/phase10/contradiction-register.json`: Sổ đăng ký giải quyết mâu thuẫn.
- `evidence/phase10/canonical-symbol-index.json`: Chỉ mục ký hiệu toàn diện 2,685 methods.
- `evidence/phase10/canonical-claims.json`: 12 khẳng định chuẩn mực và 3 giả thuyết bị bác bỏ.
- `evidence/phase10/coverage-delta.json`: Báo cáo độ bao phủ bổ sung phương thức.

### 5.4. Bộ Harness Kiểm thử Tuân thủ Ngoại tuyến (`tests/`)
- `tests/conformance/run_tests.js`: Bộ runner kiểm thử 11 nhóm (TC1-TC11) đạt 100%.
- `tests/verification/boundary_tests.js`: Bộ kiểm thử 15 ca giá trị biên (B1-B6) đạt 100%.
- `tests/verification/mutation_tests.js`: Bộ kiểm thử đột biến diệt 11/11 mutant đạt 100%.

---

## 6. Lời kết & Tuyên bố Sẵn sàng Tái triển khai

Hồ sơ nghiên cứu kỹ thuật GGTT đã hoàn thành với độ tin cậy khoa học và tính chặt chẽ pháp lý cao nhất. Nhóm phát triển phòng sạch độc lập giờ đây có thể tiếp nhận bộ đặc tả `specifications/` và bộ kiểm thử `tests/` để tiến hành lập trình sản phẩm mới hoàn toàn mà không cần tiếp cận mã nguồn dịch ngược gốc.
