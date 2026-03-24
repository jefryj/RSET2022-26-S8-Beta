
import { useState, useEffect } from "react";
import { FaceDetectionState, FaceLandmarks } from "../types";
import { detectSkinToneFromMedia } from "../utils/skinDetection";
import { detectFaceShape } from "../utils/faceShapeDetection";
// @ts-ignore
import * as faceMeshPkg from "@mediapipe/face_mesh";
// @ts-ignore
import * as cameraUtilsPkg from "@mediapipe/camera_utils";

const resolveModule = (pkg: any, name: string) => {
  return pkg[name] || pkg.default?.[name] || pkg.default || pkg;
};

export const useFaceDetection = (videoElement: HTMLVideoElement | null) => {
  const [faceState, setFaceState] = useState<FaceDetectionState>({
    landmarks: [],
    isDetected: false,
    faceCenter: [0.5, 0.5, 0],
    faceSize: 1,
    faceRotation: [0, 0, 0],
    isModelLoading: false,
  });

  useEffect(() => {
    if (!videoElement) {
       setFaceState(prev => ({ ...prev, isModelLoading: false }));
       return;
    }

    let camera: any = null;
    let faceMesh: any = null;
    let isMounted = true;
    let frameCount = 0;

    const initializeFaceDetection = async () => {
      setFaceState(prev => ({ ...prev, isModelLoading: true }));

      const FaceMeshClass = resolveModule(faceMeshPkg, 'FaceMesh');
      const CameraClass = resolveModule(cameraUtilsPkg, 'Camera');

      if (!FaceMeshClass) {
        if (isMounted) setFaceState(prev => ({ ...prev, isModelLoading: false }));
        return;
      }

      try {
        faceMesh = new FaceMeshClass({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results: any) => {
          if (!isMounted) return;

          if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            setFaceState((prev) => ({ 
                ...prev, 
                isDetected: false, 
                isModelLoading: false 
            }));
            return;
          }

          const landmarks = results.multiFaceLandmarks[0] as FaceLandmarks[];
          const noseTip = landmarks[1];
          const leftEye = landmarks[33];
          const rightEye = landmarks[263];
          const leftCheek = landmarks[234];

          let skinTone: string | undefined;
          let faceShape: string | undefined;
          
          if (frameCount % 30 === 0) {
             skinTone = detectSkinToneFromMedia(videoElement, leftCheek.x, leftCheek.y, true);
             // Pass actual video dimensions for dynamic aspect ratio
             faceShape = detectFaceShape(landmarks, videoElement.videoWidth, videoElement.videoHeight);
          }
          frameCount++;

          const faceCenter: [number, number, number] = [noseTip.x, noseTip.y, noseTip.z];
          const eyeDistance = Math.sqrt(
            Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
          );
          const faceSize = eyeDistance * 3;
          const angleY = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

          setFaceState(prev => ({
            landmarks: [landmarks],
            isDetected: true,
            faceCenter,
            faceSize,
            faceRotation: [0, angleY, 0],
            isModelLoading: false,
            detectedSkinTone: skinTone || prev.detectedSkinTone,
            detectedFaceShape: faceShape || prev.detectedFaceShape
          }));
        });

        if (CameraClass) {
            camera = new CameraClass(videoElement, {
                onFrame: async () => {
                    if (isMounted && faceMesh) {
                      try {
                        await faceMesh.send({ image: videoElement });
                      } catch (err) {}
                    }
                },
                width: 1280,
                height: 720,
            });
            await camera.start();
        }
      } catch (error) {
        if (isMounted) setFaceState(prev => ({ ...prev, isModelLoading: false }));
      }
    };

    initializeFaceDetection();

    return () => {
      isMounted = false;
      if (camera) camera.stop().catch(() => {});
      if (faceMesh) try { faceMesh.close(); } catch (e) {}
    };
  }, [videoElement]);

  return faceState;
};
