# Báo cáo Dịch ngược Tích hợp Game, Phím nóng & Tự động hóa Phần cứng (Phase 8 - Game Integrations, Hotkeys & Automation)

- **Mã báo cáo**: `23-game-hotkeys-and-automation.md`
- **Phân hệ phân tích**: `GGTT.KeyboardCommands`, `KeyboardHook`, `Keyboard`, `CoreRCON` Minecraft Bridge, `Window` (21 phương thức)
- **Công nghệ nền tảng**: Win32 P/Invoke (`user32.dll!SendInput`, `RegisterHotKey`), `System.Windows.Forms.NativeWindow`, `CoreRCON`
- **Mục đích chức năng**: Tương tác trực tiếp với game (Minecraft RCON, DirectX scancodes), điều khiển hiệu ứng bằng phím tắt toàn cục và tự động hóa thao tác phím/chuột từ luồng live
- **Ngày hoàn tất**: 2026-11-11

---

## 1. Tổng quan Kiến trúc Phân hệ

Phân hệ Game & Automation của GGTT kết nối các sự kiện TikTok (quà tặng, bình luận, tương tác streamer) với môi trường máy tính người dùng thông qua 3 kênh chính:

```
+---------------------------------------------------------------------------------------------------+
|                                  GAME & AUTOMATION SUBSYSTEM                                      |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|   1. MINECRAFT RCON BRIDGE                                                                        |
|   +-----------------------+      TCP RCON       +-----------------------+                         |
|   | Google_Tiktok_Form    | ------------------> | Minecraft Server      |                         |
|   | connect_minecraft /   | (Port 25575 / auth) | (/summon, /give, ...) |                         |
|   | SendCommandMinecraft  | <------------------ |                       |                         |
|   +-----------------------+      Response       +-----------------------+                         |
|                                                                                                   |
|   2. GLOBAL HOTKEY DISPATCHER                                                                     |
|   +-----------------------+     WM_HOTKEY (0x312)   +-----------------------+   SafeExecuteScript |
|   | Win32 user32.dll      | ----------------------> | Window (NativeWindow) | ----------------->  |
|   | RegisterHotKey        |                         | -> KeyboardHook       | (set_pause_effect,  |
|   +-----------------------+                         | -> Form.HotKeyXuLy    |  win_count_update)  |
|                                                     +-----------------------+                     |
|                                                                                                   |
|   3. LOW-LEVEL HARDWARE SIMULATION                                                                |
|   +-----------------------+      Bindings map   +-----------------------+   user32.dll!SendInput  |
|   | TikTok Events /       | ------------------> | KeyboardCommands.Send | --------------------->  |
|   | key_board_desktop_... |                     | Keyboard.SendKey /    | (DirectX Scancodes,     |
|   +-----------------------+                     | Keyboard.SendMouse    |  Mouse Buttons/Wheel)   |
|                                                 +-----------------------+                         |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Cầu nối Minecraft RCON (Minecraft RCON Bridge)

GGTT tích hợp trực tiếp thư viện `CoreRCON` để điều khiển máy chủ Minecraft từ xa theo thời gian thực dựa trên các quà tặng hoặc lệnh từ TikTok live.

### 2.1. Khởi tạo & Kết nối (`connect_minecraft_server`)
Phương thức `GGTT.Google_Tiktok_Form.connect_minecraft_server` (`0x060002cd`) điều phối bởi async state machine `<connect_minecraft_server>d__113::MoveNext` (`0x06000805`):
- **Tham số kết nối**: Địa chỉ IP máy chủ (`IPAddress ip`), mật khẩu quản trị (`string pwd`) và thời gian chờ mặc định `10,000ms` (10 giây).
- **Khởi tạo đối tượng**:
  ```cil
  IL_0036: ldfld       <connect_minecraft_server>d__113::ip
  IL_003c: ldfld       <connect_minecraft_server>d__113::pwd
  IL_0041: ldc.i4      10000                   // Timeout 10,000 ms
  IL_0046: ldc.i4.0
  IL_0047: ldc.i4.1
  IL_0048: ldc.i4.1
  IL_0049: ldnull
  IL_004a: newobj      CoreRCON.RCON::.ctor(IPAddress, ushort, string, int, ...)
  IL_004f: stfld       Google_Tiktok_Form::rconClient
  IL_005a: callvirt    CoreRCON.RCON::ConnectAsync()
  ```
- **Xử lý phản hồi**: Kết quả kết nối hoặc ngoại lệ được chuyển tiếp về WebView2 thông qua `ExecuteScriptAsync` để cập nhật trạng thái UI tương ứng.

### 2.2. Gửi Lệnh Console (`SendCommandMinecraft`)
Được xử lý tại `<SendCommandMinecraft>d__114::MoveNext` (`0x060007e1`):
- Tiếp nhận lệnh chuỗi (ví dụ: `summon lightning_bolt`, `give @p diamond`, `kill @e[type=zombie]`).
- Gọi phương thức bất đồng bộ `CoreRCON.RCON.SendCommandAsync(command)`.
- Ghi nhận phản hồi từ Minecraft server và cập nhật DOM WebView2 hoặc ghi nhật ký ứng dụng.

---

## 3. Hệ thống Phím Nóng Toàn cục (Global Hotkey Subsystem)

GGTT sử dụng cơ chế Windows Forms `NativeWindow` để bắt các tổ hợp phím toàn cục (Global Hotkeys) ngay cả khi ứng dụng đang chạy nền hoặc bị che bởi màn hình game.

### 3.1. Cấu trúc Lớp `Window` & `KeyboardHook`
- `Window` (`0x020001ed`): Kế thừa từ `System.Windows.Forms.NativeWindow`, tạo một cửa sổ ẩn với handle riêng (`CreateHandle`) để tiếp nhận thông điệp hệ thống.
- `KeyboardHook` (`0x020000de`): Quản lý vòng đời đăng ký và hủy đăng ký với hệ điều hành thông qua Win32 P/Invoke:
  - `user32.dll!RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk)` (`0x06000724`)
  - `user32.dll!UnregisterHotKey(IntPtr hWnd, int id)` (`0x06000725`)

### 3.2. Bóc tách Thông điệp `WM_HOTKEY` (`0x0312`)
Phương thức `Window.WndProc` (`0x06000a67`) chặn và bóc tách thông điệp `0x0312`:
```cil
IL_0007: ldarg.1
IL_0008: call        Message::get_Msg()
IL_0013: ldsfld      Window::WM_HOTKEY        // 0x0312 (786)
IL_0018: bne.un.s    IL_004e                  // Nhảy nếu không phải WM_HOTKEY
IL_0020: ldarg.1
IL_0021: call        Message::get_LParam()
IL_0026: conv.i4
IL_0027: ldc.i4.s    16
IL_0029: shr                                  // Dịch phải 16 bit lấy High Word (Virtual Key)
IL_0030: ldc.i4      65535                    // Mặt nạ 0xFFFF
IL_0035: and
IL_0036: stloc.0                              // key
IL_0037: ldarg.1
IL_0038: call        Message::get_LParam()
IL_003d: conv.i4
IL_003e: ldc.i4      65535                    // Low Word (fsModifiers)
IL_0043: and
IL_0044: stloc.1                              // modifier
IL_0045: ...
IL_004d: callvirt    KeyPressedEventHandler::Invoke(this, new KeyPressedEventArgs(modifier, key))
```

### 3.3. Danh mục Tổ hợp Phím Nóng Đã Xác minh
Các phím nóng được đăng ký tự động tại hàm tạo `Google_Tiktok_Form..ctor` (`0x0600029b`) và xử lý tại `HotKeyXuLy` (`0x060002b0`):

| Tổ hợp phím | Mã cờ Modifier | Mã Phím Virtual | Hành động thực thi (`SafeExecuteScriptAsync`) | Chức năng chi tiết |
|:---|:---:|:---:|:---|:---|
| **Ctrl + Alt + Shift + A** | `7` (`Alt\|Ctrl\|Shift`) | `0x41` (`Keys.A`) | `set_pause_effect(0)` | Tạm dừng / Tiếp tục hiệu ứng đội Đỏ (Team 0) |
| **Ctrl + Alt + Shift + D** | `7` (`Alt\|Ctrl\|Shift`) | `0x44` (`Keys.D`) | `set_pause_effect(1)` | Tạm dừng / Tiếp tục hiệu ứng đội Xanh (Team 1) |
| **Ctrl + Alt + Shift + S** | `7` (`Alt\|Ctrl\|Shift`) | `0x53` (`Keys.S`) | `pause_effect()` | Tạm dừng hoặc tiếp tục tất cả hiệu ứng trên màn hình |
| **Ctrl + Alt + [-] (OemMinus)**| `3` (`Alt\|Ctrl`) | `0xBD` (189) | `win_count_update(0)` | Tăng số ván thắng thủ công cho đội Đỏ (Team 0) |
| **Ctrl + Alt + [+] (Oemplus)** | `3` (`Alt\|Ctrl`) | `0xBB` (187) | `win_count_update(1)` | Tăng số ván thắng thủ công cho đội Xanh (Team 1) |
| **Ctrl + Alt + Shift + U** | `7` (`Alt\|Ctrl\|Shift`) | `0x55` (`Keys.U`) | `set_effect_speed(2)` | Đặt tốc độ hiệu ứng ở mức 2 (nhanh) |
| **Ctrl + Alt + Shift + I** | `7` (`Alt\|Ctrl\|Shift`) | `0x49` (`Keys.I`) | `set_effect_speed(0)` | Đặt tốc độ hiệu ứng ở mức 0 (bình thường) |
| **Ctrl + Alt + Shift + O** | `7` (`Alt\|Ctrl\|Shift`) | `0x4F` (`Keys.O`) | `set_effect_speed(1)` | Đặt tốc độ hiệu ứng ở mức 1 (trung bình) |

---

## 4. Tự động hóa Phần cứng & Mô phỏng Bàn phím/Chuột (Hardware Simulation)

Khi tương tác với game (đặc biệt là các game DirectInput như Minecraft, Roblox, GTA, PUBG), việc gửi ký tự ảo thông thường (`WM_CHAR`, `keybd_event`) thường bị bỏ qua bởi engine game. GGTT sử dụng cơ chế phát tín hiệu phần cứng trực tiếp ở mức phần cứng/kernel.

### 4.1. Bảng Tra cứu Scancode (`GGTT.KeyboardCommands`)
Lớp tĩnh `KeyboardCommands` (`0x0200004e`) sở hữu từ điển `Bindings` (`Dictionary<string, Binding>`):
- Khởi tạo tĩnh (`.cctor` `0x06000341`): Nạp toàn bộ các mã DirectX Scancode cho các phím:
  - Phím bổ trợ: `CTRL`, `LCTRL`, `RCTRL`, `ALT`, `LALT`, `RALT`, `SHIFT`, `LSHIFT`, `RSHIFT`.
  - Phím điều khiển: `ENTER`, `ESCAPE`, `SPACE`, `TAB`, `CAPSLOCK`, `BACKSPACE`.
  - Ký tự & Số: `0`..`9`, `A`..`Z`.
  - Mũi tên & Phím điều hướng: `ARROWUP`, `ARROWDOWN`, `ARROWLEFT`, `ARROWRIGHT`, `DELETE`, `INSERT`, `HOME`, `END`, `PAGEUP`, `PAGEDOWN`.
  - Chuột: `LEFTMOUSE`, `RIGHTMOUSE`, `MIDDLEMOUSE`, `MOUSEWHEELUP`, `MOUSEWHEELDOWN`.
- Record `Binding`:
  - `ScanCode`: Mã quét phần cứng (DirectX Scancode).
  - `IsMouse`: Cờ đánh dấu phím chuột hay bàn phím.
  - `PressOnly`: Cờ đánh dấu hành động đơn hay giữ nhả.

### 4.2. Luồng Điều phối Lệnh (`KeyboardCommands.Send`)
Phương thức `GGTT.KeyboardCommands.Send` (`0x06000340`) xử lý 2 loại tín hiệu:
- `"keyboard_bam"`: Nhấn phím xuống (Key Down / Mouse Down).
- `"keyboard_nha"`: Nhả phím lên (Key Up / Mouse Up).

```cil
IL_0004: ldstr       "keyboard_bam"
IL_0009: call        String::op_Inequality
IL_0011: ldstr       "keyboard_nha"
...
IL_001d: ldsfld      KeyboardCommands::Bindings
IL_0023: ldloca.s    binding
IL_0025: callvirt    Dictionary::TryGetValue(keyName, out binding)
...
IL_0048: call        Binding::get_IsMouse()
IL_004d: brfalse.s   IL_005d                  // Nếu là bàn phím -> gọi SendKey
IL_0057: call        Keyboard::SendMouse(binding.ScanCode, isDown)
...
IL_0069: call        Keyboard::SendKey(binding.ScanCode, isKeyUp, true)
```

### 4.3. Mô phỏng Chuột (`Keyboard.SendMouse`)
Phương thức `Keyboard.SendMouse` (`0x0600020d`) biên dịch mã chuột thành cấu trúc `MOUSEINPUT`:
- **Nút trái** (Mã `256`): `isDown ? 0x0002 (LEFTDOWN) : 0x0004 (LEFTUP)`
- **Nút phải** (Mã `257`): `isDown ? 0x0008 (RIGHTDOWN) : 0x0010 (RIGHTUP)`
- **Nút giữa** (Mã `258`): `isDown ? 0x0020 (MIDDLEDOWN) : 0x0040 (MIDDLEUP)`
- **Cuộn lên** (Mã `264`): `0x0800 (WHEEL)`, `mouseData = +120` (WHEEL_DELTA)
- **Cuộn xuống** (Mã `265`): `0x0800 (WHEEL)`, `mouseData = -120` (-WHEEL_DELTA)
- Gọi `user32.dll!SendInput` với `INPUT_MOUSE` (`type = 0`).

### 4.4. Mô phỏng Phím DirectX & Phím Mở Rộng (`Keyboard.SendKey`)
Phương thức `Keyboard.SendKey` (`0x0600020e`):
- Duy trì danh sách tập hợp các phím mở rộng (`HashSet<ushort>`):
  `{ 181, 156, 211, 210, 183, 199, 207, 200, 208, 203, 205, 201, 209, 221, 157, 184, 69 }`
- Nếu scancode thuộc danh sách trên, tự động bật cờ `KEYEVENTF_EXTENDEDKEY` (`0x0001`).
- Đặt cờ quét phần cứng bắt buộc: `KEYEVENTF_SCANCODE` (`0x0008`).
- Nếu nhả phím: kết hợp cờ `KEYEVENTF_KEYUP` (`0x0002`).
- Thiết lập `dwExtraInfo = GetMessageExtraInfo()`.
- Phát lệnh thông qua `user32.dll!SendInput` (`INPUT_KEYBOARD`, `type = 1`).

---

## 5. Kết luận & Hướng dẫn Tái hiện Phòng sạch (Clean-Room Specifications)

1. **Độc lập Nền tảng**:
   - Win32 `SendInput` và `RegisterHotKey` phụ thuộc hoàn toàn vào hệ điều hành Windows.
   - Để hỗ trợ đa nền tảng (macOS / Linux) trong thiết kế phòng sạch, nên trừu tượng hóa qua giao diện `IInputSimulator` và `IGlobalHotkeyManager` (sử dụng thư viện như `SharpHook` hoặc `libuiohook`).
2. **Bảo mật Tự động hóa**:
   - Cơ chế tự động nhấn phím từ quà tặng TikTok cần có bộ lọc giới hạn tần suất (rate limiter) và danh sách phím được phép (allowlist) để tránh việc người xem gửi quà độc hại kích hoạt phím nguy hiểm như `Alt+F4`, `Windows+L`, hoặc mở Terminal ngoài ý muốn.
3. **Minecraft RCON Connection Pooling**:
   - `CoreRCON` kết nối TCP cần có cơ chế tự kết nối lại (auto-reconnect with exponential backoff) khi máy chủ Minecraft bị giật lag hoặc khởi động lại.
