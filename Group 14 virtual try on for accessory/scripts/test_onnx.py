import onnxruntime as ort
import numpy as np

# ----------------------------------------
# Load ONNX model
# ----------------------------------------
session = ort.InferenceSession("lgrw_residual_model.onnx")

# Print model info
print("Inputs:")
for inp in session.get_inputs():
    print(f"  {inp.name} → shape {inp.shape}")

print("\nOutputs:")
for out in session.get_outputs():
    print(f"  {out.name} → shape {out.shape}")

# ----------------------------------------
# Dummy input (6 channels now!)
# ----------------------------------------
dummy = np.random.randn(1, 6, 256, 256).astype(np.float32)

# ----------------------------------------
# Run inference
# ----------------------------------------
outputs = session.run(None, {"roi_input": dummy})

delta_h = outputs[0]
confidence = outputs[1]

print("\n--- ONNX Test Result ---")
print("delta_h shape:", delta_h.shape)
print("confidence shape:", confidence.shape)

print("\ndelta_h sample:", delta_h[0])
print("confidence sample:", confidence[0])
