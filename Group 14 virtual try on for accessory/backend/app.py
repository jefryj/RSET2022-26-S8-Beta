from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse

from inference import run_inference


app = FastAPI(title="Residual Homography Correction API")


# -------------------------------------------------
# CORS (Allow React Dev Server)
# -------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------
# Request Model
# -------------------------------------------------
class InferenceRequest(BaseModel):
    face_image: str = Field(
        ...,
        description="Base64 encoded face image"
    )

    accessory_image: str = Field(
        ...,
        description="Base64 encoded accessory image"
    )

    accessory_is_prewarped: bool = Field(
        default=False,
        description="True if accessory_image is already rendered/aligned on the same canvas as face_image"
    )


# -------------------------------------------------
# Root Endpoint
# -------------------------------------------------
@app.get("/")
def root():
    return {
        "message": "Residual Homography API running",
        "docs": "/docs"
    }


# -------------------------------------------------
# Health Check
# -------------------------------------------------
@app.get("/health")
def health_check():
    return {
        "status": "running",
        "model": "ResidualHomographyNet"
    }


# -------------------------------------------------
# Predict Correction Route
# -------------------------------------------------
@app.post("/predict-correction")
async def predict_correction(req: InferenceRequest):
    if not req.face_image or not req.accessory_image:
        raise HTTPException(
            status_code=400,
            detail="Missing image data"
        )

    print("REQUEST accessory_is_prewarped =", req.accessory_is_prewarped)

    try:
        offsets = run_inference(
            face_b64=req.face_image,
            accessory_b64=req.accessory_image,
            accessory_is_prewarped=req.accessory_is_prewarped
        )

        offsets = [float(round(o, 6)) for o in offsets]

        return {
            "status": "success",
            "corner_offsets": offsets,
            "accessory_is_prewarped": req.accessory_is_prewarped
        }

    except Exception as e:
        print("❌ Backend error:", str(e))

        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": str(e)
            }
        )