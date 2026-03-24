import { FaceLandmarks } from '../types';

export type FaceShape = 'oval' | 'round' | 'square' | 'heart' | 'oblong' | 'diamond';

/**
 * Calculates distance with dynamic aspect ratio correction.
 * Normalized coordinates (0-1) are mapped back to a uniform space.
 */
const getDist = (p1: FaceLandmarks, p2: FaceLandmarks, aspect: number) => {
  const dx = (p2.x - p1.x) * aspect;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculates the angle between three points in degrees with aspect correction.
 */
const getAngle = (p1: FaceLandmarks, p2: FaceLandmarks, p3: FaceLandmarks, aspect: number) => {
  const a = { x: (p1.x - p2.x) * aspect, y: p1.y - p2.y };
  const b = { x: (p3.x - p2.x) * aspect, y: p3.y - p2.y };
  
  const angle = Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
  let degree = Math.abs(angle * (180 / Math.PI));
  if (degree > 180) degree = 360 - degree;
  return degree;
};

export const detectFaceShape = (
  landmarks: FaceLandmarks[], 
  viewWidth: number = 1280, 
  viewHeight: number = 720
): FaceShape => {
  if (!landmarks || landmarks.length < 468) return 'oval';

  // Dynamic Aspect Ratio
  const aspect = viewWidth / viewHeight;

  // 1. Face Height (Baseline for normalization)
  const faceHeight = getDist(landmarks[10], landmarks[152], aspect);
  if (faceHeight === 0) return 'oval';

  // HELPER: Normalize width relative to height
  const normWidth = (p1Idx: number, p2Idx: number) => 
    getDist(landmarks[p1Idx], landmarks[p2Idx], aspect) / faceHeight;

  // 2. Face Width (Total span)
  const faceWidthNorm = normWidth(234, 454);

  // 3. Forehead Width
  const foreheadWidthNorm = normWidth(103, 332);

  // 4. Jaw Width
  const jawWidthNorm = normWidth(172, 397);

  // 5. Cheekbone Width
  const cheekboneWidthNorm = normWidth(234, 454);

  // 6. Chin Angle (Pointiness)
  const chinAngle = getAngle(landmarks[150], landmarks[152], landmarks[379], aspect);

  // 7. Jaw Angle (Angularity)
  const leftJawAngle = getAngle(landmarks[132], landmarks[172], landmarks[152], aspect);
  const rightJawAngle = getAngle(landmarks[361], landmarks[397], landmarks[152], aspect);
  const avgJawAngle = (leftJawAngle + rightJawAngle) / 2;

  // 8. Width at Mid-Face
  const midFaceWidthNorm = normWidth(116, 345);

  // --- Classification Logic ---
  
  // Height to Width Ratio (Inverse of norm width)
  const hwRatio = 1 / faceWidthNorm;

  // OBLONG: Significantly longer than wide (Thin, long face)
  if (hwRatio > 1.6) {
    return 'oblong';
  }

  // HEART: Broad forehead, narrow jaw, sharp chin
  if (foreheadWidthNorm > jawWidthNorm * 1.25 && chinAngle < 135) {
    return 'heart';
  }

  // DIAMOND: Cheekbones wider than forehead and jaw
  if (cheekboneWidthNorm > foreheadWidthNorm * 1.1 && cheekboneWidthNorm > jawWidthNorm * 1.1) {
    return 'diamond';
  }

  // SQUARE vs ROUND vs OVAL (The "Short" to "Medium" faces)
  if (hwRatio < 1.35) {
    // Sharp jaw angles or broad jaw indicate squareness
    if (avgJawAngle < 145 || jawWidthNorm > foreheadWidthNorm * 0.95) {
      return 'square';
    }
    return 'round';
  }

  // Default / OVAL (Proportional, balanced)
  if (hwRatio >= 1.35 && hwRatio <= 1.6) {
      // Check if it's a soft square (wide jaw on a medium face)
      if (jawWidthNorm > foreheadWidthNorm * 0.9 && avgJawAngle < 155) {
          return 'square';
      }
      return 'oval';
  }

  return 'oval';
};