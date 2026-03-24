import onnx

model = onnx.load("residual_homography.onnx")
onnx.checker.check_model(model)

print("ONNX model is valid ✅")