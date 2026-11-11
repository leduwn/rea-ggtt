# Nghiên cứu & Dịch ngược Kỹ thuật Ứng dụng GGTT (REA Analysis Project)

Dự án phân tích tĩnh, dịch ngược và tài liệu hóa toàn diện ứng dụng Windows desktop **GGTT** ("Google Tiktok / TikTok Interactive Tool") sử dụng công cụ **REA (Reverse Engineer Anything)** v6.8.0.

Mục tiêu cốt lõi: Phân tích kiến trúc, công nghệ, chức năng, business logic và các luồng xử lý dữ liệu để phục vụ việc nghiên cứu và tái triển khai độc lập (Clean-Room Reconstruction) bằng mã nguồn mới hoàn toàn.

---

## 1. Thông tin Đối tượng Phân tích (Target Specifications)

- **Tên ứng dụng**: GGTT (Google Tiktok Interactive Tool)
- **Tệp thực thi chính (Launcher)**: `C:\Program Files (x86)\GGTT\GGTT.exe`
  - Định dạng: AMD64 PE32+ Executable (175,104 bytes)
  - SHA-256: `a56efabe710a75d12df8c2aacd16870e6bdde371e8f43f22873cad1c2db7d94b`
  - Vai trò: .NET AppHost Bootloader (nạp CLR và ủy quyền cho `GGTT.dll`)
- **Module nghiệp vụ chính (Primary Logic)**: `C:\Program Files (x86)\GGTT\GGTT.dll`
  - Định dạng: ECMA-335 CLI Managed Assembly (7,709,184 bytes)
  - SHA-256: `6ee719dd26a248e6295429e523c2220b8e87a4a98168ea0626174aa1fb0ef6b5`
  - MVID: `298ab416-d58b-4c6d-8e4a-91f20ef739a1`
  - Phiên bản: `1.1.4.12`
  - Target Framework: `.NETCoreApp,Version=v10.0` kết hợp `Microsoft.WindowsDesktop.App`
  - Thống kê: 502 TypeDefs, 2,685 MethodDefs, 2,959 Fields, 17,073 Call Edges, 2,352 User Strings.
- **Thư mục cài đặt**: `C:\Program Files (x86)\GGTT` (360 files đã đối soát chuẩn mực)
- **Workspace phân tích**: `rea-ggtiktok`

---

## 2. Cấu trúc Thư mục Dự án Workspace

```
rea-ggtiktok/
├── README.md                           # Báo cáo tổng quan dự án
├── reports/                            # Hệ thống báo cáo kỹ thuật 7 Phase chuẩn mực
│   ├── 01-environment.md               # Phase 1: Môi trường REA, host, providers
│   ├── 02-binary-inventory.md          # Phase 2: Kiểm kê nhị phân, PE headers, imports, checksums
│   ├── 03-technology-stack.md          # Phase 2: Phân tích 8 tầng công nghệ & ma trận clean-room
│   ├── 04-architecture.md              # Phase 3: Kiến trúc phân tầng, UI/CIL, SQLite, IPC
│   ├── 05-function-map.md              # Phase 3: Bản đồ hàm, CIL instruction anchors, token RVA
│   ├── 06-feature-analysis.md          # Phase 4: Phân tích 10 tính năng cốt lõi & data flows
│   ├── 07-reconstruction-roadmap.md   # Phase 5: Lộ trình tái triển khai độc lập (Clean-Room)
│   ├── 08-evidence-audit.md            # Phase 6: Kiểm toán toàn diện bằng chứng, giải quyết 5 mâu thuẫn
│   ├── 09-tiktok-event-pipeline.md     # Phase 6: Pipeline A - Bóc tách sự kiện TikTok Live
│   ├── 10-team-pk-scoring.md           # Phase 6: Pipeline B - Tính điểm Live PK & kế toán quà tặng
│   ├── 11-overlay-protocol.md          # Phase 6: Pipeline C - WebSocket overlay & HTTP media server
│   ├── 12-remaining-unknowns.md        # Phase 6: Ranh giới jqsvn.com, binary đóng & nhật ký rủi ro
│   ├── 13-phase7-consistency-audit.md  # Phase 7: Giải quyết mâu thuẫn 282 vs 360, 36 CIL, 7 claims
│   ├── 14-verified-behavior-contracts.md # Phase 7: Bộ hợp đồng hành vi chính thức được chứng minh
│   ├── 15-combo-accounting-edge-cases.md # Phase 7: Phân tích toán học 12 trường hợp biên kế toán
│   ├── 16-protocol-schema-verification.md# Phase 7: Lược đồ JSON WebSocket & bảng tra cứu 14 MIME
│   ├── 17-clean-room-specification.md  # Phase 7: Bản đặc tả kiến trúc kỹ thuật phòng sạch hoàn chỉnh
│   └── 18-phase7-handoff.md            # Phase 7: Báo cáo tổng kết và chuyển giao toàn dự án
├── evidence/                           # Bằng chứng kỹ thuật Clean-Room (Derived Artifacts)
│   ├── flows/                          # Đặc tả JSON cấu trúc luồng của 3 pipeline trọng điểm
│   └── phase7/                         # Ma trận claim-matrix, contract-provenance, unresolved-claims
│   # Ghi chú: Các tệp phân tích nhị phân thô (CIL disassembly, raw #US dumps, binary inventories)
│   # được lưu giữ cục bộ ngoại tuyến và loại trừ khỏi kho git công khai theo nguyên tắc bảo vệ bản quyền.
├── tests/                              # Bộ kiểm thử tuân thủ ngoại tuyến (Offline Conformance Harness)
│   └── conformance/                    # Bộ test độc lập không tải nhị phân (55/55 assertions PASS)
│       ├── fixtures/                   # Dữ liệu kiểm thử giả lập 7 nhóm TC1 -> TC7
│       ├── expected/                   # Kết quả kỳ vọng theo đúng chỉ lệnh CIL
│       ├── README.md                   # Hướng dẫn thực thi bộ kiểm thử
│       └── run_tests.js                # Runner tự động kiểm tra tính tuân thủ
└── scripts/                            # Kịch bản phân tích tự động bằng Node.js
    ├── parse_methods.js                # Bộ trích xuất và lọc cấu trúc method từ REA retained view
    └── compare_inventory.js            # Kịch bản đối soát đối chiếu 360 tệp đĩa vs inventory JSON
```

---

## 3. Tóm tắt 10 Tính năng Nghiệp vụ Cốt lõi của GGTT

1. **Bóc tách Livestream TikTok (`WebView2`)**: Sử dụng Chromium nhúng với script hook `window.__ggttEmbeddedCode` để trích xuất quà tặng, bình luận, viewer count.
2. **Live PK & Đấu Nhóm (`TeamChannelPkService`)**: Máy trạng thái quản lý round đấu, tính điểm, ghi nhận combo streak và ghi nhật ký SQLite.
3. **Phát Overlay qua WebSocket (`Fleck`)**: Mở socket `ws://127.0.0.1:3784` truyền dữ liệu thời gian thực cho widget OBS Browser Source.
4. **Máy chủ Media Cục bộ (Port 6211)**: Truyền phát video hiệu ứng MP4/WebM, âm thanh, và Live2D (`.moc3`, `.atlas`).
5. **Điều khiển Game Minecraft (`CoreRCON`)**: Hỗ trợ chuyển tiếp lệnh RCON vào server game Minecraft (tham số lệnh do UI người dùng cấu hình động).
6. **AI Pose Tracking & Hình phạt (`PunishmentTrackingService`)**: Sử dụng ONNX MediaPipe Pose để đếm số lần squat khi thua cuộc và điều khiển camera OBS bám theo người.
7. **Kịch bản Kỹ xảo Đa lớp (`ScenarioEngine`)**: Động cơ kịch bản có điều kiện (thời gian, va chạm, xác suất) kèm tách nền xanh (Chroma Key).
8. **Phím Nóng & Giả lập Phần cứng (`SendInput` / `RegisterHotKey`)**: Phím tắt vật lý (`A`, `D`, `S`, `U`, `I`, `O`, `+`, `-`) điều khiển trận đấu và mô phỏng chuột/phím.
9. **Kế toán Quà tặng & Báo cáo CSV**: Quản lý cơ sở dữ liệu `team.db`, tự động sao lưu an toàn (`before-restore-*`), xuất file đối soát `GGTT-Team-bao-cao.csv`.
10. **Xác thực Toàn vẹn Tiến trình (`EffectProcessTrust`)**: Chống can thiệp bằng manifest có chữ ký số `effects-trust.json` và kiểm tra PID kết nối Named Pipe.

---

## 4. Trạng thái Hoàn thành Toàn bộ Nhiệm vụ

- [x] **Phase 1: Environment Discovery**: Hoàn thành [01-environment.md](reports/01-environment.md).
- [x] **Phase 2: Static Binary Analysis**: Hoàn thành [02-binary-inventory.md](reports/02-binary-inventory.md) & [03-technology-stack.md](reports/03-technology-stack.md).
- [x] **Phase 3: Deep Function Analysis**: Hoàn thành [04-architecture.md](reports/04-architecture.md) & [05-function-map.md](reports/05-function-map.md).
- [x] **Phase 4: Feature Reconstruction Analysis**: Hoàn thành [06-feature-analysis.md](reports/06-feature-analysis.md).
- [x] **Phase 5: Technical Documentation & Roadmap**: Hoàn thành [07-reconstruction-roadmap.md](reports/07-reconstruction-roadmap.md).
- [x] **Phase 6: Deep Reverse Engineering & Evidence Verification**:
  - [x] Kiểm toán Evidence & giải quyết 5 mâu thuẫn: [08-evidence-audit.md](reports/08-evidence-audit.md).
  - [x] Phân tích mã CIL toàn vẹn (32 tệp disassembly ban đầu trong `evidence/cil/`).
  - [x] Truy vết Pipeline A (Bóc tách TikTok Live): [09-tiktok-event-pipeline.md](reports/09-tiktok-event-pipeline.md).
  - [x] Truy vết Pipeline B (Live PK & Kế toán quà tặng): [10-team-pk-scoring.md](reports/10-team-pk-scoring.md).
  - [x] Truy vết Pipeline C (WebSocket Overlay & Media Server): [11-overlay-protocol.md](reports/11-overlay-protocol.md).
  - [x] Phân tích Ranh giới Ngoại vi & Rủi ro: [12-remaining-unknowns.md](reports/12-remaining-unknowns.md).
- [x] **Phase 7: Evidence Hardening & Behavioral Contract Validation**:
  - [x] Giải quyết mâu thuẫn nhị phân 282 vs 360 tệp & mở rộng 36 tệp CIL: [13-phase7-consistency-audit.md](reports/13-phase7-consistency-audit.md).
  - [x] Xác minh 7 tuyên bố kỹ thuật cốt lõi kèm ma trận [claim-matrix.json](evidence/phase7/claim-matrix.json).
  - [x] Đặc tả hợp đồng hành vi chính thức: [14-verified-behavior-contracts.md](reports/14-verified-behavior-contracts.md).
  - [x] Phân tích 12 trường hợp biên kế toán combo: [15-combo-accounting-edge-cases.md](reports/15-combo-accounting-edge-cases.md).
  - [x] Chuẩn hóa lược đồ giao thức WebSocket & HTTP: [16-protocol-schema-verification.md](reports/16-protocol-schema-verification.md).
  - [x] Bản đặc tả kiến trúc phòng sạch hoàn chỉnh: [17-clean-room-specification.md](reports/17-clean-room-specification.md).
  - [x] Báo cáo chuyển giao tổng thể toàn dự án: [18-phase7-handoff.md](reports/18-phase7-handoff.md).
  - [x] Xây dựng bộ kiểm thử ngoại tuyến độc lập [tests/conformance/](tests/conformance/) (55/55 assertions PASS).

Mọi kết luận kỹ thuật đều đạt trạng thái kiểm toán chuẩn hóa (CONFIRMED / INFERRED / SPECULATIVE) dựa trên dữ liệu giải mã nhị phân có thể kiểm chứng độc lập. Clean-Room Ready 100%.
