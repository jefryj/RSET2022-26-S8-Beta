import torch
import cv2
import numpy as np
import random
import os
import json

from model import ResidualHomographyNet
from data_loader import ResidualHomographyDataset


DATASET_ROOT = "../datasets"


# -----------------------------
# Load trained model
# -----------------------------
model = ResidualHomographyNet()

model.load_state_dict(
    torch.load("residual_homography.pth", map_location="cpu", weights_only=True)
)

model.eval()


# -----------------------------
# Load dataset for glasses
# -----------------------------
dataset = ResidualHomographyDataset(
    dataset_root=DATASET_ROOT,
    split="test"
)

print("Dataset size:", len(dataset))

# Select random glasses
glass_idx = random.randint(0, len(dataset) - 1)
_, _ = dataset[glass_idx]

glasses_dir = os.path.join(DATASET_ROOT, "face_glasses", "test")
glass_id = dataset.ids[glass_idx]

acc_path = os.path.join(glasses_dir, "foreground", f"{glass_id}.png")
accessory = cv2.imread(acc_path)

if accessory is None:
    raise Exception(f"Failed to load accessory {glass_id}")

print(f"Using glasses ID: {glass_id}")
print(f"Accessory shape: {accessory.shape}")


# Load OpenCV face detector
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
)


# -----------------------------
# Open webcam
# -----------------------------
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise Exception("Failed to open webcam")

print("Webcam started!")
print("Press 'q' to quit")
print("Press 's' to change glasses")


while True:
    ret, frame = cap.read()

    if not ret:
        break

    # Flip for selfie view
    frame = cv2.flip(frame, 1)
    h, w = frame.shape[:2]

    # Convert to grayscale for face detection
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Detect faces
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    for (x, y, fw, fh) in faces:
        # Add padding
        padding = 20
        x1 = max(0, x - padding)
        y1 = max(0, y - padding)
        x2 = min(w, x + fw + padding)
        y2 = min(h, y + fh + padding)

        face_crop = frame[y1:y2, x1:x2]

        if face_crop.shape[0] < 50 or face_crop.shape[1] < 50:
            continue

        # Resize to 224x224 for model
        face_roi = cv2.resize(face_crop, (224, 224))
        accessory_resized = cv2.resize(accessory, (224, 224))

        # Create input tensor (face + accessory + mask)
        face_norm = face_roi / 255.0
        acc_norm = accessory_resized / 255.0

        # Simple mask from accessory
        acc_gray = cv2.cvtColor(accessory_resized, cv2.COLOR_BGR2GRAY)
        mask = (acc_gray > 0).astype(np.float32)

        input_tensor = np.concatenate(
            [face_norm, acc_norm, mask[:, :, None]],
            axis=2
        )

        input_tensor = input_tensor.transpose(2, 0, 1)
        input_tensor = torch.tensor(input_tensor, dtype=torch.float32).unsqueeze(0)

        # Model prediction
        with torch.no_grad():
            pred_offsets = model(input_tensor).squeeze().numpy()

        # Scale offsets to pixel space
        pred_offsets = pred_offsets * 224

        # Compute homography
        base = np.array([
            [0, 0],
            [224, 0],
            [224, 224],
            [0, 224]
        ], dtype=np.float32)

        pred_corners = base + pred_offsets.reshape(4, 2)

        H_pred = cv2.getPerspectiveTransform(base, pred_corners)

        # Warp accessory
        warp_pred = cv2.warpPerspective(accessory_resized, H_pred, (224, 224))

        # Create mask
        mask_warp = cv2.cvtColor(warp_pred, cv2.COLOR_BGR2GRAY)
        mask_warp = (mask_warp > 0).astype(np.uint8)

        # Overlay
        overlay = face_roi.copy()
        for c in range(3):
            overlay[:, :, c] = np.where(
                mask_warp == 1,
                warp_pred[:, :, c],
                overlay[:, :, c]
            )

        # Resize back to original crop size and place on frame
        overlay_resized = cv2.resize(overlay, (x2 - x1, y2 - y1))
        frame[y1:y2, x1:x2] = overlay_resized

        # Draw face box
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

    cv2.imshow("Virtual Try-On - Webcam", frame)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('s'):
        # Change glasses
        glass_idx = random.randint(0, len(dataset) - 1)
        glass_id = dataset.ids[glass_idx]
        acc_path = os.path.join(glasses_dir, "foreground", f"{glass_id}.png")
        accessory = cv2.imread(acc_path)
        print(f"Changed to glasses ID: {glass_id}")


cap.release()
cv2.destroyAllWindows()