# Clean-Room Specification 05: AI Pose Tracking & OBS WebSocket Contract

- **Spec ID**: `SPEC-05`
- **Subsystem**: `AI_POSE_TRACKING_OBS`
- **Authoritative Proof**: `CLM-09` (`0x06000455`, `0x06000457`, `0x0600045b`, `0x0600045c`, `0x060008d4`, `0x060008e8`)

## 1. BlazePose ONNX Post-Processing Math
1. **Clamped Sigmoid Activation**:
   $$\text{Sigmoid}(x) = \frac{1}{1.0 + e^{-\text{clamp}(x, -80.0, 80.0)}}$$
   Clamping to $[-80.0, 80.0]$ is required to prevent numeric underflow/overflow.
2. **3-Layer Anchor Box Topology**:
   The anchor generator creates exactly 2,254 anchor boxes across 3 scale layers:
   - **Layer 1**: $28 \times 28$ grid, 2 anchors per cell $\to 1,568$ anchors.
   - **Layer 2**: $14 \times 14$ grid, 2 anchors per cell $\to 392$ anchors.
   - **Layer 3**: $7 \times 7$ grid, 6 anchors per cell $\to 294$ anchors.
   $$\text{Total} = 1568 + 392 + 294 = 2254 \text{ anchors}$$

## 2. Squat Exercise State Machine
Calculates knee angle $\theta$ between hip, knee, and ankle landmarks. Transitions through 3 discrete states with hysteresis:

```
[STANDING]  (θ > 160°)
    │
    ▼ (θ < 140°)
[DESCENDING]
    │
    ▼ (θ ≤ 100°)
[SQUATTING]
    │
    ▼ (θ > 160°)
[STANDING]  --> reps++
```

- **Thresholds**:
  * `STANDING`: $\theta > 160.0^\circ$
  * `DESCENDING`: $\theta < 140.0^\circ$
  * `SQUATTING`: $\theta \le 100.0^\circ$
- **Repetition Increment**: Increment counter `reps++` only when returning to `STANDING` ($> 160.0^\circ$) from a confirmed `SQUATTING` state.

## 3. OBS Studio v5 WebSocket Authentication Handshake
Clients must support OBS WebSocket protocol version 5 (OBS 28+):
1. Connect to `ws://127.0.0.1:{obs_port}/`.
2. Receive `Hello` (OpCode 0) containing `authentication` payload with `challenge` and `salt`.
3. Compute cryptographic response:
   - `secret_hash = Base64(SHA256(password + salt))`
   - `auth_response = Base64(SHA256(secret_hash + challenge))`
4. Transmit `Identify` (OpCode 1):
   ```json
   {
     "op": 1,
     "d": {
       "rpcVersion": 1,
       "authentication": "<auth_response>",
       "eventSubscriptions": 33
     }
   }
   ```
5. Receive `Identified` (OpCode 2) confirming authenticated session.
