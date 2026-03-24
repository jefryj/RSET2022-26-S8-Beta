# ============================================================
# RanSMAP / BitVisor ATA WRITE PREPROCESSING PIPELINE
# Generates LightGBM-ready features using:
# 20-second windows with 2-second stride
# ============================================================

import pandas as pd
import numpy as np
from tqdm import tqdm

# ================= CONFIG =================

RAW_CSV_PATH = "revilata.csv"   # Raw BitVisor file (NO headers)
OUT_FEATURES = "lightgbm_preprocessed.csv"

WINDOW_SIZE = 20   # seconds
STRIDE = 2         # seconds

# Convert to nanoseconds for precision
WINDOW_NS = WINDOW_SIZE * 1_000_000_000
STRIDE_NS = STRIDE * 1_000_000_000

# Raw schema
RAW_COLUMNS = [
    "time_s",
    "time_ns",
    "lba",
    "size",
    "entropy",
    "ignore"
]

# ============================================================
# STEP 1: LOAD RAW CSV
# ============================================================

print("\nSTEP 1: Loading raw telemetry...")

df = pd.read_csv(
    RAW_CSV_PATH,
    header=None,
    names=RAW_COLUMNS,
    low_memory=False
)

print("Raw rows:", len(df))


# ============================================================
# STEP 2: CLEAN DATA
# ============================================================

print("\nSTEP 2: Cleaning data...")

# Remove unused column
df = df.drop(columns=["ignore"], errors="ignore")

# Convert numeric safely
df["time_s"] = pd.to_numeric(df["time_s"], errors="coerce")
df["time_ns"] = pd.to_numeric(df["time_ns"], errors="coerce")
df["lba"] = pd.to_numeric(df["lba"], errors="coerce")
df["size"] = pd.to_numeric(df["size"], errors="coerce")
df["entropy"] = pd.to_numeric(df["entropy"], errors="coerce")

# Remove invalid rows
df = df.dropna()

# Remove invalid sizes
df = df[df["size"] > 0]

# Convert timestamp to nanoseconds
df["timestamp_ns"] = (
    df["time_s"].astype(np.int64) * 1_000_000_000 +
    df["time_ns"].astype(np.int64)
)

# Sort chronologically
df = df.sort_values("timestamp_ns").reset_index(drop=True)

print("Rows after cleaning:", len(df))


# ============================================================
# STEP 3: FEATURE EXTRACTION FUNCTION
# ============================================================

def extract_features(window):

    count = len(window)

    if count == 0:
        return None

    size = window["size"]
    entropy = window["entropy"]
    lba = window["lba"]

    size_std = size.std(ddof=0) if count > 1 else 0.0
    entropy_std = entropy.std(ddof=0) if count > 1 else 0.0

    entropy_vals = entropy.values

    spike_entropy_count = 0
    if len(entropy_vals) > 1:
        spike_entropy_count = np.sum(
            (entropy_vals[:-1] < 0.5) &
            (entropy_vals[1:] >= 0.9)
        )

    features = {

        "count": count,

        "size_mean": size.mean(),

        "size_std": size_std,

        "entropy_mean": entropy.mean(),

        "entropy_std": entropy_std,

        "entropy_median": entropy.median(),

        "unique_lba_count": lba.nunique(),

        "zero_entropy_frac":
        (entropy == 0).sum() / count,

        "high_entropy_frac":
        (entropy >= 0.9).sum() / count,

        "spike_entropy_count":
        spike_entropy_count
    }

    return features


# ============================================================
# STEP 4: CREATE SLIDING WINDOWS (CORRECT IMPLEMENTATION)
# ============================================================

print("\nSTEP 3: Creating sliding windows...")

features_list = []

start_time = df["timestamp_ns"].min()
end_time = df["timestamp_ns"].max()

current_start = start_time

total_windows = int((end_time - start_time) / STRIDE_NS)

for _ in tqdm(range(total_windows)):

    window_end = current_start + WINDOW_NS

    window_df = df[
        (df["timestamp_ns"] >= current_start) &
        (df["timestamp_ns"] < window_end)
    ]

    features = extract_features(window_df)

    if features is not None:
        features_list.append(features)

    current_start += STRIDE_NS


# ============================================================
# STEP 5: CREATE FINAL DATAFRAME
# ============================================================

print("\nSTEP 4: Creating final feature dataframe...")

features_df = pd.DataFrame(features_list)

# Fill NaN safely
features_df = features_df.fillna(0)

print("Total windows created:", len(features_df))


# ============================================================
# STEP 6: SAVE LIGHTGBM INPUT FILE
# ============================================================

features_df.to_csv(
    OUT_FEATURES,
    index=False
)

print("\nSTEP 5: Saved LightGBM-ready features")
print("File:", OUT_FEATURES)
print("Shape:", features_df.shape)

print("\nPreview:")
print(features_df.head())
