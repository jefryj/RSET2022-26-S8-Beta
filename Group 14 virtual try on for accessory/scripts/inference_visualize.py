import torch
import cv2
import numpy as np

from data_loader import AccessoryDataset, crop_from_mask
from model import LGRWResidual3DNet


# -------------------------------------------------
# Build full homography from affine residual
# -------------------------------------------------
def build_delta_homography(delta_vec):
    H = np.eye(3, dtype=np.float32)
    H[:2, :3] += delta_vec.reshape(2, 3)
    return H


# -------------------------------------------------
# Main Visualization
# -------------------------------------------------
def run_visual_test():

    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    print("🔍 Loading model...")
    model = LGRWResidual3DNet(in_channels=7).to(DEVICE)
    model.load_state_dict(
        torch.load("best_lgrw_residual_model.pth", map_location=DEVICE)
    )
    model.eval()

    print("📂 Loading test sample...")
    dataset = AccessoryDataset("face_glasses", "test")

    img_id = dataset.image_ids[0]

    # Load raw images
    fg_file = next(dataset.fg_path.glob(f"{img_id}.*"))
    bg_file = next(dataset.bg_path.glob(f"{img_id}.*"))
    mask_file = next(dataset.mask_path.glob(f"{img_id}.*"))

    foreground = cv2.imread(str(fg_file))
    background = cv2.imread(str(bg_file))
    mask = cv2.imread(str(mask_file))

    # -------------------------------------------------
    # Extract ROI (exactly like training)
    # -------------------------------------------------
    padding = 30
    face_roi = crop_from_mask(background, mask, padding)
    acc_roi = crop_from_mask(foreground, mask, padding)

    face_norm = face_roi.astype(np.float32) / 255.0
    acc_norm = acc_roi.astype(np.float32) / 255.0

    mask_roi = crop_from_mask(mask, mask, padding=0)
    mask_gray = cv2.cvtColor(mask_roi, cv2.COLOR_BGR2GRAY)
    mask_norm = (mask_gray.astype(np.float32) / 255.0)[..., None]

    input_tensor = np.concatenate([face_norm, acc_norm, mask_norm], axis=2)
    input_tensor = torch.tensor(
        input_tensor.transpose(2, 0, 1),
        dtype=torch.float32
    ).unsqueeze(0).to(DEVICE)

    # -------------------------------------------------
    # Get ground-truth homography
    # -------------------------------------------------
    H_gt = np.array(
        dataset.trans_params[img_id]["trans_matrix"],
        dtype=np.float32
    ).reshape(3, 3)

    # -------------------------------------------------
    # Simulate noisy baseline (same as training)
    # -------------------------------------------------
    H0 = H_gt.copy()
    H0[:2, :] += np.random.normal(0, 0.02, (2, 3))

    # Initial misaligned result
    warped_initial = cv2.warpPerspective(acc_roi, H0, (256, 256))

    # -------------------------------------------------
    # Predict residual correction
    # -------------------------------------------------
    with torch.no_grad():
        pred_delta, _, _, confidence = model(input_tensor)

    pred_delta = pred_delta.cpu().numpy()[0]

    print("Predicted delta_H:", pred_delta)
    print(f"Predicted confidence: {confidence.item():.3f}")

    # -------------------------------------------------
    # Reconstruct corrected homography
    # -------------------------------------------------
    H_delta = build_delta_homography(pred_delta)

    # Final predicted homography
    H_final = H_delta @ H0

    warped_corrected = cv2.warpPerspective(acc_roi, H_final, (256, 256))

    # Perfect ground-truth alignment
    warped_gt = cv2.warpPerspective(acc_roi, H_gt, (256, 256))

    # Blend results
    blended_initial = cv2.addWeighted(face_roi, 1.0, warped_initial, 0.7, 0)
    blended_corrected = cv2.addWeighted(face_roi, 1.0, warped_corrected, 0.7, 0)
    blended_gt = cv2.addWeighted(face_roi, 1.0, warped_gt, 0.7, 0)

    # -------------------------------------------------
    # Save images
    # -------------------------------------------------
    cv2.imwrite("1_initial_noisy.png", blended_initial)
    cv2.imwrite("2_model_corrected.png", blended_corrected)
    cv2.imwrite("3_ground_truth.png", blended_gt)

    print("✅ Saved:")
    print(" - 1_initial_noisy.png")
    print(" - 2_model_corrected.png")
    print(" - 3_ground_truth.png")


if __name__ == "__main__":
    run_visual_test()
