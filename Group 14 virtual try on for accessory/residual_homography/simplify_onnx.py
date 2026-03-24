import onnx
from onnxsim import simplify

model_path = "residual_homography.onnx"
output_path = "residual_homography_simplified.onnx"

model = onnx.load(model_path)

model_simp, check = simplify(model)

if check:
    onnx.save(model_simp, output_path)
    print("Simplified ONNX model saved as:", output_path)
else:
    print("Simplification failed")