import torch
from model import LGRWResidual3DNet

# -------------------------------------------------
# Paths
# -------------------------------------------------
MODEL_PATH = "best_lgrw_residual_model.pth"
ONNX_PATH  = "lgrw_residual_model.onnx"

# -------------------------------------------------
# Load model (6 CHANNELS!)
# -------------------------------------------------
model = LGRWResidual3DNet(in_channels=6)
model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
model.eval()

# -------------------------------------------------
# Dummy input (must match training input shape)
# -------------------------------------------------
dummy_input = torch.randn(1, 6, 256, 256)

print(f"Exporting {MODEL_PATH} → {ONNX_PATH} ...")

# -------------------------------------------------
# Export
# -------------------------------------------------
torch.onnx.export(
    model,
    dummy_input,
    ONNX_PATH,
    export_params=True,
    opset_version=12,
    do_constant_folding=True,

    input_names=["roi_input"],
    output_names=[
        "delta_h",
        "confidence"
    ],

    dynamic_axes={
        "roi_input": {0: "batch_size"},
        "delta_h": {0: "batch_size"},
        "confidence": {0: "batch_size"}
    }
)

print(f"✅ Model successfully exported to {ONNX_PATH}")
