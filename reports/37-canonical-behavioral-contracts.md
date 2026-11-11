# Báo cáo Đóng băng Khế ước Hành vi Chuẩn mực (Phase 10 - Task D)

- **Mã tài liệu**: `37-canonical-behavioral-contracts.md`
- **Dự án**: Nghiên cứu & Dịch ngược Phòng sạch Ứng dụng GGTT (Google TikTok / TikTok Interactive Tool)
- **Thư mục Đặc tả Phòng sạch**: `specifications/`
- **Mục tiêu**: Đóng băng chính thức và bất biến toàn bộ các khế ước hành vi (Formal Behavioral Contracts) của hệ thống GGTT, cung cấp các đặc tả kỹ thuật chi tiết để nhóm phát triển phòng sạch độc lập xây dựng lại phần mềm mà không cần tiếp cận mã nguồn gốc hay vi phạm bản quyền.

---

## 1. Tuyên bố Đóng băng Khế ước Kỹ thuật (Contract Freeze Declaration)

Sau khi hoàn tất quá trình kiểm toán mâu thuẫn (Task A), lập chỉ mục siêu dữ liệu nhị phân (Task B), và giải mã các phương thức trọng yếu (Task C), toàn bộ các quy tắc nghiệp vụ, công thức toán học, cấu trúc dữ liệu và giao thức mạng của GGTT chính thức được **ĐÓNG BĂNG BẤT BIẾN** theo 6 tài liệu đặc tả chuẩn hóa:

| Mã Đặc tả | Tên Khế ước Hành vi | Tập tin Đặc tả Chi tiết | Phân hệ Ánh xạ | Khẳng định Bằng chứng CIL |
|:---:|---|---|---|:---:|
| **`SPEC-01`** | Khế ước Tính điểm PK & Định tuyến Quà tặng | `specifications/01-scoring-engine-contract.md` | `LIVE_PK_TEAM_SCORING` | `CLM-01`, `CLM-02`, `CLM-11` |
| **`SPEC-02`** | Khế ước Lưu trữ Sổ cái SQLite & Tính Bất biến | `specifications/02-data-persistence-contract.md` | `DATA_PERSISTENCE_LIFECYCLE` | `CLM-03`, `CLM-04` |
| **`SPEC-03`** | Khế ước Giao thức Mạng, Tô-pô Cổng & Media | `specifications/03-network-protocol-contract.md` | `WEBSOCKET_OVERLAY_MEDIA_SERVER` | `CLM-05`, `CLM-06`, `A1` |
| **`SPEC-04`** | Khế ước Điều phối Kịch bản & Giới hạn Hàng đợi | `specifications/04-scenario-engine-contract.md` | `VISUAL_EFFECTS_SCENARIO_ENGINE` | `CLM-08` |
| **`SPEC-05`** | Khế ước Nhận dạng AI Pose & Giao thức OBS v5 | `specifications/05-ai-pose-tracking-contract.md` | `AI_POSE_TRACKING_OBS` | `CLM-09` |
| **`SPEC-06`** | Khế ước Ranh giới Bảo mật, Script & IPC Win32 | `specifications/06-security-boundaries-contract.md` | `CROSS_CUTTING_SECURITY` | `CLM-07`, `CLM-10`, `CLM-12`, `A2` |

---

## 2. Tóm tắt Các Bất biến Toán học & Thuật toán Cốt lõi

### 2.1. Công thức Tính Điểm Combo Quà Tặng (`SPEC-01`)
- Không áp dụng bất kỳ hệ số nhân nào.
- Tính toán độ lệch cộng dồn:
  $$\Delta \text{Quantity} = \max(0, \text{Gift.Quantity} - \text{Combo.Quantity})$$
  $$\Delta \text{Coins} = \max(0, \text{Gift.Coins} - \text{Combo.Coins})$$
- Nếu $\Delta \text{Quantity} = 0 \implies \Delta \text{Coins} = 0$.

### 2.2. Cây Quyết định Định tuyến 5 Tầng (`SPEC-01`)
Luồng xác định người nhận quà ngắn mạch tuần tự:
1. Ghi đè thủ công từ giao diện (`overrideMemberId`).
2. Khóa chuỗi combo đang hoạt động (`ExistingCombo.TargetRule`).
3. Quy tắc người gửi cố định (`sender_targets`).
4. Quy tắc quà theo round đấu (`TeamPkGiftRule`).
5. Hàng đợi chưa gán (`pending_gifts`, `member_id = ""`).

### 2.3. Quy tắc Sổ cái & Kiểm soát Tương tranh Lạc quan SQLite (`SPEC-02`)
- Thiết lập bắt buộc: `PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;`.
- Tự động sao lưu `backups/before-continuous-{timestamp}.db` trước khi chạy DDL migration.
- Cập nhật bản ghi kèm tăng `revision = revision + 1` để đảm bảo tính bất biến và phát hiện xung đột dữ liệu.

### 2.4. Tô-pô Cổng & Nhảy Cổng Media (`SPEC-03`)
- **WebSocket Overlay**: Cổng `3784` trên `127.0.0.1`.
- **Media HTTP Streaming**: Cổng cơ sở `websocketport + 1 = 3785`, bước nhảy `+1`, tối đa 3 lần thử (`3785 -> 3786 -> 3787 -> 3788`), trễ `300ms`.
- **Local AI Server**: Cổng `6211` phục vụ thư mục `ai_model`.
- **Debounce 250ms**: Điều tiết phát trạng thái `team_state` tối thiểu cách nhau 250ms.
- **Từ điển MIME**: 14 định dạng cố định, mặc định là `application/octet-stream`.

### 2.5. Hàng đợi Kịch bản & Kẹp Số học (`SPEC-04`)
- Khống chế tối đa 256 hành động được xử lý mỗi tick (`Enumerable.Take(256)`).
- Biến số trạng thái được kẹp chặt trong khoảng $[-1,000,000, 1,000,000]$.

### 2.6. Nhận dạng AI Pose & Giao thức OBS (`SPEC-05`)
- Hàm Sigmoid kẹp an toàn: $\text{Sigmoid}(x) = \frac{1}{1 + e^{-\text{clamp}(x, -80, 80)}}$.
- Lưới neo 3 tầng: 2,254 anchor box ($1568 + 392 + 294$).
- Máy trạng thái squat: `STANDING` ($> 160^\circ$) $\to$ `DESCENDING` ($< 140^\circ$) $\to$ `SQUATTING` ($\le 100^\circ$) $\to$ `STANDING` ($> 160^\circ \implies \text{reps}++$).
- Xác thực OBS WebSocket v5 bằng mã hóa băm kép SHA-256 (`salt`, `challenge`).

### 2.7. Ranh giới Bảo mật Kịch bản Nhúng (`SPEC-06`)
- Thẩm định kịch bản nhúng: $\le 1\,\text{MB}$, khử BOM, không chứa byte null, đúng MIME, kiểm tra regex lỗi từ chối `\A[a-fA-F0-9]{32}\z`.
- Băm SHA-256 làm căn cước định danh nội bộ bất biến trong bộ nhớ.
- Không sao chép khóa công khai RSA proprietary `0x700061e8`.

---

## 3. Quy tắc Triển khai Phòng sạch (Clean-Room Rules)

1. **Nguyên tắc Phân tách Tuyệt đối**: Các kỹ sư tham gia viết mã ứng dụng mới không được xem trực tiếp mã dịch ngược CIL hoặc tệp nhị phân gốc `GGTT.dll`. Chỉ được phép đọc và triển khai dựa trên 6 tài liệu đặc tả trong thư mục `specifications/`.
2. **Cổng Kiểm thử Tuân thủ (Quality Gate)**: Sử dụng bộ kiểm thử tuân thủ độc lập (`tests/conformance/run_tests.js`) và bộ kiểm thử biên (`tests/verification/boundary_tests.js`) để xác nhận sản phẩm mới đáp ứng 100% yêu cầu kỹ thuật mà không vi phạm bản quyền.
