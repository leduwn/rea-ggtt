# Clean-Room Specification 03: Network Protocol, Port Topology & Media Streaming

- **Spec ID**: `SPEC-03`
- **Subsystem**: `WEBSOCKET_OVERLAY_MEDIA_SERVER`
- **Authoritative Proof**: `CLM-05`, `CLM-06`, Contradiction A1 (`0x0600029b`, `0x060002a9`, `0x060002aa`, `0x060002ab`, `0x06000311`, `0x060007f3`, `0x060007f7`)

## 1. Local Port Topology
| Service | Default Port | Address / Prefix | Collision Policy |
|---|:---:|---|---|
| **Overlay WebSocket Server** | `3784` | `ws://127.0.0.1:3784/` | Configurable via `websocketport` |
| **Overlay Media HTTP Server** | `3785` (`websocketport + 1`) | `http://*:{port}/media/` | Retries up to 3 times with `300ms` delay, `port++` (`3785 -> 3786 -> 3787 -> 3788`) |
| **Local AI Model File Server** | `6211` | `http://localhost:6211/` | Fixed local server serving `ai_model` directory |

*Note: Port range `5000-5050` does not exist and must NOT be implemented.*

## 2. WebSocket Overlay Protocol & 250ms Debounce
1. **Connection Handshake (`OnOpen`)**:
   Upon client connection, the server emits an identity announcement packet:
   ```json
   {
     "type": "SET_MACHINE_ID",
     "machineId": "<local_machine_id>"
   }
   ```
   *(Informational identity payload only; not a cryptographic authentication token.)*
2. **State Throttling (`SendTeamState`)**:
   - Compute `elapsedMs = (DateTime.UtcNow - teamLastStateSent).TotalMilliseconds`.
   - If `elapsedMs < 250.0`:
     * If `teamStatePending == false`, set `teamStatePending = true` and schedule asynchronous delayed emission for remaining duration, then return immediately.
     * If `teamStatePending == true`, drop redundant trigger.
   - If `elapsedMs >= 250.0`:
     * Update `teamLastStateSent = DateTime.UtcNow`, reset `teamStatePending = false`, serialize current `TeamSnapshot`, and transmit JSON packet with type `"team_state"`.

## 3. Media HTTP Server MIME Resolution Table
The media server must map exactly 14 file extensions (case-insensitive) and default all unknown extensions to `application/octet-stream`:

| Extension | Content-Type | Extension | Content-Type |
|---|---|---|---
| `.html` | `text/html; charset=utf-8` | `.mp3` | `audio/mpeg` |
| `.js` | `application/javascript; charset=utf-8` | `.wav` | `audio/wav` |
| `.css` | `text/css; charset=utf-8` | `.mp4` | `video/mp4` |
| `.png` | `image/png` | `.webm` | `video/webm` |
| `.jpg` | `image/jpeg` | `.json` | `application/json` |
| `.webp` | `image/webp` | `.woff2` | `font/woff2` |
| `.svg` | `image/svg+xml` | `.wasm` | `application/wasm` |
| *(default)* | `application/octet-stream` | | |
