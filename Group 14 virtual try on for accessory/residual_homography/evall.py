import torch
import numpy as np
from torch.utils.data import DataLoader

from data_loader import ResidualHomographyDataset
from model import ResidualHomographyNet


# -------------------------------------------------
# Compute corner error (convert to pixels)
# -------------------------------------------------
def compute_corner_error(pred_offsets, gt_offsets):

    B = pred_offsets.size(0)

    pred_offsets = pred_offsets.view(B, 4, 2)
    gt_offsets = gt_offsets.view(B, 4, 2)

    # normalized error
    error = torch.linalg.norm(pred_offsets - gt_offsets, dim=2)

    # convert to pixels (training used 224 crop)
    error = error * 224

    return error.mean(dim=1)


# -------------------------------------------------
# Evaluation
# -------------------------------------------------
def evaluate(model, dataloader, device):

    model.eval()

    total_mse = 0.0
    total_mae = 0.0
    total_corner_error = 0.0

    total_samples = 0

    with torch.no_grad():

        for inputs, targets in dataloader:

            inputs = inputs.to(device)
            gt_offsets = targets.to(device)

            pred_offsets = model(inputs)

            B = inputs.size(0)

            # -----------------------------
            # Offset MSE
            # -----------------------------
            mse = torch.mean((pred_offsets - gt_offsets) ** 2, dim=1)

            # -----------------------------
            # Offset MAE
            # -----------------------------
            mae = torch.mean(torch.abs(pred_offsets - gt_offsets), dim=1)

            # -----------------------------
            # Corner reprojection error
            # -----------------------------
            corner_error = compute_corner_error(pred_offsets, gt_offsets)

            total_mse += mse.sum().item()
            total_mae += mae.sum().item()
            total_corner_error += corner_error.sum().item()

            total_samples += B

    # -----------------------------
    # Final Metrics
    # -----------------------------
    avg_mse = total_mse / total_samples
    avg_mae = total_mae / total_samples
    avg_corner_error = total_corner_error / total_samples

    alignment_accuracy = max(0.0, 100.0 - (avg_corner_error * 2.0))

    print("\n📊 ----- FINAL MODEL EVALUATION -----")
    print(f"🔹 Offset MSE            : {avg_mse:.6f}")
    print(f"🔹 Offset MAE            : {avg_mae:.6f}")
    print(f"🔹 Mean Corner Error     : {avg_corner_error:.2f} pixels")
    print(f"🔹 Alignment Accuracy    : {alignment_accuracy:.2f}%")
    print("------------------------------------------------\n")

    return avg_corner_error


# -------------------------------------------------
# Entry
# -------------------------------------------------
if __name__ == "__main__":

    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    print(f"\n🔍 Running evaluation on {DEVICE}")

    dataset = ResidualHomographyDataset(
        dataset_root="../datasets",
        split="test",
        accessory_type="all"
    )

    print("Dataset size:", len(dataset))

    dataloader = DataLoader(
        dataset,
        batch_size=8,
        shuffle=False,
        num_workers=0
    )

    model = ResidualHomographyNet().to(DEVICE)

    model.load_state_dict(
        torch.load(
            "residual_homography_all.pth",
            map_location=DEVICE,
            weights_only=True
        )
    )

    evaluate(model, dataloader, DEVICE)