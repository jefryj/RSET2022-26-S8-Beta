import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, ConcatDataset
from tqdm import tqdm

from data_loader_old import AccessoryDataset
from model import LGRWResidual3DNet


# -------------------------------------------------
# Config
# -------------------------------------------------
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

BATCH_SIZE = 8
EPOCHS = 40
LR = 1e-4
WEIGHT_DECAY = 1e-5

NUM_WORKERS = 0  # Windows safe

# Loss weights
LAMBDA_H = 1.0
LAMBDA_CONF = 0.1

# Early stopping
PATIENCE = 7


# -------------------------------------------------
# Training Function
# -------------------------------------------------
def train():

    print(f"\n🚀 Starting Training on {DEVICE}")

    # -------------------------------------------------
    # Datasets
    # -------------------------------------------------
    train_hat = AccessoryDataset("face_hat", "train")
    train_glass = AccessoryDataset("face_glasses", "train")
    train_dataset = ConcatDataset([train_hat, train_glass])

    val_hat = AccessoryDataset("face_hat", "test")
    val_glass = AccessoryDataset("face_glasses", "test")
    val_dataset = ConcatDataset([val_hat, val_glass])

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=NUM_WORKERS,
        pin_memory=(DEVICE.type == "cuda")
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=(DEVICE.type == "cuda")
    )

    print(f"📦 Total Training Samples: {len(train_dataset)}")
    print(f"📦 Total Validation Samples: {len(val_dataset)}")

    # -------------------------------------------------
    # Model (6 channels now)
    # -------------------------------------------------
    model = LGRWResidual3DNet(in_channels=6).to(DEVICE)

    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=LR,
        betas=(0.9, 0.999),
        weight_decay=WEIGHT_DECAY
    )

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="min",
        factor=0.5,
        patience=3,
        verbose=True
    )

    best_val_loss = float("inf")
    early_stop_counter = 0

    # -------------------------------------------------
    # Training Loop
    # -------------------------------------------------
    for epoch in range(EPOCHS):

        # ======================
        # TRAIN
        # ======================
        model.train()

        total_train_h = 0.0
        total_train_c = 0.0

        pbar = tqdm(train_loader, desc=f"Epoch [{epoch+1}/{EPOCHS}]")

        for batch in pbar:

            inputs = batch["input"].to(DEVICE)
            gt_delta_h = batch["delta_H"].to(DEVICE)
            gt_conf = batch["confidence_gt"].to(DEVICE)

            optimizer.zero_grad()

            pred_delta_h, _, _, pred_conf = model(inputs)

            # Losses
            h_loss = F.mse_loss(pred_delta_h, gt_delta_h)
            c_loss = F.binary_cross_entropy(pred_conf, gt_conf)

            loss = LAMBDA_H * h_loss + LAMBDA_CONF * c_loss

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            optimizer.step()

            total_train_h += h_loss.item()
            total_train_c += c_loss.item()

            pbar.set_postfix({
                "H": f"{h_loss.item():.4f}",
                "C": f"{c_loss.item():.4f}"
            })

        avg_train_h = total_train_h / len(train_loader)
        avg_train_c = total_train_c / len(train_loader)

        # ======================
        # VALIDATION
        # ======================
        model.eval()

        total_val_h = 0.0
        total_val_c = 0.0

        with torch.no_grad():
            for batch in val_loader:

                inputs = batch["input"].to(DEVICE)
                gt_delta_h = batch["delta_H"].to(DEVICE)
                gt_conf = batch["confidence_gt"].to(DEVICE)

                pred_delta_h, _, _, pred_conf = model(inputs)

                h_loss = F.mse_loss(pred_delta_h, gt_delta_h)
                c_loss = F.binary_cross_entropy(pred_conf, gt_conf)

                total_val_h += h_loss.item()
                total_val_c += c_loss.item()

        avg_val_h = total_val_h / len(val_loader)
        avg_val_c = total_val_c / len(val_loader)

        val_total = avg_val_h + LAMBDA_CONF * avg_val_c

        print(
            f"\nEpoch [{epoch+1}/{EPOCHS}] "
            f"| Train H: {avg_train_h:.4f} "
            f"| Train C: {avg_train_c:.4f} "
            f"| Val H: {avg_val_h:.4f} "
            f"| Val C: {avg_val_c:.4f}"
        )

        scheduler.step(val_total)

        # ======================
        # Early Stopping
        # ======================
        if val_total < best_val_loss:
            best_val_loss = val_total
            torch.save(model.state_dict(), "best_lgrw_residual_model.pth")
            print("💾 Best model saved.")
            early_stop_counter = 0
        else:
            early_stop_counter += 1
            print(f"⚠️ No improvement ({early_stop_counter}/{PATIENCE})")

        if early_stop_counter >= PATIENCE:
            print("🛑 Early stopping triggered.")
            break

    print("\n✅ Training Completed")
    print("Best model saved as: best_lgrw_residual_model.pth")


# -------------------------------------------------
# Entry
# -------------------------------------------------
if __name__ == "__main__":
    train()
