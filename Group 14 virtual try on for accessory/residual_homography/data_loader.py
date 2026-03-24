import os
import json
import cv2
import torch
import numpy as np
from torch.utils.data import Dataset


class ResidualHomographyDataset(Dataset):

    def __init__(self, dataset_root, split="train", size=224, accessory_type="all"):

        self.dataset_root = dataset_root
        self.split = split
        self.size = size

        self.samples = []

        # -----------------------------
        # Load glasses dataset
        # -----------------------------
        if accessory_type in ["glasses", "all"]:

            glasses_dir = os.path.join(dataset_root, "face_glasses", split)

            trans_path = os.path.join(glasses_dir, "trans_params.json")

            with open(trans_path) as f:
                trans_params = json.load(f)

            for img_id in trans_params.keys():

                self.samples.append({
                    "dataset_dir": glasses_dir,
                    "type": "glasses",
                    "img_id": img_id,
                    "params": trans_params[img_id]
                })


        # -----------------------------
        # Load hat dataset
        # -----------------------------
        if accessory_type in ["hat", "all"]:

            hat_dir = os.path.join(dataset_root, "face_hat", split)

            trans_path = os.path.join(hat_dir, "trans_params.json")

            with open(trans_path) as f:
                trans_params = json.load(f)

            for img_id in trans_params.keys():

                self.samples.append({
                    "dataset_dir": hat_dir,
                    "type": "hat",
                    "img_id": img_id,
                    "params": trans_params[img_id]
                })


        print("Loaded samples:", len(self.samples))


    def __len__(self):
        return len(self.samples)


    # -----------------------------
    # Random initial homography H0
    # -----------------------------
    def random_H0(self):

        tx = np.random.normal(0, 10)
        ty = np.random.normal(0, 10)

        rot = np.random.normal(0, 5)
        scale = np.random.normal(1, 0.05)

        rad = np.deg2rad(rot)

        cos = np.cos(rad) * scale
        sin = np.sin(rad) * scale

        H = np.array([
            [cos, -sin, tx],
            [sin,  cos, ty],
            [0, 0, 1]
        ], dtype=np.float32)

        return H


    # -----------------------------
    # Center crop ROI
    # -----------------------------
    def crop_roi(self, img):

        h, w = img.shape[:2]

        cx = w // 2
        cy = h // 2

        s = min(h, w) // 2

        x1 = cx - s
        x2 = cx + s
        y1 = cy - s
        y2 = cy + s

        roi = img[y1:y2, x1:x2]

        roi = cv2.resize(roi, (self.size, self.size))

        return roi


    # -----------------------------
    # Compute homography offsets
    # -----------------------------
    def compute_offsets_roi(self, mask_gt, mask_h0):

        def get_bbox(mask):

            ys, xs = np.where(mask > 0.5)

            if len(xs) == 0:
                return None

            x1 = xs.min()
            x2 = xs.max()

            y1 = ys.min()
            y2 = ys.max()

            return np.array([
                [x1, y1],
                [x2, y1],
                [x2, y2],
                [x1, y2]
            ], dtype=np.float32)


        gt_corners = get_bbox(mask_gt)
        h0_corners = get_bbox(mask_h0)

        if gt_corners is None or h0_corners is None:
            return np.zeros(8, dtype=np.float32)

        offsets = gt_corners - h0_corners

        return offsets.reshape(-1)


    # -----------------------------
    # Main sample loader
    # -----------------------------
    def __getitem__(self, idx):

        sample = self.samples[idx]

        dataset_dir = sample["dataset_dir"]
        img_id = sample["img_id"]
        params = sample["params"]

        bg_dir = os.path.join(dataset_dir, "background")
        acc_dir = os.path.join(dataset_dir, "foreground")
        mask_dir = os.path.join(dataset_dir, "foreground_mask")

        bg_path = os.path.join(bg_dir, f"{img_id}.jpg")
        acc_path = os.path.join(acc_dir, f"{img_id}.png")
        mask_path = os.path.join(mask_dir, f"{img_id}.png")


        background = cv2.imread(bg_path)
        accessory = cv2.imread(acc_path)

        mask = cv2.imread(mask_path, 0)

        mask = mask.astype(np.float32) / 255.0


        H_gt = np.array(params["trans_matrix"]).reshape(3,3)


        # -----------------------------
        # Warp GT accessory
        # -----------------------------
        warped_gt = cv2.warpPerspective(
            accessory,
            H_gt,
            (background.shape[1], background.shape[0])
        )

        mask_gt = cv2.warpPerspective(
            mask,
            H_gt,
            (background.shape[1], background.shape[0])
        )


        # -----------------------------
        # Random initial homography
        # -----------------------------
        H0 = self.random_H0()

        warped_H0 = cv2.warpPerspective(
            accessory,
            H0,
            (background.shape[1], background.shape[0])
        )

        mask_H0 = cv2.warpPerspective(
            mask,
            H0,
            (background.shape[1], background.shape[0])
        )


        # -----------------------------
        # ROI crops
        # -----------------------------
        face_roi = self.crop_roi(background)

        acc_roi = self.crop_roi(warped_H0)

        mask_roi = self.crop_roi(mask_H0)

        mask_roi_gt = self.crop_roi(mask_gt)


        # -----------------------------
        # Compute offsets
        # -----------------------------
        offsets = self.compute_offsets_roi(mask_roi_gt, mask_roi)

        offsets = offsets / self.size

        offsets = np.clip(offsets, -1, 1)


        # -----------------------------
        # Normalize images
        # -----------------------------
        face_roi = face_roi / 255.0
        acc_roi = acc_roi / 255.0


        # -----------------------------
        # Input tensor (7 channels)
        # -----------------------------
        input_tensor = np.concatenate([
            face_roi,
            acc_roi,
            mask_roi[:, :, None]
        ], axis=2)

        input_tensor = input_tensor.transpose(2,0,1)


        return (
            torch.tensor(input_tensor, dtype=torch.float32),
            torch.tensor(offsets, dtype=torch.float32)
        )