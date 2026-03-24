import json
import cv2
import numpy as np
from pathlib import Path
from torch.utils.data import Dataset


# -------------------------------------------------
# Utility: Safe image finder
# -------------------------------------------------
def find_image(folder: Path, img_id: str):
    for ext in ["jpg", "jpeg", "png"]:
        matches = list(folder.glob(f"{img_id}.{ext}"))
        if matches:
            return str(matches[0])
    for ext in ["jpg", "jpeg", "png"]:
        matches = list(folder.glob(f"*{img_id}*.{ext}"))
        if matches:
            return str(matches[0])
    return None


# -------------------------------------------------
# Crop ROI and return bbox
# -------------------------------------------------
def crop_from_mask(image, mask, padding=30):

    gray = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
    ys, xs = np.where(gray > 0)

    if len(xs) == 0 or len(ys) == 0:
        h, w = image.shape[:2]
        return cv2.resize(image, (256, 256)), (0, 0, w, h)

    x1, x2 = xs.min(), xs.max()
    y1, y2 = ys.min(), ys.max()

    x1 = max(0, x1 - padding)
    y1 = max(0, y1 - padding)
    x2 = min(image.shape[1], x2 + padding)
    y2 = min(image.shape[0], y2 + padding)

    roi = image[y1:y2, x1:x2]
    roi_resized = cv2.resize(roi, (256, 256))

    return roi_resized, (x1, y1, x2, y2)


# -------------------------------------------------
# Convert homography to ROI space
# -------------------------------------------------
def convert_to_roi_space(H_img, bbox):

    x1, y1, x2, y2 = bbox
    roi_w = x2 - x1
    roi_h = y2 - y1

    T_roi_to_img = np.array([
        [roi_w / 256.0, 0, x1],
        [0, roi_h / 256.0, y1],
        [0, 0, 1]
    ], dtype=np.float32)

    T_img_to_roi = np.linalg.inv(T_roi_to_img)

    return T_img_to_roi @ H_img @ T_roi_to_img


# -------------------------------------------------
# Dataset Class (TRUE Refinement Version)
# -------------------------------------------------
class AccessoryDataset(Dataset):

    def __init__(self, dataset_type="face_glasses", split="train"):

        self.root = (
            Path(__file__).resolve().parent.parent
            / "datasets"
            / dataset_type
            / split
        )

        self.fg_path = self.root / "foreground"
        self.bg_path = self.root / "background"
        self.mask_path = self.root / "foreground_mask"
        self.trans_file = self.root / "trans_params.json"

        with open(self.trans_file, "r") as f:
            self.trans_params = json.load(f)

        self.image_ids = list(self.trans_params.keys())
        self.is_train = split == "train"

    def __len__(self):
        return len(self.image_ids)

    def __getitem__(self, idx):

        img_id = self.image_ids[idx]

        fg_file = find_image(self.fg_path, img_id)
        bg_file = find_image(self.bg_path, img_id)
        mask_file = find_image(self.mask_path, img_id)

        foreground = cv2.imread(fg_file)
        background = cv2.imread(bg_file)
        mask = cv2.imread(mask_file)

        padding = np.random.randint(20, 45) if self.is_train else 30

        face_roi, bbox = crop_from_mask(background, mask, padding)
        acc_roi, _ = crop_from_mask(foreground, mask, padding)

        # Normalize images
        face_roi = face_roi.astype(np.float32) / 255.0
        acc_roi = acc_roi.astype(np.float32) / 255.0

        # --------------------------------------------
        # Load H_gt and enforce affine
        # --------------------------------------------
        H_full = np.array(
            self.trans_params[img_id]["trans_matrix"],
            dtype=np.float32
        ).reshape(3, 3)

        H_affine = np.array([
            [H_full[0,0], H_full[0,1], H_full[0,2]],
            [H_full[1,0], H_full[1,1], H_full[1,2]],
            [0, 0, 1]
        ], dtype=np.float32)

        H_gt = convert_to_roi_space(H_affine, bbox)

        # --------------------------------------------
        # Create noisy initial guess
        # --------------------------------------------
        noise_scale = 0.02 if self.is_train else 0.0

        H_initial = H_gt.copy()

        if self.is_train:
            H_initial[:2, :3] += np.random.normal(0, noise_scale, (2, 3))

        # --------------------------------------------
        # Warp accessory using H_initial
        # --------------------------------------------
        warped_acc = cv2.warpPerspective(
            acc_roi,
            H_initial,
            (256, 256),
            flags=cv2.INTER_LINEAR
        )

        # --------------------------------------------
        # Compute small residual
        # --------------------------------------------
        H_initial_inv = np.linalg.inv(H_initial)
        delta_H = H_gt @ H_initial_inv
        delta_H = delta_H - np.eye(3, dtype=np.float32)

        delta_vec = delta_H[:2, :3].reshape(-1).astype(np.float32)

        # --------------------------------------------
        # Confidence
        # --------------------------------------------
        error = np.linalg.norm(delta_vec)
        confidence_gt = np.exp(-10.0 * error).astype(np.float32)

        # --------------------------------------------
        # Final Input
        # --------------------------------------------
        input_tensor = np.concatenate([face_roi, warped_acc], axis=2)

        return {
            "input": input_tensor.transpose(2,0,1).astype(np.float32),
            "delta_H": delta_vec,
            "confidence_gt": np.array([confidence_gt], dtype=np.float32)
        }