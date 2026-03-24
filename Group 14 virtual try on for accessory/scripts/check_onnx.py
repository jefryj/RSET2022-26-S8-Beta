import onnx

# -------------------------------------------------
# Path to the exported ONNX model
# -------------------------------------------------
MODEL_PATH = "lgrw_residual_model.onnx"

try:
    # -------------------------------------------------
    # 1. Load the ONNX model
    # -------------------------------------------------
    model = onnx.load(MODEL_PATH)

    # -------------------------------------------------
    # 2. Structural integrity check
    # -------------------------------------------------
    onnx.checker.check_model(model)
    print(f"✅ ONNX model '{MODEL_PATH}' is structurally valid.\n")

    # -------------------------------------------------
    # 3. Model metadata
    # -------------------------------------------------
    print(f"IR Version       : {model.ir_version}")
    print(f"Producer         : {model.producer_name} (v{model.producer_version})\n")

    # -------------------------------------------------
    # 4. Input inspection
    # -------------------------------------------------
    print("📋 Model Inputs:")
    for inp in model.graph.input:
        dims = [
            d.dim_value if d.dim_value != 0 else "batch_size"
            for d in inp.type.tensor_type.shape.dim
        ]
        print(f"  - {inp.name}: shape={dims}  (6-channel ROI input: face+accessory)")

    # -------------------------------------------------
    # 5. Output inspection
    # -------------------------------------------------
    print("\n📋 Model Outputs:")
    for out in model.graph.output:
        dims = [
            d.dim_value if d.dim_value != 0 else "batch_size"
            for d in out.type.tensor_type.shape.dim
        ]

        name = out.name.lower()

        if name == "delta_h":
            label = "(Residual affine homography parameters, 6-D)"
        elif name == "confidence":
            label = "(Alignment confidence 0–1)"
        else:
            label = ""

        print(f"  - {out.name}: shape={dims} {label}")

    print("\n✅ Model structure verified successfully.")

except Exception as e:
    print(f"❌ Error checking ONNX model: {e}")
