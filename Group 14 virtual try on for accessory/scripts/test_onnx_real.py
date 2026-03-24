import onnxruntime as ort
import numpy as np
import torch

from data_loader import AccessoryDataset

# Load one real sample
dataset = AccessoryDataset("face_glasses", "test")
sample = dataset[0]

input_tensor = sample["input"][None, ...]  # Add batch dimension
input_tensor = input_tensor.astype(np.float32)

# Load ONNX
session = ort.InferenceSession("lgrw_residual_model.onnx")

outputs = session.run(None, {"roi_input": input_tensor})

delta_h = outputs[0]
confidence = outputs[1]

print("delta_h:", delta_h)
print("confidence:", confidence)
