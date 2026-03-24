import onnxruntime as ort
import numpy as np

so = ort.SessionOptions()

# enable full optimization
so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

session = ort.InferenceSession(
    "residual_homography_simplified.onnx",
    sess_options=so,
    providers=["CPUExecutionProvider"]
)

input_data = np.random.randn(1,7,224,224).astype(np.float32)

outputs = session.run(None, {"input": input_data})

print("Output:", outputs)