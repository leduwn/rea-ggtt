# Báo cáo Đối soát Bằng chứng & Xác minh Khẳng định (Phase 9 - Task F)

- **Mã tài liệu**: `32-evidence-reconciliation.md`
- **Dự án**: Nghiên cứu & Dịch ngược Phòng sạch Ứng dụng GGTT (Google TikTok / TikTok Interactive Tool)
- **Tệp ma trận dữ liệu**: `evidence/phase9/claim-verification-matrix.json`
- **Nhánh làm việc Git**: `research/phase9-behavioral-verification`
- **Ngày lập**: 2026-11-11
- **Mục tiêu**: Đối soát toàn diện mọi khẳng định kỹ thuật (Claims) đã đưa ra trong toàn bộ dự án (từ Báo cáo 01 đến 26 và Phase 8), phân định rạch ròi giữa **Bằng chứng CIL đã chứng minh**, **Đặc tả kiến trúc phòng sạch** và **Quan sát thực thi động**, giải quyết dứt điểm các điểm mâu thuẫn nhằm cung cấp bộ cơ sở bằng chứng không thể bác bỏ.

---

## 1. Phương pháp luận Đối soát Bằng chứng (Evidence Reconciliation Methodology)

Để ngăn chặn các sai sót suy diễn chủ quan hoặc ảo giác kỹ thuật, mỗi khẳng định trong Phase 9 được đánh giá qua ma trận 4 lớp kiểm chứng:
1. **Lớp 1: Căn cứ Nhị phân CIL (Binary Proof)**: Phải chỉ ra được chính xác mã hàm (`MethodDef Token`), độ lệch lệnh máy CIL (`IL Offset`), toán tử (`OpCode`) và toán hạng (`Operand` chuỗi/hằng số/token).
2. **Lớp 2: Kiểm thử Tuân thủ Ngoại tuyến (Conformance Testing)**: Mô phỏng hành vi độc lập trong `tests/conformance/run_tests.js` (TC1 đến TC11) đạt 100% tỷ lệ vượt qua mà không cần runtime gốc.
3. **Lớp 3: Kiểm thử Đột biến Phản biện (Mutation Testing)**: Phải tiêu diệt được đột biến tương ứng trong `tests/verification/mutation_tests.js` (Điểm số 11/11 killed = 100%), chứng minh bài test không circular.
4. **Lớp 4: Kiểm thử Ranh giới & Bất thường (Boundary Testing)**: Phải vượt qua các thử thách giá trị biên trong `tests/verification/boundary_tests.js` (15/15 passed).

---

## 2. Bảng Tổng hợp Đối soát 12 Khẳng định Kỹ thuật Trọng yếu

| Mã | Khẳng định Kỹ thuật (Claim) | Phân hệ (Subsystem) | Phân loại Ranh giới | Mức Độ Tin Cậy | Trạng thái Đột biến |
|:---:|---|---|:---:|:---:|:---:|
| **CLM-01** | Công thức tính Combo Delta quà tặng | Live PK Scoring | `CIL_PROVEN` | `CERTAIN` (Tuyệt đối) | KILLED (MUTANT_01) |
| **CLM-02** | Thứ tự phân giải 5 tầng người nhận | Live PK Scoring | `CIL_PROVEN` | `CERTAIN` (Tuyệt đối) | KILLED (MUTANT_02) |
| **CLM-03** | Vòng đời và đặt lại chuỗi combo quà | Live PK Scoring | `CIL_PROVEN` | `CERTAIN` (Tuyệt đối) | KILLED (MUTANT_03) |
| **CLM-04** | Ranh giới giao dịch ACID & SQLite WAL | Data Persistence | `MIXED_SPECIFICATION` | `HIGH` (Đặc tả) | KILLED (MUTANT_08) |
| **CLM-05** | Giao thức WebSocket & Debounce 250ms | Overlay Server | `CIL_PROVEN` | `CERTAIN` (Tuyệt đối) | KILLED (MUTANT_09) |
| **CLM-06** | 14 MIME Types & Nhảy cổng Media | Overlay Server | `CIL_PROVEN` | `CERTAIN` (Tuyệt đối) | KILLED (MUTANT_10) |
| **CLM-07** | Băm SHA-256 kịch bản nhúng WebView2 | TikTok Ingestion | `CIL_PROVEN` | `CERTAIN` (Tuyệt đối) | KILLED (MUTANT_11) |
| **CLM-08** | Hàng đợi kịch bản 256 & Kẹp số học state | Scenario Engine | `CIL_PROVEN` | `CERTAIN` (Tuyệt đối) | KILLED (MUTANT_04) |
| **CLM-09** | Ngưỡng góc Squat & OBS WebSocket v5 | AI Pose Tracking | `CIL_PROVEN` | `CERTAIN` (Tuyệt đối) | KILLED (MUTANT_05) |
| **CLM-10** | Giải mã Win32 Hotkey & Scancode phím | Game Automation | `CIL_PROVEN` | `CERTAIN` (Tuyệt đối) | KILLED (MUTANT_06) |
| **CLM-11** | Hợp nhất sổ cái live_ledger (UNION ALL) | Data Persistence | `CIL_PROVEN` | `CERTAIN` (Tuyệt đối) | KILLED (MUTANT_07) |
| **CLM-12** | Chữ ký RSA & Named Pipe Studio | Process Trust | `CIL_PROVEN` | `CERTAIN` (Tuyệt đối) | CIL Verified (REA) |

---

## 3. Phân tích Chi tiết Từng Khẳng định & Giải quyết Mâu thuẫn

### 3.1. Khẳng định CLM-01: Tính toán Combo Delta Quà tặng
- **Khẳng định ban đầu**: Điểm combo chỉ lấy phần chênh lệch `delta = current - previous`, nếu gói tin tụt số thì gán về 0.
- **Bằng chứng CIL**: Phương thức `0x06000a46` tại `IL_09e0 - IL_0a35` chứa chuỗi lệnh `sub`, `ldc.i4.0`, `call Max`, đặc biệt tại `IL_0a19` kiểm tra nếu `deltaQuantity == 0` thì bắt buộc `deltaCoins = 0`.
- **Giải quyết sai lệch**: Trong một số phân tích sơ bộ ở Phase 5, có giả định rằng nếu deltaQuantity = 0 thì vẫn có thể cộng deltaCoins nếu streak tiếp diễn. Phân tích CIL chính thức bác bỏ giả định này: phải có sự tăng về số lượng quà mới được tính điểm xu.

### 3.2. Khẳng định CLM-02: Phân cấp 5 Tầng Người nhận Quà
- **Khẳng định ban đầu**: Hệ thống gán điểm theo cấu hình chọn streamer trên giao diện.
- **Bằng chứng CIL**: `0x06000a46` và `0x0600049d` chứng minh thứ tự ưu tiên 5 cấp cố định:
  1. `UI Override`: Ghi đè chỉ định từ giao diện người dùng.
  2. `Existing Combo Target`: Streamer đang nhận chuỗi combo quà đó.
  3. `Sender Target`: Mục tiêu người gửi chỉ định trong sự kiện TikTok.
  4. `Round Rule Target`: Quy tắc gán điểm mặc định của vòng đấu PK.
  5. `Pending`: Nếu không xác định được, đẩy vào hàng đợi chờ xử lý thủ công.
- **Giải quyết sai lệch**: Không có cơ chế tự động chia đều (round-robin) ngầm định. Nếu rỗng, hệ thống rơi vào trạng thái `Pending`.

### 3.3. Khẳng định CLM-04: Giới hạn Giao dịch ACID & Tính Bất biến
- **Khẳng định ban đầu**: Mọi thao tác ghi điểm đều là atomic transaction trong SQLite.
- **Bằng chứng CIL & Phân loại**: Phân tích `0x060004ae` (`CommitGiftCombo`) và `0x0600063a` (`AddLedger`) cho thấy mã nguồn sử dụng cơ chế kiểm soát tương tranh lạc quan (Optimistic Concurrency Control) thông qua cột `revision` và ghi nhật ký kiểm toán vào `ledger_changes`, chứ không duy trì lock transaction dài hạn.
- **Phân loại chính xác**: Đổi từ `CIL_PROVEN` thuần túy sang `MIXED_SPECIFICATION`. Đặc tả phòng sạch yêu cầu driver CSDL phải đảm bảo tính ACID khi thực thi chuỗi câu lệnh này.

### 3.4. Khẳng định CLM-08 & CLM-09: Hàng đợi Kịch bản & Ngưỡng Góc Khớp Gối
- **Khẳng định ban đầu**: Kịch bản hiệu ứng thực thi không giới hạn và nhận diện squat dựa trên khoảng cách tọa độ Y của hông.
- **Bằng chứng CIL**:
  - `0x0600042e`: Có chỉ lệnh `ldc.i4 256` và `Enumerable.Take(256)`, giới hạn cứng hàng đợi 256 hành động.
  - `0x060008e8`: Nhận diện squat dựa trên **góc hình học khớp gối** được tính từ 3 điểm (Hông, Gối, Cổ chân) với các ngưỡng góc tuyệt đối: $> 160^\circ$ (Đứng), $< 140^\circ$ (Hạ người), $\le 100^\circ$ (Ngồi xổm), chứ không dùng khoảng cách pixel tương đối.
- **Ý nghĩa phòng sạch**: Loại bỏ hoàn toàn phỏng đoán về việc dùng pixel offset phụ thuộc độ phân giải màn hình.

---

## 4. Đánh giá Rủi ro Pháp lý & Khuyến nghị Cho Nhóm Phòng sạch (Clean-Room Team)

1. **Nguyên tắc "Ý tưởng vs Biểu đạt" (Idea-Expression Dichotomy)**:
   - Các thuật toán tính toán (Combo delta, góc gối squat, kẹp sigmoid $[-80, 80]$, debounce 250ms) là **nguyên lý toán học và quy trình kỹ thuật**, hoàn toàn được phép tái triển khai tự do theo luật sở hữu trí tuệ.
   - Tuyệt đối **không sao chép nguyên văn** các token chuỗi độc quyền của GGTT (ví dụ: khóa công khai RSA `0x700061e8`, các chuỗi thông báo tiếng Việt có bản quyền, hoặc tên biến sinh tự động của trình biên dịch).
2. **Cách ly Triệt để**:
   - Nhóm kỹ sư viết mã phòng sạch (Implementation Team) chỉ được tiếp cận tài liệu này (`32-evidence-reconciliation.md`), tài liệu đặc tả API (`reports/29-deep-algorithm-verification.md`) và bộ test harness (`tests/conformance/run_tests.js`).
   - Nhóm viết mã không được tiếp cận tệp nhị phân gốc `GGTT.dll` hay các bản dịch ngược thô CIL.
