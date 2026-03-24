import torch
import cv2
import numpy as np
import random
import os

from model import ResidualHomographyNet
from data_loader import ResidualHomographyDataset


# resolve paths relative to this script so the user can run from anywhere
script_dir = os.path.dirname(__file__)

MODEL_PATH = os.path.join(script_dir, "residual_homography.pth")
DATASET_ROOT = os.path.abspath(os.path.join(script_dir, "..", "datasets"))

# -----------------------------
# Load trained model
# -----------------------------
model = ResidualHomographyNet()
model.load_state_dict(
    torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
)
model.eval()

# -----------------------------
# Load dataset
# -----------------------------
dataset = ResidualHomographyDataset(
    dataset_root=DATASET_ROOT,
    split="test"
)

print("Dataset size:", len(dataset))


# -----------------------------
# Select random sample
# -----------------------------
idx = random.randint(0, len(dataset) - 1)

input_tensor, gt_offsets = dataset[idx]

gt_offsets = gt_offsets.numpy()
input_np = input_tensor.numpy()


# -----------------------------
# Recover model inputs
# -----------------------------
face_roi = input_np[:3].transpose(1,2,0)
accessory = input_np[3:6].transpose(1,2,0)

face_roi = (face_roi * 255).astype(np.uint8)
accessory = (accessory * 255).astype(np.uint8)


# -----------------------------
# Model prediction
# -----------------------------
with torch.no_grad():
    pred_offsets = model(input_tensor.unsqueeze(0)).squeeze().numpy()

# Convert normalized offsets -> pixels
pred_offsets = pred_offsets * 224
gt_offsets_pixels = gt_offsets * 224


# -----------------------------
# Base corners
# -----------------------------
h, w = 224, 224

base = np.array([
    [0,0],
    [w,0],
    [w,h],
    [0,h]
], dtype=np.float32)


# -----------------------------
# Compute corners
# -----------------------------
pred_corners = base + pred_offsets.reshape(4,2)
gt_corners = base + gt_offsets_pixels.reshape(4,2)


# -----------------------------
# Mean Corner Error
# -----------------------------
corner_error = np.linalg.norm(pred_corners - gt_corners, axis=1)
mce = corner_error.mean()

print("\n====== CORNER ERROR ======")
print("Corner errors:", corner_error)
print("Mean Corner Error:", mce, "pixels")

# draw helper for debugging
# -----------------------------
def draw_corners(img, corners, color):
    img = img.copy()
    pts = corners.astype(np.int32)
    for i in range(4):
        cv2.circle(img, tuple(pts[i]), 3, color, -1)
        cv2.line(img, tuple(pts[i]), tuple(pts[(i+1)%4]), color, 1)
    return img

face_with_pred = draw_corners(face_roi, pred_corners, (0,255,0))
face_with_gt = draw_corners(face_roi, gt_corners, (0,0,255))


# -----------------------------
# Homography
# -----------------------------
H_pred = cv2.getPerspectiveTransform(base, pred_corners)
H_gt = cv2.getPerspectiveTransform(base, gt_corners)


# -----------------------------
# Warp accessory
# -----------------------------
warp_pred = cv2.warpPerspective(accessory, H_pred, (w,h))
warp_gt = cv2.warpPerspective(accessory, H_gt, (w,h))


# -----------------------------
# Masks
# -----------------------------
mask_pred = cv2.cvtColor(warp_pred, cv2.COLOR_BGR2GRAY) > 0
mask_gt = cv2.cvtColor(warp_gt, cv2.COLOR_BGR2GRAY) > 0


# -----------------------------
# Overlay predicted
# -----------------------------
overlay_pred = face_roi.copy()

for c in range(3):
    overlay_pred[:,:,c] = np.where(
        mask_pred,
        warp_pred[:,:,c],
        overlay_pred[:,:,c]
    )


# -----------------------------
# Overlay GT
# -----------------------------
overlay_gt = face_roi.copy()

for c in range(3):
    overlay_gt[:,:,c] = np.where(
        mask_gt,
        warp_gt[:,:,c],
        overlay_gt[:,:,c]
    )


# -----------------------------
# Get dataset image ID from sample metadata
# -----------------------------
sample = dataset.samples[idx]
dataset_dir = sample["dataset_dir"]
face_id = sample["img_id"]

# build paths for the current image
bg_path = os.path.join(dataset_dir, "background", f"{face_id}.jpg")
gt_path = os.path.join(dataset_dir, "composite", f"{face_id}.jpg")

if not os.path.exists(bg_path):
    raise FileNotFoundError(f"background image not found: {bg_path}")

print("\nTesting image:", face_id)
print("Dataset folder:", dataset_dir)


# -----------------------------
# Load dataset GT images
# -----------------------------
gt_face = cv2.imread(bg_path)
gt_composite = cv2.imread(gt_path)

if gt_face is None or gt_composite is None:
    raise Exception("Failed to load dataset images.")

gt_face = cv2.resize(gt_face, (224,224))
gt_composite = cv2.resize(gt_composite, (224,224))


# -----------------------------
# Visualization
# -----------------------------
cv2.imshow("Dataset Face", gt_face)
cv2.imshow("Dataset Composite (True)", gt_composite)
cv2.imshow("Model Overlay Prediction", overlay_pred)
cv2.imshow("Face with Pred Corners", face_with_pred)
cv2.imshow("Face with GT Corners", face_with_gt)
cv2.imshow("GT Overlay (from offsets)", overlay_gt)
cv2.imshow("Warp Pred", warp_pred)
cv2.imshow("Warp GT", warp_gt)

# save results
out_dir = os.path.join(script_dir, "visualizations")
os.makedirs(out_dir, exist_ok=True)
print("Saving outputs to", out_dir)
success = []
success.append(cv2.imwrite(os.path.join(out_dir, f"{face_id}_face.jpg"), gt_face))
success.append(cv2.imwrite(os.path.join(out_dir, f"{face_id}_composite.jpg"), gt_composite))
success.append(cv2.imwrite(os.path.join(out_dir, f"{face_id}_overlay_pred.jpg"), overlay_pred))
success.append(cv2.imwrite(os.path.join(out_dir, f"{face_id}_overlay_gt.jpg"), overlay_gt))
success.append(cv2.imwrite(os.path.join(out_dir, f"{face_id}_face_pred_corners.jpg"), face_with_pred))
success.append(cv2.imwrite(os.path.join(out_dir, f"{face_id}_face_gt_corners.jpg"), face_with_gt))
success.append(cv2.imwrite(os.path.join(out_dir, f"{face_id}_warp_pred.jpg"), warp_pred))
success.append(cv2.imwrite(os.path.join(out_dir, f"{face_id}_warp_gt.jpg"), warp_gt))
print("write success flags", success)

cv2.waitKey(0)
cv2.destroyAllWindows()