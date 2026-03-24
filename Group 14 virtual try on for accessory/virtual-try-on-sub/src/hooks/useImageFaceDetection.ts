
import { useState, useEffect } from "react";
import { FaceDetectionState, FaceLandmarks } from "../types";
import { detectSkinToneFromMedia } from "../utils/skinDetection";
import { detectFaceShape } from "../utils/faceShapeDetection";
// @ts-ignore
import * as faceMeshPkg from "@mediapipe/face_mesh";

const resolveModule = (pkg: any, name: string) => {
  return pkg[name] || pkg.default?.[name] || pkg.default || pkg;
};

export const useImageFaceDetection = (imageUrl: string | null) => {
  const [faceState, setFaceState] = useState<FaceDetectionState>({
    landmarks: [],
    isDetected: false,
    faceCenter: [0.5, 0.5, 0],
    faceSize: 1,
    faceRotation: [0, 0, 0],
    isModelLoading: false,
  });

  useEffect(() => {
    if (!imageUrl) {
      setFaceState((prev) => ({ ...prev, isDetected: false, isModelLoading: false }));
      return;
    }

    let faceMesh: any = null;
    let isMounted = true;

    const processImage = async () => {
      setFaceState(prev => ({ ...prev, isModelLoading: true }));
      const FaceMeshClass = resolveModule(faceMeshPkg, 'FaceMesh');
      if (!FaceMeshClass) {
          if (isMounted) setFaceState(prev => ({ ...prev, isModelLoading: false }));
          return;
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;

      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
      } catch (e) {
        if (isMounted) setFaceState(prev => ({ ...prev, isModelLoading: false }));
        return;
      }

      if (!isMounted) return;

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
            setFaceState((prev) => ({ ...prev, isDetected: false, isModelLoading: false }));
            return;
          }

          const landmarks = results.multiFaceLandmarks[0] as FaceLandmarks[];
          const leftCheek = landmarks[234];
          const skinTone = detectSkinToneFromMedia(img, leftCheek.x, leftCheek.y, false);
          // Use actual image dimensions
          const faceShape = detectFaceShape(landmarks, img.naturalWidth, img.naturalHeight);

          const noseTip = landmarks[1];
          const leftEye = landmarks[33];
          const rightEye = landmarks[263];
          const eyeDistance = Math.sqrt(
            Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
          );
          const faceSize = eyeDistance * 3;
          const angleY = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

          setFaceState({
            landmarks: [landmarks],
            isDetected: true,
            faceCenter: [noseTip.x, noseTip.y, noseTip.z],
            faceSize,
            faceRotation: [0, angleY, 0],
            isModelLoading: false,
            detectedSkinTone: skinTone,
            detectedFaceShape: faceShape
          });
        });

        if (isMounted && faceMesh) {
           await faceMesh.send({ image: img });
        }
      } catch (error) {
        if (isMounted) setFaceState(prev => ({ ...prev, isModelLoading: false }));
      }
    };

    processImage();

    return () => {
      isMounted = false;
      if (faceMesh) try { faceMesh.close(); } catch(e) {}
    };
  }, [imageUrl]);

  return faceState;
};
