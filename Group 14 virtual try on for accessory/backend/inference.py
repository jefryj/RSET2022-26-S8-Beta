import base64
import cv2
import numpy as np
import onnxruntime as ort



# -------------------------------------------------
# Load ONNX Model
# -------------------------------------------------
session = ort.InferenceSession(
    "residual_homography_fp16.onnx",
    providers=["CPUExecutionProvider"]
)

input_name = session.get_inputs()[0].name
output_names = [o.name for o in session.get_outputs()]

print("✅ Residual Homography ONNX model loaded")
print("Input:", input_name)
print("Outputs:", output_names)


# -------------------------------------------------
# Decode Base64 Image
# -------------------------------------------------
def decode_base64_image(base64_string: str):
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]

    img_bytes = base64.b64decode(base64_string)
    img_array = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_UNCHANGED)

    if img is None:
        raise ValueError("Invalid image data")

    # BGRA -> BGR
    if len(img.shape) == 3 and img.shape[2] == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

    # Gray -> BGR
    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    return img


# -------------------------------------------------
# Build binary mask from accessory image
# -------------------------------------------------
def build_mask(accessory_bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(accessory_bgr, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 5, 255, cv2.THRESH_BINARY)
    mask = mask.astype(np.float32) / 255.0
    return mask


# -------------------------------------------------
# Find square ROI around mask with margin
# -------------------------------------------------
def find_square_roi_from_mask(mask: np.ndarray, image_shape, margin: float = 0.35):
    """
    Returns x1, y1, x2, y2 square ROI.
    Falls back to center crop if mask is empty.
    """
    h, w = image_shape[:2]

    ys, xs = np.where(mask > 0.05)

    if len(xs) == 0 or len(ys) == 0:
        # fallback to center crop
        s = min(h, w)
        cx = w // 2
        cy = h // 2
        half = s // 2

        x1 = max(0, cx - half)
        y1 = max(0, cy - half)
        x2 = min(w, cx + half)
        y2 = min(h, cy + half)

        # re-square safely
        side = min(x2 - x1, y2 - y1)
        x2 = x1 + side
        y2 = y1 + side
        return x1, y1, x2, y2

    x_min = int(xs.min())
    x_max = int(xs.max())
    y_min = int(ys.min())
    y_max = int(ys.max())

    box_w = x_max - x_min + 1
    box_h = y_max - y_min + 1

    side = int(max(box_w, box_h) * (1.0 + margin))
    side = max(side, 32)

    cx = (x_min + x_max) // 2
    cy = (y_min + y_max) // 2
    half = side // 2

    x1 = cx - half
    y1 = cy - half
    x2 = x1 + side
    y2 = y1 + side

    # clamp to image
    if x1 < 0:
        x2 -= x1
        x1 = 0
    if y1 < 0:
        y2 -= y1
        y1 = 0
    if x2 > w:
        shift = x2 - w
        x1 -= shift
        x2 = w
    if y2 > h:
        shift = y2 - h
        y1 -= shift
        y2 = h

    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(w, x2)
    y2 = min(h, y2)

    # final square correction
    side = min(x2 - x1, y2 - y1)
    x2 = x1 + side
    y2 = y1 + side

    return x1, y1, x2, y2


# -------------------------------------------------
# Crop ROI using explicit box
# -------------------------------------------------
def crop_roi_with_box(img: np.ndarray, box, size: int = 224):
    x1, y1, x2, y2 = box
    roi = img[y1:y2, x1:x2]

    if roi.size == 0:
        raise ValueError("Empty ROI after cropping")

    roi = cv2.resize(roi, (size, size), interpolation=cv2.INTER_LINEAR)
    return roi


# -------------------------------------------------
# Legacy center crop fallback
# -------------------------------------------------
def crop_center_roi(img: np.ndarray, size: int = 224):
    h, w = img.shape[:2]

    cx = w // 2
    cy = h // 2
    s = min(h, w)

    x1 = max(0, cx - s // 2)
    y1 = max(0, cy - s // 2)
    x2 = min(w, x1 + s)
    y2 = min(h, y1 + s)

    roi = img[y1:y2, x1:x2]
    roi = cv2.resize(roi, (size, size), interpolation=cv2.INTER_LINEAR)
    return roi


# -------------------------------------------------
# Normalize and build 7-channel tensor
# -------------------------------------------------
def make_input_tensor(face_roi, acc_roi, mask_roi):
    face_roi = face_roi.astype(np.float32) / 255.0
    acc_roi = acc_roi.astype(np.float32) / 255.0
    mask_roi = mask_roi.astype(np.float32)

    input_tensor = np.concatenate(
        [
            face_roi,
            acc_roi,
            mask_roi[:, :, None]
        ],
        axis=2
    )

    # HWC -> CHW
    input_tensor = np.transpose(input_tensor, (2, 0, 1))
    input_tensor = np.expand_dims(input_tensor, axis=0).astype(np.float16)
    return input_tensor


# -------------------------------------------------
# Preprocessing
# -------------------------------------------------
def preprocess(
    face_b64: str,
    accessory_b64: str,
    accessory_is_prewarped: bool = False
):
    face_img = decode_base64_image(face_b64)
    acc_img = decode_base64_image(accessory_b64)

    # Ensure same canvas size if prewarped aligned frame is sent
    if accessory_is_prewarped:
        if face_img.shape[:2] != acc_img.shape[:2]:
            raise ValueError(
                f"Prewarped accessory frame size mismatch. "
                f"face={face_img.shape[:2]}, accessory={acc_img.shape[:2]}"
            )

        aligned_acc = acc_img
        aligned_mask = build_mask(aligned_acc)

        roi_box = find_square_roi_from_mask(
            aligned_mask,
            face_img.shape,
            margin=0.40
        )

        face_roi = crop_roi_with_box(face_img, roi_box, 224)
        acc_roi = crop_roi_with_box(aligned_acc, roi_box, 224)
        mask_roi = crop_roi_with_box(aligned_mask, roi_box, 224)

    else:
        # Legacy fallback mode:
        # raw accessory PNG is assumed, and placed with identity warp
        mask = build_mask(acc_img)

        H0 = np.eye(3, dtype=np.float32)

        aligned_acc = cv2.warpPerspective(
            acc_img,
            H0,
            (face_img.shape[1], face_img.shape[0])
        )

        aligned_mask = cv2.warpPerspective(
            mask,
            H0,
            (face_img.shape[1], face_img.shape[0])
        )

        face_roi = crop_center_roi(face_img, 224)
        acc_roi = crop_center_roi(aligned_acc, 224)
        mask_roi = crop_center_roi(aligned_mask, 224)

    input_tensor = make_input_tensor(face_roi, acc_roi, mask_roi)
    return input_tensor


# -------------------------------------------------
# Convert normalized offsets -> ROI pixel offsets
# -------------------------------------------------
def convert_offsets(offsets: np.ndarray):
    return offsets * 224.0


# -------------------------------------------------
# Inference
# -------------------------------------------------
def run_inference(
    face_b64: str,
    accessory_b64: str,
    accessory_is_prewarped: bool = False
    
):
    try:
        input_tensor = preprocess(
            face_b64=face_b64,
            accessory_b64=accessory_b64,
            accessory_is_prewarped=accessory_is_prewarped
            
        )

        outputs = session.run(
            output_names,
            {input_name: input_tensor}
        )

        offsets = outputs[0][0].astype(np.float32)
        pixel_offsets = convert_offsets(offsets)

        print("🔹 Predicted offsets:", pixel_offsets)
        print("🔹 accessory_is_prewarped:", accessory_is_prewarped)

        return pixel_offsets.tolist()

    except Exception as e:
        print("❌ Inference error:", str(e))
        raise e