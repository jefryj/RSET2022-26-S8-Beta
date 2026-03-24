import { useState, useEffect, useRef } from 'react';
import { CameraState } from '../types';

export const useCamera = () => {
  const [cameraState, setCameraState] = useState<CameraState>({
    isActive: false,
    stream: null,
    error: null
  });
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // The play() method returns a promise that can be rejected if interrupted
        try {
          await videoRef.current.play();
        } catch (playError: any) {
          // Playback might be interrupted by a pause or new load, which is often safe to ignore
          if (playError.name !== 'AbortError') {
            console.error('Video playback failed:', playError);
          }
        }
      }

      setCameraState({
        isActive: true,
        stream,
        error: null
      });
    } catch (error) {
      setCameraState({
        isActive: false,
        stream: null,
        error: 'Failed to access camera. Please check permissions.'
      });
    }
  };

  const stopCamera = () => {
    if (cameraState.stream) {
      cameraState.stream.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState({
      isActive: false,
      stream: null,
      error: null
    });
  };

  useEffect(() => {
    return () => {
      if (cameraState.stream) {
        cameraState.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraState.stream]);

  return {
    ...cameraState,
    videoRef,
    startCamera,
    stopCamera
  };
};