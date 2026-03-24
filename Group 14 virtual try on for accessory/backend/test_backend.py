import requests
import base64
import cv2
import numpy as np

# -------------------------------------------------
# Backend endpoint
# -------------------------------------------------
URL = "http://127.0.0.1:8000/predict-correction"

FACE_IMAGE_PATH = "test_face.jpg"
RAW_ACCESSORY_PATH = "test_accessory.jpg"


# -------------------------------------------------
# Encode image to base64
# -------------------------------------------------
def encode_image_from_array(img):

    _, buffer = cv2.imencode(".jpg", img)
    return base64.b64encode(buffer).decode("utf-8")


# -------------------------------------------------
# Load images
# -------------------------------------------------
face_img = cv2.imread(FACE_IMAGE_PATH)
acc_img = cv2.imread(RAW_ACCESSORY_PATH)

if face_img is None or acc_img is None:
    raise ValueError("❌ Could not load test images")

h_face, w_face = face_img.shape[:2]


# -------------------------------------------------
# Simulate initial homography
# -------------------------------------------------
scale = 0.6
tx = int(w_face * 0.2)
ty = int(h_face * 0.35)

H_initial = np.array([
    [scale, 0, tx],
    [0, scale, ty],
    [0, 0, 1]
], dtype=np.float32)


# -------------------------------------------------
# Warp accessory using H_initial
# -------------------------------------------------
warped_accessory = cv2.warpPerspective(
    acc_img,
    H_initial,
    (w_face, h_face)
)


# -------------------------------------------------
# Convert images to base64
# -------------------------------------------------
face_base64 = encode_image_from_array(face_img)
accessory_base64 = encode_image_from_array(warped_accessory)

payload = {
    "face_image": face_base64,
    "accessory_image": accessory_base64
}


# -------------------------------------------------
# Send request
# -------------------------------------------------
response = requests.post(URL, json=payload)

print("Status Code:", response.status_code)

data = response.json()
print("\nResponse JSON:")
print(data)

offsets = np.array(data["corner_offsets"]).reshape(4, 2)


# -------------------------------------------------
# Get accessory corners BEFORE correction
# -------------------------------------------------
h_acc, w_acc = acc_img.shape[:2]

src_pts = np.array([
    [0, 0],
    [w_acc, 0],
    [w_acc, h_acc],
    [0, h_acc]
], dtype=np.float32)

# transform corners using initial homography
dst_pts_initial = cv2.perspectiveTransform(
    src_pts.reshape(-1,1,2),
    H_initial
).reshape(-1,2)


# -------------------------------------------------
# Apply predicted offsets
# -------------------------------------------------
dst_pts_corrected = dst_pts_initial + offsets


# -------------------------------------------------
# Compute corrected homography
# -------------------------------------------------
H_corrected = cv2.getPerspectiveTransform(
    src_pts.astype(np.float32),
    dst_pts_corrected.astype(np.float32)
)


# -------------------------------------------------
# Warp accessory using corrected homography
# -------------------------------------------------
corrected_accessory = cv2.warpPerspective(
    acc_img,
    H_corrected,
    (w_face, h_face)
)


# -------------------------------------------------
# Overlay result
# -------------------------------------------------
result = face_img.copy()

mask = corrected_accessory > 0
result[mask] = corrected_accessory[mask]


# -------------------------------------------------
# Save result image
# -------------------------------------------------
cv2.imwrite("alignment_result.jpg", result)

print("\n✅ Result saved as alignment_result.jpg")