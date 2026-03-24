import torch
import numpy as np
from torch.utils.data import DataLoader, ConcatDataset

from data_loader import AccessoryDataset
from model import LGRWResidual3DNet


# -------------------------------------------------
# Build full homography from affine residual
# -------------------------------------------------
def build_homography(delta_vec):
    B = delta_vec.size(0)

    H = torch.eye(3, device=delta_vec.device).unsqueeze(0).repeat(B, 1, 1)
    H[:, :2, :3] += delta_vec.view(B, 2, 3)

    return H


# -------------------------------------------------
# Full Evaluation
# -------------------------------------------------
def evaluate(model, dataloader, device):

    model.eval()

    total_mse = 0.0
    total_mae = 0.0
    total_translation_error = 0.0
    total_corner_error = 0.0
    total_samples = 0

    total_conf_mse = 0.0
    correct_confidence = 0
    total_confidence = 0

    corners = torch.tensor(
        [
            [0,   0,   1],
            [255, 0,   1],
            [255, 255, 1],
            [0,   255, 1]
        ],
        dtype=torch.float32,
        device=device
    ).T.unsqueeze(0)

    with torch.no_grad():
        for batch in dataloader:

            inputs = batch["input"].to(device)
            gt_delta_h = batch["delta_H"].to(device)
            gt_conf = batch["confidence_gt"].to(device)

            pred_delta_h, _, _, pred_conf = model(inputs)

            B = inputs.size(0)

            # -----------------------------
            # Parameter metrics
            # -----------------------------
            mse = torch.mean((pred_delta_h - gt_delta_h) ** 2, dim=1)
            mae = torch.mean(torch.abs(pred_delta_h - gt_delta_h), dim=1)

            total_mse += mse.sum().item()
            total_mae += mae.sum().item()

            # Translation error
            tx_error = torch.abs(pred_delta_h[:, 2] - gt_delta_h[:, 2])
            ty_error = torch.abs(pred_delta_h[:, 5] - gt_delta_h[:, 5])
            translation_error = (tx_error + ty_error) / 2.0

            total_translation_error += translation_error.sum().item()

            # -----------------------------
            # Corner reprojection error
            # -----------------------------
            H_pred = build_homography(pred_delta_h)
            H_gt = build_homography(gt_delta_h)

            b_corners = corners.repeat(B, 1, 1)

            pred_pts = torch.bmm(H_pred, b_corners)
            gt_pts = torch.bmm(H_gt, b_corners)

            pred_pts = pred_pts[:, :2, :] / (pred_pts[:, 2:3, :] + 1e-8)
            gt_pts = gt_pts[:, :2, :] / (gt_pts[:, 2:3, :] + 1e-8)

            dist = torch.linalg.norm(pred_pts - gt_pts, dim=1)
            corner_error = dist.mean(dim=1)

            total_corner_error += corner_error.sum().item()

            # -----------------------------
            # Confidence metrics
            # -----------------------------
            conf_mse = torch.mean((pred_conf - gt_conf) ** 2)
            total_conf_mse += conf_mse.item() * B

            pred_binary = (pred_conf > 0.5).float()
            gt_binary = (gt_conf > 0.5).float()

            correct_confidence += (pred_binary == gt_binary).sum().item()
            total_confidence += gt_binary.numel()

            total_samples += B

    # -----------------------------
    # Final metrics
    # -----------------------------
    avg_mse = total_mse / total_samples
    avg_mae = total_mae / total_samples
    avg_translation_error = total_translation_error / total_samples
    avg_corner_error = total_corner_error / total_samples
    avg_conf_mse = total_conf_mse / total_samples

    confidence_accuracy = 100.0 * correct_confidence / total_confidence
    estimated_alignment_accuracy = max(0.0, 100.0 - (avg_corner_error * 2.0))

    print("\n📊 ----- FINAL MODEL EVALUATION -----")
    print(f"🔹 ΔH MSE                 : {avg_mse:.6f}")
    print(f"🔹 ΔH MAE                 : {avg_mae:.6f}")
    print(f"🔹 Translation Error      : {avg_translation_error:.3f} pixels")
    print(f"🔹 Mean Corner Error      : {avg_corner_error:.2f} pixels")
    print(f"🔹 Alignment Accuracy     : {estimated_alignment_accuracy:.2f}%")
    print(f"🔹 Confidence MSE         : {avg_conf_mse:.6f}")
    print(f"🔹 Confidence Accuracy    : {confidence_accuracy:.2f}%")
    print("------------------------------------------------\n")

    return avg_corner_error


# -------------------------------------------------
# Entry
# -------------------------------------------------
if __name__ == "__main__":

    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n🔍 Running evaluation on {DEVICE}")

    test_hat = AccessoryDataset("face_hat", "test")
    test_glass = AccessoryDataset("face_glasses", "test")
    test_dataset = ConcatDataset([test_hat, test_glass])

    dataloader = DataLoader(
        test_dataset,
        batch_size=8,
        shuffle=False,
        num_workers=0
    )

    # ✅ FIXED: in_channels = 6
    model = LGRWResidual3DNet(in_channels=6).to(DEVICE)

    model.load_state_dict(
        torch.load("best_lgrw_residual_model.pth", map_location=DEVICE)
    )

    evaluate(model, dataloader, DEVICE)
