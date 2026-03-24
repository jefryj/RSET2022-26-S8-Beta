import torch
from model import ResidualHomographyNet

# model checkpoint
MODEL_PATH = "residual_homography_all.pth"

# ONNX output
ONNX_PATH = "residual_homography.onnx"

device = torch.device("cpu")

# load model
model = ResidualHomographyNet().to(device)
model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.eval()

# dummy input (same shape as training)
dummy_input = torch.randn(1, 7, 224, 224)

# export
torch.onnx.export(
    model,
    dummy_input,
    ONNX_PATH,
    input_names=["input"],
    output_names=["offsets"],
    opset_version=11,
    dynamic_axes={
        "input": {0: "batch_size"},
        "offsets": {0: "batch_size"}
    }
)

print("ONNX model exported to:", ONNX_PATH)