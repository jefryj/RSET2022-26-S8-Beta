from pathlib import Path

# -------------------------------------------------
# Dataset base path
# -------------------------------------------------
BASE_PATH = Path("datasets/face_glasses/train")

folders = {
    "foreground": BASE_PATH / "foreground",
    "background": BASE_PATH / "background",
    "mask": BASE_PATH / "foreground_mask_filled"
}

# -------------------------------------------------
# Utility: collect image IDs
# -------------------------------------------------
def get_ids(folder: Path):
    ids = set()
    for ext in ["jpg", "png", "jpeg"]:
        for f in folder.glob(f"*.{ext}"):
            ids.add(f.stem)
    return ids


# -------------------------------------------------
# Check dataset consistency
# -------------------------------------------------
id_sets = {}

for name, path in folders.items():
    if not path.exists():
        print(f"❌ Folder missing: {path}")
        id_sets[name] = set()
        continue

    id_sets[name] = get_ids(path)
    print(f"{name}: {len(id_sets[name])} files")

# Intersection of all IDs
common_ids = set.intersection(*id_sets.values())

print("\n✅ Valid samples (present in all folders):", len(common_ids))

# Report mismatches
for name, ids in id_sets.items():
    missing = common_ids.symmetric_difference(ids)
    if missing:
        print(f"\n❌ Mismatch in {name}: {len(missing)} samples")
        print("Sample IDs:", list(missing)[:10])
