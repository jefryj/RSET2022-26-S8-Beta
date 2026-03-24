import torch
from torch.utils.data import DataLoader, random_split
import torch.nn as nn
import torch.optim as optim
from tqdm import tqdm

from data_loader import ResidualHomographyDataset
from model import ResidualHomographyNet


import argparse

# default constants
DATASET_PATH = "../datasets"

BATCH_SIZE = 16
EPOCHS = 30
LR = 5e-5

MODEL_SAVE_PATH = "residual_homography.pth"


def main():
    parser = argparse.ArgumentParser(description="Train residual homography network")
    parser.add_argument("--dataset", default=DATASET_PATH, help="root of dataset")
    parser.add_argument("--accessory", choices=["glasses","hat","all"], default="all",
                        help="which accessory type to include in training")
    parser.add_argument("--batch", type=int, default=BATCH_SIZE, help="batch size")
    parser.add_argument("--epochs", type=int, default=EPOCHS, help="number of epochs")
    parser.add_argument("--lr", type=float, default=LR, help="learning rate")
    parser.add_argument("--balance", action="store_true",
                        help="when using --accessory all, balance hats and glasses via sampler")
    args = parser.parse_args()


    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Using device:", device)

    # adjust model save path to include accessory type
    global MODEL_SAVE_PATH
    MODEL_SAVE_PATH = f"residual_homography_{args.accessory}.pth"

    # -----------------------------
    # Load dataset (can load glasses, hats or both)
    # -----------------------------
    dataset = ResidualHomographyDataset(
        dataset_root=args.dataset,
        split="train",
        accessory_type=args.accessory  # will be 'glasses', 'hat' or 'all'
    )

    print("Total dataset size:", len(dataset))
    # print breakdown by accessory type if we loaded both
    if args.accessory == "all":
        types = [s["type"] for s in dataset.samples]
        glasses_count = types.count("glasses")
        hat_count = types.count("hat")
        print(f"  glasses samples: {glasses_count}, hat samples: {hat_count}")


    # -----------------------------
    # Train / validation split
    # -----------------------------
    train_size = int(0.9 * len(dataset))
    val_size = len(dataset) - train_size

    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])

    print("Train samples:", len(train_dataset))
    print("Validation samples:", len(val_dataset))


    # optionally balance hats/glasses if both types present
    sampler = None
    if args.accessory == "all" and args.balance:
        # compute weights inversely proportional to class frequency
        sample_types = [dataset.samples[i]["type"] for i in train_dataset.indices]
        counts = {"glasses": sample_types.count("glasses"), "hat": sample_types.count("hat")}
        weights = [1.0 / counts[t] for t in sample_types]
        sampler = torch.utils.data.WeightedRandomSampler(weights, num_samples=len(weights), replacement=True)
        shuffle_flag = False
    else:
        shuffle_flag = True

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch,
        shuffle=shuffle_flag,
        sampler=sampler,
        num_workers=4,
        pin_memory=True
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch,
        shuffle=False,
        num_workers=4
    )


    # -----------------------------
    # Model
    # -----------------------------
    model = ResidualHomographyNet().to(device)

    criterion = nn.SmoothL1Loss()

    optimizer = optim.Adam(
        model.parameters(),
        lr=args.lr
    )

    # learning rate scheduler
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="min",
        factor=0.5,
        patience=5
    )

    best_val_loss = float("inf")


    # -----------------------------
    # Training loop
    # -----------------------------
    for epoch in range(args.epochs):

        model.train()

        train_loss = 0

        progress = tqdm(train_loader)

        for inputs, targets in progress:

            inputs = inputs.to(device)
            targets = targets.to(device)

            preds = model(inputs)

            loss = criterion(preds, targets)

            optimizer.zero_grad()

            loss.backward()

            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)

            optimizer.step()

            train_loss += loss.item()

            progress.set_description(
                f"Epoch {epoch+1}/{args.epochs} | Loss {loss.item():.4f}"
            )

        train_loss /= len(train_loader)

        print(f"\nEpoch {epoch+1} Train Loss: {train_loss:.6f}")


        # -----------------------------
        # Validation
        # -----------------------------
        model.eval()

        val_loss = 0

        with torch.no_grad():

            for inputs, targets in val_loader:

                inputs = inputs.to(device)
                targets = targets.to(device)

                preds = model(inputs)

                loss = criterion(preds, targets)

                val_loss += loss.item()

        val_loss /= len(val_loader)

        print(f"Epoch {epoch+1} Validation Loss: {val_loss:.6f}")


        # Update scheduler
        scheduler.step(val_loss)


        # Save best model
        if val_loss < best_val_loss:

            best_val_loss = val_loss

            torch.save(model.state_dict(), MODEL_SAVE_PATH)

            print("Saved new best model")


    print("\nTraining complete.")
    print("Best model saved to:", MODEL_SAVE_PATH)


if __name__ == "__main__":
    main()