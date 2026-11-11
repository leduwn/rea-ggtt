# GGTT Offline Synthetic Conformance Test Suite (Phase 7)

Bộ kiểm thử tuân thủ ngoại tuyến độc lập phục vụ việc kiểm chứng đặc tả kỹ thuật và hợp đồng hành vi của ứng dụng GGTT mà **hoàn toàn không cần chạy `GGTT.exe` hay nạp assembly `GGTT.dll`**.

---

## 1. Mục tiêu & Nguyên tắc An toàn (Safety & Engineering Rules)

- **Pure Synthetic Inputs**: Sử dụng 100% dữ liệu thử nghiệm giả lập được cấu trúc hóa trong thư mục `fixtures/`.
- **Zero Binary Dependency**: Không tải `GGTT.dll`, không gọi engine .NET CLR nội bộ của ứng dụng gốc.
- **Strict Verification**: Mọi kỳ vọng đầu ra trong `expected/` đều được đối soát khớp từng chỉ lệnh với mã máy CIL trong `evidence/cil/`.
- **Phân loại Rõ ràng**:
  - `VERIFIED_CONFORMANCE`: Các trường hợp kiểm thử hành vi đã được chứng minh trực tiếp từ mã máy CIL gốc.
  - `SPECIFICATION_TEST`: Các quyết định kiến trúc khuyến nghị cho Clean-Room (như tính toàn vẹn giao dịch SQLite ACID).
  - `UNRESOLVED`: Các ranh giới phụ thuộc máy chủ đóng chưa thể xác thực ngoại tuyến.

---

## 2. Cấu trúc Thư mục

```
tests/conformance/
├── README.md                      # Tài liệu hướng dẫn bộ kiểm thử
├── run_tests.js                   # Test runner Node.js độc lập
├── fixtures/                      # Dữ liệu đầu vào giả lập (Synthetic Test Cases)
│   ├── tc1_combo_delta.json       # TC1: Tính toán gia số combo (Math.Max delta)
│   ├── tc2_recipient_hierarchy.json # TC2: Phân bổ người nhận theo thứ tự 5 tầng
│   ├── tc3_combo_lifecycle.json   # TC3: Vòng đời combo pending vs closed
│   ├── tc4_pk_reconciliation.json # TC4: Chốt sổ ledger và ranh giới transaction
│   ├── tc5_websocket_messages.json# TC5: Bắt tay SET_MACHINE_ID & debounce 250ms
│   ├── tc6_mime_resolution.json   # TC6: Tra cứu 14 loại MIME & port hopping
│   └── tc7_script_hash.json       # TC7: Xác minh băm SHA-256 kịch bản nhúng
└── expected/                      # Kết quả kỳ vọng theo chuẩn CIL (Expected Results)
    ├── tc1_combo_delta_expected.json
    ├── tc2_recipient_hierarchy_expected.json
    ├── tc3_combo_lifecycle_expected.json
    ├── tc4_pk_reconciliation_expected.json
    ├── tc5_websocket_messages_expected.json
    ├── tc6_mime_resolution_expected.json
    └── tc7_script_hash_expected.json
```

---

## 3. Danh mục Nhóm Kiểm thử (Test Suites)

| Mã nhóm | Tên Nhóm Kiểm thử | Danh mục Phân loại | Căn cứ CIL Provenance |
|---|---|---|---|
| **TC1** | Combo Delta Calculation | `VERIFIED_CONFORMANCE` | `0x06000a46` (`IL_09e0 - IL_0a35`) |
| **TC2** | Recipient 5-Tier Hierarchy | `VERIFIED_CONFORMANCE` | `0x06000a46`, `0x0600049d` |
| **TC3** | Combo Lifecycle & Reset | `VERIFIED_CONFORMANCE` | `0x060004ab`, `0x060004ac`, `0x06000a46` |
| **TC4** | PK Reconciliation & Tx Boundary | `MIXED` (`CONFORMANCE` + `SPECIFICATION_TEST`) | `0x060004ae`, `0x0600063a` |
| **TC5** | WebSocket Protocol & Throttling | `VERIFIED_CONFORMANCE` | `0x0600077d`, `0x06000311` |
| **TC6** | HTTP MIME Types & Port Hopping | `VERIFIED_CONFORMANCE` | `0x060002aa`, `0x060007f3` |
| **TC7** | Script Hash Integrity Check | `VERIFIED_CONFORMANCE` | `0x06000295` |

---

## 4. Hướng dẫn Chạy Kiểm thử (Execution)

Yêu cầu môi trường: Đã cài đặt Node.js (v18.0.0 trở lên).

```bash
# Từ thư mục gốc của workspace:
node tests/conformance/run_tests.js
```

### Kết quả Chuẩn (Baseline Output):
```
================================================================
       GGTT OFFLINE CONFORMANCE TEST HARNESS (PHASE 7)         
================================================================
...
================================================================
SUMMARY: Total: 55 | Passed: 55 | Failed: 0
STATUS : ALL CONFORMANCE CRITERIA SATISFIED (100% PASS)
================================================================
```
