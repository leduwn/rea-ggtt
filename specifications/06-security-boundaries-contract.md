# Clean-Room Specification 06: Security Boundaries, Script Validation & Win32 IPC

- **Spec ID**: `SPEC-06`
- **Subsystem**: `CROSS_CUTTING_SECURITY` & `GAME_HOTKEYS_AUTOMATION`
- **Authoritative Proof**: `CLM-07`, `CLM-10`, `CLM-12`, Contradiction A2/A3 (`0x0600020d`, `0x06000295`, `0x06000381`..`0x06000386`)

## 1. Embedded JavaScript Validation Pipeline (`EmbeddedScriptLoader`)
When fetching injection scripts dynamically, the loader must enforce structural integrity:
1. **Size Limit**: Payload bytes must not exceed $1\,\text{MB}$ ($1,048,576$ bytes).
2. **BOM Trim**: Strip UTF-8 Byte Order Mark (`0xFEFF` / `65279`) and whitespace.
3. **MIME Verification**: `Content-Type` header must match (case-insensitive):
   `application/javascript`, `text/javascript`, or `application/x-javascript`.
4. **Binary Neutrality**: Rejects any payload containing null bytes (`0x00`).
5. **Server Denial Detection**:
   Inspect string content: if it equals `"error"`, `"no-data"`, or matches regex `\A[a-fA-F0-9]{32}\z`, throw an authorization exception:
   `"Máy chủ từ chối cấp mã GG. Hãy kiểm tra tài khoản, quyền sử dụng và kết nối lại GGTT."`
6. **Structural JavaScript Tokens**:
   - Modern format requires arrow IIFE `\A\(\s*\(\s*\)\s*=>\s*\{`, `"const TikeqID ="`, `"const idus ="`, `"function communicate_launcher("`.
   - Legacy format requires `"var TikLangJz ="`, `"var TikHixId ="`, `"function communicate_launcher("`.
7. **In-Memory Fingerprinting**:
   Compute `SHA256.HashData(rawBytes)` formatted as lowercase hexadecimal. Store in immutable `EmbeddedScript(Code, Hash)` record for runtime tracking. **Do NOT compare against static whitelists.**

## 2. Win32 Hotkey Message Decoding (`WndProc`)
When processing `WM_HOTKEY` (`0x0312`):
- **Modifier Keys**: Decoded from `LOWORD` (`(int)m.LParam & 0xFFFF`):
  * `MOD_ALT` (`0x0001`)
  * `MOD_CONTROL` (`0x0002`)
  * `MOD_SHIFT` (`0x0004`)
  * `MOD_WIN` (`0x0008`)
- **Virtual Key Code**: Decoded from `HIWORD` (`((int)m.LParam >> 16) & 0xFFFF`).
- **Hardware Scancode Translation**: Map virtual key to DirectX scan code for simulated hardware input.

## 3. Named Pipe Security & Plugin Authorization (`EffectProcessTrust`)
- Inter-process communication with OBS Studio helper plugins must verify peer process identity via Named Pipe client token impersonation and process ID tree validation.
- Clean-room implementations must generate their own cryptographic RSA public/private key pairs for manifest integrity and must **NEVER copy or reuse the proprietary public key string token `0x700061e8`**.
