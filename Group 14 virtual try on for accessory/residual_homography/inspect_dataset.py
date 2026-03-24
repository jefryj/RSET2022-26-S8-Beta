import os

DATASET_ROOT = "../datasets/face_glasses/train"

def inspect_folder(path, name):
    print(f"\n{name}:")
    if not os.path.exists(path):
        print("  ❌ Not found")
        return

    files = sorted(os.listdir(path))

    print("  total files:", len(files))
    print("  first 10 files:")

    for f in files[:10]:
        print("   ", f)


def main():

    folders = [
        "background",
        "background_mask",
        "background_mask_crop",
        "composite",
        "foreground",
        "foreground_mask",
        "foreground_mask_filled"
    ]

    print("\n=== DATASET STRUCTURE ===")

    for folder in folders:
        path = os.path.join(DATASET_ROOT, folder)
        inspect_folder(path, folder)


if __name__ == "__main__":
    main()