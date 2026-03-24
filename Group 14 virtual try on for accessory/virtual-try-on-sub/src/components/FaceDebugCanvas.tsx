import React, { useRef, useEffect } from "react";
// @ts-ignore
import * as faceMeshPkg from "@mediapipe/face_mesh";
// @ts-ignore
import * as cameraUtilsPkg from "@mediapipe/camera_utils";
// @ts-ignore
import * as drawingUtilsPkg from "@mediapipe/drawing_utils";

// Handle inconsistent exports
const FaceMesh = (faceMeshPkg as any).FaceMesh || (faceMeshPkg as any).default?.FaceMesh || (faceMeshPkg as any).default;
const FACEMESH_TESSELATION = (faceMeshPkg as any).FACEMESH_TESSELATION || (faceMeshPkg as any).default?.FACEMESH_TESSELATION;
const Camera = (cameraUtilsPkg as any).Camera || (cameraUtilsPkg as any).default?.Camera;
const drawConnectors = (drawingUtilsPkg as any).drawConnectors || (drawingUtilsPkg as any).default?.drawConnectors;
const drawLandmarks = (drawingUtilsPkg as any).drawLandmarks || (drawingUtilsPkg as any).default?.drawLandmarks;

const FaceDebugCanvas: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    let faceMesh: any = null;
    
    if (FaceMesh) {
         try {
             // Handle case where FaceMesh is directly the default export or a named export
             const FaceMeshClass = FaceMesh.prototype ? FaceMesh : ((faceMeshPkg as any).default?.FaceMesh || (faceMeshPkg as any).default);
             faceMesh = new FaceMeshClass({
                locateFile: (file: string) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
            });
         } catch(e) {
             console.error("FaceDebugCanvas: Error initializing FaceMesh", e);
             return;
         }
    } else {
        return;
    }

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results: any) => {
      const canvasCtx = canvasRef.current?.getContext("2d");
      if (!canvasCtx) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasRef.current!.width,
        canvasRef.current!.height
      );

      if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
          if (drawConnectors && FACEMESH_TESSELATION) {
            drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {
                color: "#00FF00",
                lineWidth: 0.5,
            });
          }
          if (drawLandmarks) {
            drawLandmarks(canvasCtx, landmarks, {
                color: "#FF0000",
                lineWidth: 1,
            });
          }
        }
      }
      canvasCtx.restore();
    });

    let camera: any = null;
    if (Camera) {
        camera = new Camera(videoRef.current, {
        onFrame: async () => {
            await faceMesh.send({ image: videoRef.current! });
        },
        width: 640,
        height: 480,
        });

        camera.start();
    }

    return () => {
      if (camera) camera.stop();
      if (faceMesh) faceMesh.close();
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <video ref={videoRef} style={{ display: "none" }} />
      <canvas ref={canvasRef} width={640} height={480} />
      <p className="text-white mt-2">🟢 Face landmarks are being detected</p>
    </div>
  );
};

export default FaceDebugCanvas;
