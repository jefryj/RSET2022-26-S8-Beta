import onnxruntime as ort
import numpy as np

session = ort.InferenceSession("residual_homography.onnx")

# dummy input
input_data = np.random.randn(1,7,224,224).astype(np.float32)

outputs = session.run(None, {"input": input_data})

print("Model output:")
print(outputs)