# Báo cáo Dịch ngược AI Pose Tracking & Tích hợp OBS Studio (Phase 8 - AI Pose & OBS Tracking)

- **Mã báo cáo**: `22-ai-pose-and-obs-tracking.md`
- **Mã đặc tả luồng máy đọc**: `evidence/phase8/tracking-flow.json`
- **Phân hệ phân tích**: `GGTT.Tracking` (130 phương thức, 9 kiểu dữ liệu)
- **Mô hình AI ONNX**: `person_detection_mediapipe_2023mar.onnx` & `pose_estimation_mediapipe_2023mar.onnx`
- **Giao thức điều khiển OBS**: OBS WebSocket v5 JSON-RPC RFC (Cổng mặc định 4455)
- **Ngày hoàn tất**: 2026-11-11

---

## 1. Kiến trúc AI Tracking & Suy luận ONNX (Tracking Architecture)

Phân hệ `GGTT.Tracking` đảm nhiệm việc thu thập khung hình từ webcam/OBS Virtual Camera, suy luận tư thế cơ thể qua mô hình ONNX, tính toán số lần thực hiện động tác hình phạt (squat/ngồi xổm), và điều khiển camera OBS Studio tự động bám theo streamer.

```
+---------------------------------------------------------------------------------------+
|                         GGTT AI TRACKING & OBS PIPELINE                               |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   | 1. Thu thập Khung hình (PunishmentTrackingService)                           |   |
|   |    - Đọc luồng video camera theo tốc độ khung hình định cấu hình (Fps: 30)   |   |
|   |    - Bộ đệm an toàn đa luồng (Interlocked frame exchange / worker Task)       |   |
|   +---------------------------------------+---------------------------------------+   |
|                                           | RGB Frame Tensor                          |
|   +---------------------------------------v---------------------------------------+   |
|   | 2. Suy luận Đa tầng ONNX (TrackingInference::Process 0x06000457)              |   |
|   |    - person_detection_mediapipe_2023mar.onnx: Phát hiện vùng cơ thể người     |   |
|   |    - pose_estimation_mediapipe_2023mar.onnx: Ước lượng 33 điểm landmark      |   |
|   +---------------------------------------+---------------------------------------+   |
|                                           | Landmark Coordinates (X, Y, Visibility)   |
|   +---------------------------------------v---------------------------------------+   |
|   | 3. Tính toán Hình học Khung xương (TrackingGeometry::CameraBounds)             |   |
|   |    - TrackedBody: Head, Neck, Shoulders, Elbows, Wrists, Hips, Knees, Ankles  |   |
|   |    - TrackingSlots: Quản lý gán slot khi có nhiều người trong khung hình      |   |
|   +---------------------------------------+---------------------------------------+   |
|                                           |                                           |
|            +------------------------------+------------------------------+            |
|            | Góc Khớp (Joint Angles)                                     | Tọa độ ROI |
|            v                                                             v            |
|   +-------------------------------+             +---------------------------------+   |
|   | 4. Máy Đếm Hình phạt          |             | 5. Điều khiển Camera OBS        |   |
|   |    (Punishment State Machine) |             |    (ObsTrackingClient - WS v5)  |   |
|   |    - STANDING (Góc gối > 160°) |             |    - Bắt tay SHA-256 Auth       |   |
|   |    - DOWN (Góc gối < 100°)    |             |    - Lọc làm mượt EMA Smoothing |   |
|   |    - Đếm rep & Báo hoàn thành |             |    - SetSceneItemTransform (Pan)|   |
|   +-------------------------------+             +---------------------------------+   |
|                                                                                       |
+---------------------------------------------------------------------------------------+
```

---

## 2. Mô hình AI ONNX & Thực thi Suy luận (Inference Pipeline)

### 2.1. Cặp Mô hình MediaPipe Cục bộ
GGTT tích hợp 2 tệp mô hình ONNX trong thư mục cài đặt `Tracking/`:
1. `person_detection_mediapipe_2023mar.onnx`:
   - Nhiệm vụ: Quét toàn bộ khung hình ảnh màu, phát hiện các ứng viên có người (bounding boxes) kèm điểm số tin cậy (`Confidence`).
   - Đầu vào: `detectorInput` (Tensor kích thước cố định RGB 256x256 hoặc tương đương).
2. `pose_estimation_mediapipe_2023mar.onnx`:
   - Nhiệm vụ: Cắt (crop) vùng ROI của người được chọn, suy luận 33 tọa độ khớp xương 3D và độ hiển thị (`Visibility`).
   - Đầu vào: `poseInput` (Tensor ROI RGB chuẩn hóa).

### 2.2. Lớp Wrapper Nạp Thư viện Cục bộ (TrackingNativeRuntime)
- `TrackingNativeRuntime::Ensure` (`0x06000460`): Đảm bảo các thư viện nhị phân gốc `onnxruntime.dll` và các dependencies tương thích (DirectML / CPU provider) được nạp vào không gian địa chỉ tiến trình một cách an toàn.

---

## 3. Thuật toán Đếm Động tác Hình phạt (Punishment Rep Counter)

Streamer thua cuộc trong phiên Live PK phải thực hiện số lần squat hoặc động tác thể lực theo cấu hình `Count` trong `tracking-settings.json`.

### 3.1. Tính toán Góc Khớp Hình học (TrackingGeometry)
Dựa trên các điểm tọa độ chuẩn hóa `TrackingPoint` thuộc `TrackedBody`:
- **Góc gối (Knee Angle)**:
  $$\theta_{knee} = \arccos\left(\frac{\vec{v}_{hip-knee} \cdot \vec{v}_{ankle-knee}}{\|\vec{v}_{hip-knee}\| \|\vec{v}_{ankle-knee}\|}\right)$$
  Tính toán độc lập cho cả gối trái (`LeftHip` - `LeftKnee` - `LeftAnkle`) và gối phải (`RightHip` - `RightKnee` - `RightAnkle`).
- **Góc hông (Hip Angle)**:
  Tính giữa vai (`Shoulder`), hông (`Hip`), và gối (`Knee`).

### 3.2. Máy Trạng thái Đếm Rep (Squat State Machine)
`PunishmentTrackingService` vận hành 4 trạng thái chuyển tiếp:
1. **`PREPARING`**: Đợi phát hiện streamer đứng ổn định trong khung hình với độ tin cậy $Confidence > 0.6$.
2. **`STANDING`**: Streamer ở tư thế đứng thẳng, góc gối $\theta_{knee} \ge 160^\circ$.
3. **`DOWN` (Hạ người)**: Khi $\theta_{knee} \le 100^\circ$ và hông hạ thấp hơn vị trí ban đầu một khoảng $\Delta y > y_{threshold}$.
4. **`REP_INCREMENT`**: Khi streamer đứng thẳng trở lại ($\theta_{knee} \ge 160^\circ$):
   - Tăng bộ đếm `repCount++`.
   - Bắn thông điệp cập nhật tiến độ xuống widget hiển thị hoặc phát âm thanh chúc mừng.
   - Nếu `repCount >= targetCount`: Chuyển sang trạng thái `COMPLETED`, mở khóa kịch bản hình phạt trong `ScenarioEngine`.

---

## 4. Tích hợp OBS Studio qua Giao thức WebSocket v5 (ObsTrackingClient)

Lớp `GGTT.Tracking.ObsTrackingClient` (`0x02000096`) đóng vai trò là một client WebSocket kết nối tới OBS Studio (plugin `obs-websocket` v5.x).

### 4.1. Cơ chế Bắt tay & Xác thực (Handshake & Authentication)
1. OBS gửi bản tin `Hello` (`op: 0`) chứa `authentication` challenge và salt:
   `{{ challenge = ..., salt = ... }}`.
2. Client tính mã băm xác thực 2 bước theo chuẩn RFC OBS WebSocket v5:
   - Bước 1: $H_1 = \text{Base64}(\text{SHA256}(\text{password} + \text{salt}))$.
   - Bước 2: $\text{auth} = \text{Base64}(\text{SHA256}(H_1 + \text{challenge}))$.
3. Client gửi bản tin `Identify` (`op: 1`) với trường `rpcVersion: 1` và `authentication: auth`.
4. OBS phản hồi `Identified` (`op: 2`), kích hoạt trạng thái sẵn sàng gửi lệnh.

### 4.2. Điều khiển Camera Tự động Bám đuổi (Auto Pan & Zoom)
- `ObsTrackingClient` định kỳ tính toán hình chữ nhật bao quanh (`CameraBounds`) từ tọa độ khuôn mặt và thân người của `TrackedBody`.
- **Bộ lọc làm mượt (Exponential Moving Average - EMA)**:
  Áp dụng công thức làm mượt tọa độ để camera OBS không bị rung lắc giật cục theo từng khung hình:
  $$P_{filtered}(t) = \alpha \cdot P_{raw}(t) + (1 - \alpha) \cdot P_{filtered}(t-1)$$
- Gửi lệnh `SetSceneItemTransform`:
  ```json
  {
    "op": 6,
    "d": {
      "requestType": "SetSceneItemTransform",
      "requestId": "req_101",
      "requestData": {
        "sceneName": "Main Live",
        "sceneItemId": 1,
        "sceneItemTransform": {
          "positionX": 120.5,
          "positionY": 45.0,
          "scaleX": 1.15,
          "scaleY": 1.15,
          "boundsType": "OBS_BOUNDS_SCALE_INNER"
        }
      }
    }
  }
  ```

---

## 5. Khuyến nghị Tái hiện Phòng sạch (Clean-Room Guidelines)

1. **Thay thế ONNX Engine**:
   - Sử dụng thư viện MediaPipe mã nguồn mở trực tiếp từ Google (MediaPipe Tasks Python/C++/Web) hoặc YOLOv8-pose thay cho việc tái sử dụng các tệp nhị phân `.onnx` có sẵn trong bản cài đặt.
2. **Chuẩn hóa Giao thức OBS**:
   - Sử dụng thư viện client `obs-websocket-dotnet` hoặc `obs-websocket-js` chính thức để đảm bảo tương thích hoàn toàn với OBS Studio 28 trở lên mà không cần viết lại lớp xử lý frame nhị phân cấp thấp.
3. **Bộ đếm Rep Linh hoạt**:
   - Tách rời thuật toán tính góc khớp thành module riêng, cho phép người dùng tùy chỉnh góc gối ngưỡng (`down_angle` mặc định 100 độ, `up_angle` mặc định 160 độ) phù hợp với thể trạng của từng streamer.
