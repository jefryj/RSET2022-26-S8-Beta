import onnx
from onnxconverter_common import float16

model = onnx.load("residual_homography_simplified.onnx")

model_fp16 = float16.convert_float_to_float16(model)

onnx.save(model_fp16, "residual_homography_fp16.onnx")

print("FP16 model saved")