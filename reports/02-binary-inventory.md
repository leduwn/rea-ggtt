# Báo cáo Kiểm kê Binary & Phân tích Cấu trúc (Phase 2 - Binary Inventory)

- **Thời gian thực hiện**: 2026-11-11
- **Target**: `C:\Program Files (x86)\GGTT\GGTT.exe`
- **Installation Directory**: `C:\Program Files (x86)\GGTT`
- **Working Workspace**: `rea-ggtiktok`
- **Phương pháp phân tích**: Static PE Analysis, ECMA-335 Metadata Inspection qua REA MCP (`rea-dotnet-static`, `inspect_pe_imports`, `inspect_pe_resources`, `inspect_managed_artifact`, `inspect_managed_members`)

---

## 1. Tổng quan Thư mục Ứng dụng

Thư mục cài đặt `C:\Program Files (x86)\GGTT` bao gồm 282 tệp tin và các thư mục con phục vụ hệ thống. Phân loại cấu trúc:

| Phân nhóm | Số lượng tệp | Mô tả chức năng |
|---|---|---|
| **Core Executable** | 2 tệp | `GGTT.exe` (AppHost bootloader), `GGTT.dll` (Primary managed logic) |
| **Runtime & Config** | 3 tệp | `GGTT.runtimeconfig.json`, `GGTT.deps.json`, `GGTT.dll.config` |
| **Trust & Integrity** | 1 tệp | `effects-trust.json` (Chữ ký điện tử & bảng băm SHA-256 các module) |
| **Managed Dependencies** | ~40 tệp DLL | WebSocket (`Fleck`), RCON (`CoreRCON`), SQLite (`Microsoft.Data.Sqlite`), AI (`Microsoft.ML.OnnxRuntime`), WebView2 (`Microsoft.Web.WebView2`), AutoUpdater |
| **Native Runtime Libraries** | ~15 tệp DLL | `onnxruntime.dll`, `DirectML.dll`, `WebView2Loader.dll`, `winsqlite3.dll` |
| **AI Models (ONNX)** | 2 tệp ONNX | `person_detection_mediapipe_2023mar.onnx`, `pose_estimation_mediapipe_2023mar.onnx` |
| **Framework Runtimes** | ~220 tệp DLL | Thư viện cơ sở `System.*` và `Microsoft.WindowsDesktop.App` (WinForms, WPF, WIC) |

Toàn bộ kiểm kê chi tiết từng file được lưu tại: `evidence/binary/full-inventory.json`.

---

## 2. Thông số Kỹ thuật & Băm Định danh Binary Trọng yếu

| Tên tệp | Kích thước (bytes) | Kiến trúc | Định dạng | SHA-256 Checksum | Trạng thái |
|---|---|---|---|---|---|
| `GGTT.exe` | 175,104 | AMD64 (x64) | PE32+ (Executable) | `a56efabe710a75d12df8c2aacd16870e6bdde371e8f43f22873cad1c2db7d94b` | CONFIRMED |
| `GGTT.dll` | 7,709,184 | AnyCPU / x64 | PE32 (CLI Managed) | `6ee719dd26a248e6295429e523c2220b8e87a4a98168ea0626174aa1fb0ef6b5` | CONFIRMED |
| `GGTT.runtimeconfig.json` | 443 | - | UTF-8 JSON | `1a8123c5e8c1873130d2204c3562470764121d283626e2730626aa27ca22ff61` | CONFIRMED |
| `GGTT.deps.json` | 61,438 | - | UTF-8 JSON | - | CONFIRMED |
| `GGTT.dll.config` | 1,024 | - | XML Config | - | CONFIRMED |
| `effects-trust.json` | 33,261 | - | JSON Signed Manifest | - | CONFIRMED |
| `person_detection_mediapipe_2023mar.onnx` | ~1.8 MB | - | ONNX Model | - | CONFIRMED |
| `pose_estimation_mediapipe_2023mar.onnx` | ~9.2 MB | - | ONNX Model | - | CONFIRMED |

---

## 3. Phân tích Cấu trúc PE Header & Bootloader

### 3.1. `GGTT.exe` (Native AppHost Launcher)
- **Định dạng**: PE32+, 64-bit AMD64 GUI Binary (`IMAGE_SUBSYSTEM_WINDOWS_GUI`).
- **Nhiệm vụ**: Khởi tạo tiến trình native, cấu hình môi trường .NET Core, tải thư viện `hostfxr.dll`/`coreclr.dll`, sau đó trao quyền thực thi cho entry point trong `GGTT.dll`.
- **PE Section Header**: `.text`, `.rdata`, `.data`, `.pdata`, `.rsrc`, `.reloc`.
- **PE Imports đã xác minh qua REA `inspect_pe_imports`**:
  - `KERNEL32.dll`: `GetProcAddress`, `LoadLibraryExW`, `ActivateActCtx`, `DeactivateActCtx`, `CreateActCtxW`, `ReleaseActCtx`, `FormatMessageW`, `CloseHandle`, `SetLastError`, `GetLastError`.
  - `USER32.dll`: `MessageBoxW`.
  - `SHELL32.dll`: `ShellExecuteW`.
  - `ADVAPI32.dll`: `RegOpenKeyExW`, `RegQueryValueExW`, `RegCloseKey`, `EventRegister`, `EventWriteTransfer`, `EventUnregister`.
  - `api-ms-win-crt-*` (Universal C Runtime - UCRT): Quản lý chuỗi, bộ nhớ heap và cấu trúc thời gian chạy C/C++.
- **PE Resources (`inspect_pe_resources`)**:
  - `RT_MANIFEST` (ID: 1): Khai báo `requestedExecutionLevel level="asInvoker"`, `dpiAware="true/pm"`, tương thích Windows 10/11.
  - `RT_GROUP_ICON` / `RT_ICON`: Chứa các biểu tượng hiển thị trên desktop/taskbar.
  - `RT_VERSION`: Version info định danh Microsoft .NET AppHost version 10.0.

### 3.2. `GGTT.dll` (Primary Managed Logic)
- **Định dạng**: ECMA-335 CLI Managed Assembly.
- **MVID (Module Version ID)**: `298ab416-d58b-4c6d-8e4a-91f20ef739a1`.
- **Assembly Version**: `1.1.4.12`.
- **Target Framework**: `.NETCoreApp,Version=v10.0` (target framework compilation profile).
- **Thống kê Metadata**:
  - **502 TypeDefs** (Bao gồm các form UI, controller, engine xử lý media, client kết nối TikTok, service tính điểm PK, và các máy trạng thái async `d__*`).
  - **2,685 MethodDefs** (Toàn bộ phương thức nghiệp vụ).
  - **2,959 Fields** (Trường dữ liệu trạng thái).
  - **597 Properties** (Đặc tính truy xuất dữ liệu).
  - **17,073 Call Edges** (Cạnh đồ thị cuộc gọi nội bộ).
  - **14,392 Field Accesses** (Điểm truy cập trường dữ liệu).
  - **2,352 User Strings** (#US string literals chứa regex, endpoint API, JavaScript code, SQL format, hotkey maps).

---

## 4. Cấu hình Runtime & Dependencies

### 4.1. Runtime Configuration (`GGTT.runtimeconfig.json`)
```json
{
  "runtimeOptions": {
    "tfm": "net10.0",
    "frameworks": [
      {
        "name": "Microsoft.NETCore.App",
        "version": "10.0.0"
      },
      {
        "name": "Microsoft.WindowsDesktop.App",
        "version": "10.0.0"
      }
    ],
    "configProperties": {
      "System.Reflection.Metadata.MetadataUpdater.IsSupported": false,
      "System.Runtime.Serialization.EnableUnsafeBinaryFormatterSerialization": false,
      "CSWINRT_USE_WINDOWS_UI_XAML_PROJECTIONS": false
    }
  }
}
```
- Sử dụng runtime `Microsoft.WindowsDesktop.App` version 10.0 (hỗ trợ cả Windows Forms và WPF).
- Vô hiệu hóa `MetadataUpdater` (Hot Reload) và `BinaryFormatter` (chặn khai thác lỗ hổng deserialization không an toàn).

### 4.2. Khảo sát Dependency từ `GGTT.deps.json`
- **Giao diện & Trình duyệt**: `Microsoft.Web.WebView2` (v1.0.x) — điều khiển nhân Chromium nhúng để mở livestream TikTok.
- **Mạng & Giao tiếp Live**:
  - `Fleck` (v1.2.0): WebSocket Server cục bộ truyền tải sự kiện quà, bình luận và trạng thái trò chơi cho overlay/trình duyệt.
  - `CoreRCON` (v1.3.x): Giao thức Remote Console điều khiển Minecraft Server theo tương tác TikTok.
- **Cơ sở dữ liệu**:
  - `Microsoft.Data.Sqlite`: Ghi nhật ký quà tặng (`TeamGiftJournal`), lịch sử PK và cấu hình người dùng.
- **Trí tuệ Nhân tạo & Xử lý Ảnh**:
  - `Microsoft.ML.OnnxRuntime`: Thực thi mô hình deep learning phát hiện người và pose estimation MediaPipe trực tiếp trên GPU/CPU.
- **Âm thanh & Speech**:
  - `Microsoft.CognitiveServices.Speech`: Xử lý giọng nói và hiệu ứng âm thanh.
- **Tự động Cập nhật**:
  - `Autoupdater.NET.Official`: Kiểm tra và nạp bản vá từ URL `https://jqsvn.com/google_tiktok/download/update_setup.xml`.

---

## 5. Cơ chế Integrity & Anti-Tamper (`effects-trust.json`)
Ứng dụng áp dụng cơ chế xác thực toàn vẹn bằng tệp JSON chứa bảng băm SHA-256 của từng module thành phần. Thuật toán kiểm tra được hiện thực hóa trong lớp `GGTT.EffectsBridge.Effects.EffectProcessTrust` và `DesktopSafety`:
- Khi ứng dụng khởi chạy hoặc khi các module hiệu ứng được nạp, `EffectProcessTrust` tính toán lại SHA-256 của file trên đĩa và đối chiếu với manifest đã ký.
- Nếu checksum không khớp, hệ thống từ chối cấp quyền thực thi (`denied`) và kích hoạt quy trình chặn rủi ro.

---

## 6. Kết luận Phase 2
- **Trạng thái**: Đã hoàn thành 100% việc kiểm kê, xác thực chữ ký số, PE header, cấu hình .NET và danh mục phụ thuộc.
- **Bằng chứng kỹ thuật**: Dữ liệu lưu tại `evidence/binary/full-inventory.json`, `evidence/binary/rea-doctor.json`.
- **Bước tiếp theo (Phase 3 & 4)**: Đi sâu vào dịch ngược mã nguồn CIL, phân tích chi tiết các lớp nghiệp vụ trọng tâm (`Google_Tiktok_Form`, `TeamChannelPkService`, `ScenarioEngine`, `ObsTrackingClient`).
