
export interface FaceLandmarks {
  x: number;
  y: number;
  z: number;
}

export interface AccessoryItem {
  id: string;
  name: string;
  type: 'glasses' | 'hat' | 'earrings' | 'necklace' | 'mask';
  model: string;
  preview: string;
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
  color?: string;
  // Metadata for recommendation engine
  face_shapes?: string[];
  skin_tones?: string[];
  style_tags?: string[];
  trend_score?: number;
}

export interface StyleRecommendation {
  accessory: AccessoryItem;
  confidence: number;
  reason: string;
}

export interface CameraState {
  isActive: boolean;
  stream: MediaStream | null;
  error: string | null;
}

export interface FaceDetectionState {
  landmarks: FaceLandmarks[][];
  isDetected: boolean;
  faceCenter: [number, number, number];
  faceSize: number;
  faceRotation: [number, number, number];
  isModelLoading: boolean;
  detectedSkinTone?: string;
  detectedFaceShape?: string;
}
