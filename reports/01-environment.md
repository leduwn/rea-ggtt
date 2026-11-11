# Báo cáo Môi trường Phân tích (Phase 1 - Environment Discovery)

- **Thời gian thực hiện**: 2026-11-11
- **Target**: `C:\Program Files (x86)\GGTT\GGTT.exe`
- **Installation Directory**: `C:\Program Files (x86)\GGTT`
- **Workspace**: `rea-ggtiktok`

---

## 1. Trạng thái REA

### 1.1. Phiên bản & Thực thi
- **REA CLI Package Version**: `6.8.0` (SDK core/server: `2.3.1`)
- **Node.js**: `24.22.1`
- **Host OS**: Windows 11 Home Single Language x64 (`10.0.26200`, `win32 x64`)
- **CLI Entry Point**: `node_modules/rea-agents/scripts/rea.mjs (npx rea-agents@6.8.0)`
- **MCP Server**: Đang kết nối trực tiếp trong phiên agent thông qua bridge (`rea-agents@6.8.0`). 229 MCP tools có sẵn.

### 1.2. Trạng thái Providers
| Provider | Trạng thái | Ghi chú |
|---|---|---|
| `rea-dotnet-static` (v1) | **AVAILABLE** | Hỗ trợ phân tích CIL, metadata PE/CLI, CIL hashes, user strings, call edges, native boundaries |
| `rea-artifact-graph` (v1) | **AVAILABLE** | Hỗ trợ inventory, bundle extraction, container artifacts |
| PE Inspection Tools | **AVAILABLE** | `inspect_pe_imports`, `inspect_pe_resources`, `inspect_pe_certificates`, `inspect_pe_load_config` |
| SQLite Inspection | **AVAILABLE** | `inspect_sqlite_database` |
| `ghidra` | **UNAVAILABLE** | `GHIDRA_INSTALL_DIR is not set` (Chưa cấu hình biến môi trường) |
| `hopper` | **UNAVAILABLE** | `unsupported_host` (Chỉ hỗ trợ macOS) |
| `ida` | **UNAVAILABLE** | Chưa cấu hình `REA_IDA_MCP_CONFIG` |
| `kuna` | **UNAVAILABLE** | Chưa cấu hình `REA_KUNA_COMMAND` |

### 1.3. Nhận định chiến lược công cụ
- **GGTT là ứng dụng .NET Core / .NET 8 hiện đại** (phát hiện `GGTT.dll` 7.7MB kèm `GGTT.deps.json`, `GGTT.runtimeconfig.json`).
- `GGTT.exe` (175 KB) chỉ đóng vai trò là Native AppHost Bootloader của Microsoft .NET để tải CLR và nạp `GGTT.dll`.
- Do đó, việc thiếu Ghidra/IDA native disassembler **không cản trở** việc dịch ngược sâu, vì toàn bộ mã nguồn nghiệp vụ nằm trong managed assembly `GGTT.dll`.
- Công cụ chủ lực của REA cho ứng dụng này: `inspect_managed_artifact`, `inspect_managed_members`, `inspect_managed_native_boundaries`, `inspect_pe_imports`, `inspect_pe_resources`.

---

## 2. Bằng chứng lưu trữ (Evidence)
- `evidence/binary/rea-doctor.json`: Kết quả chi tiết `rea doctor --json`.
- `evidence/binary/rea-providers.json`: Danh mục providers và capabilities chi tiết của REA 6.8.0.
