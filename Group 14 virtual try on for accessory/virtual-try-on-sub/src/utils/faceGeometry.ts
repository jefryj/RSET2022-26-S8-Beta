import { AccessoryItem, FaceLandmarks } from "../types";

export interface AccessoryTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  width: number;
  height: number;
}

const Z_LAYERS: Record<AccessoryItem["type"], number> = {
  hat: 8,
  glasses: 6,
  earrings: 4,
  necklace: 2,
  mask: 5,
};

const ANCHORS = {
  glasses: { left: 33, right: 263, center: 168 },
  hat: { left: 21, right: 251, top: 10 },
  earrings: { left: 234, right: 454 },
};

const calculateUprightRotation = (
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  if (dx < 0) return Math.atan2(-dy, -dx);
  return Math.atan2(dy, dx);
};

const isValidCornerOffsets = (
  cornerOffsets?: number[] | null
): cornerOffsets is number[] => {
  return (
    Array.isArray(cornerOffsets) &&
    cornerOffsets.length === 8 &&
    cornerOffsets.every((v) => typeof v === "number" && Number.isFinite(v))
  );
};

const getLandmarkAccessors = (
  landmarks: FaceLandmarks[],
  isImageMode: boolean
) => {
  const getX = (idx: number) => {
    const val = landmarks[idx]?.x ?? 0;
    return isImageMode ? val : 1 - val;
  };

  const getY = (idx: number) => landmarks[idx]?.y ?? 0;

  const getPoint = (idx: number) => ({
    x: getX(idx),
    y: getY(idx),
  });

  return { getX, getY, getPoint };
};

export const wrapAccessory = (
  accessory: AccessoryItem,
  landmarks: FaceLandmarks[],
  isImageMode: boolean = false,
  cornerOffsets?: number[] | null
): AccessoryTransform | null => {
  if (!landmarks || landmarks.length === 0) return null;

  const { getPoint } = getLandmarkAccessors(landmarks, isImageMode);

  let centerX = 0.5;
  let centerY = 0.5;
  let rotation = 0;
  let referenceWidth = 0;
  let baseScale = 1;

  switch (accessory.type) {
    case "glasses": {
      const pLeft = getPoint(ANCHORS.glasses.left);
      const pRight = getPoint(ANCHORS.glasses.right);
      const pCenter = getPoint(ANCHORS.glasses.center);

      centerX = (pLeft.x + pRight.x) / 2;
      centerY = (pLeft.y + pRight.y + pCenter.y) / 3;

      rotation = calculateUprightRotation(pLeft, pRight);

      referenceWidth = Math.hypot(
        pRight.x - pLeft.x,
        pRight.y - pLeft.y
      );

      baseScale = referenceWidth * 1.34;
      break;
    }

    case "hat": {
      const pLeft = getPoint(ANCHORS.hat.left);
      const pRight = getPoint(ANCHORS.hat.right);
      const pTop = getPoint(ANCHORS.hat.top);

      centerX = (pLeft.x + pRight.x) / 2;
      rotation = calculateUprightRotation(pLeft, pRight);

      referenceWidth = Math.hypot(
        pRight.x - pLeft.x,
        pRight.y - pLeft.y
      );

      baseScale = referenceWidth * 1.6;
      centerY = pTop.y - baseScale * 0.3;
      break;
    }

    case "earrings": {
      const pLeft = getPoint(ANCHORS.earrings.left);
      const pRight = getPoint(ANCHORS.earrings.right);

      rotation = calculateUprightRotation(pLeft, pRight);

      referenceWidth = Math.hypot(
        pRight.x - pLeft.x,
        pRight.y - pLeft.y
      );

      baseScale = referenceWidth * 0.1;
      centerX = pLeft.x;
      centerY = pLeft.y + referenceWidth * 0.05;
      break;
    }

    default:
      return null;
  }

  let correctionScale = 1;
  let correctionRotation = 0;

  // Only glasses should use correction right now
  if (accessory.type === "glasses" && isValidCornerOffsets(cornerOffsets)) {
  const canonical = [
    { x: 0, y: 0 },
    { x: 224, y: 0 },
    { x: 224, y: 224 },
    { x: 0, y: 224 },
  ];

  const pts = [
    { x: canonical[0].x + cornerOffsets[0], y: canonical[0].y + cornerOffsets[1] },
    { x: canonical[1].x + cornerOffsets[2], y: canonical[1].y + cornerOffsets[3] },
    { x: canonical[2].x + cornerOffsets[4], y: canonical[2].y + cornerOffsets[5] },
    { x: canonical[3].x + cornerOffsets[6], y: canonical[3].y + cornerOffsets[7] },
  ];

  const avgX = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const avgY = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

  const SHIFT_SCALE = 1 / 600;
  const MAX_SHIFT = 0.02;

  const shiftX = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, (avgX - 112) * SHIFT_SCALE));
  const shiftY = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, (avgY - 112) * SHIFT_SCALE));

  centerX += shiftX;
  centerY += shiftY;

  const topWidth = Math.hypot(
    pts[1].x - pts[0].x,
    pts[1].y - pts[0].y
  );

  const bottomWidth = Math.hypot(
    pts[2].x - pts[3].x,
    pts[2].y - pts[3].y
  );

  const avgWidth = (topWidth + bottomWidth) / 2;
  const roiWidth = 224;

  const widthRatio = avgWidth / roiWidth;
  const rawScale = 1 + (widthRatio - 1.0) * 0.15;
  correctionScale = Math.max(0.95, Math.min(1.05, rawScale));

  const topAngle = Math.atan2(
    pts[1].y - pts[0].y,
    pts[1].x - pts[0].x
  );

  correctionRotation = Math.max(-0.08, Math.min(0.08, topAngle * 0.5));
}

  const finalScale = baseScale * (accessory.scale || 1) * correctionScale;
  const finalRotation = rotation + correctionRotation;

  return {
    x: centerX,
    y: centerY,
    scale: finalScale,
    rotation: finalRotation,
    zIndex: Z_LAYERS[accessory.type] || 1,
    width: finalScale,
    height: finalScale,
  };
};

export const getSecondaryAnchorTransform = (
  accessory: AccessoryItem,
  landmarks: FaceLandmarks[],
  isImageMode: boolean
): AccessoryTransform | null => {
  if (accessory.type !== "earrings" || !landmarks || landmarks.length === 0) {
    return null;
  }

  const { getPoint } = getLandmarkAccessors(landmarks, isImageMode);

  const pLeft = getPoint(ANCHORS.earrings.left);
  const pRight = getPoint(ANCHORS.earrings.right);

  const rotation = calculateUprightRotation(pLeft, pRight);
  const referenceWidth = Math.hypot(
    pRight.x - pLeft.x,
    pRight.y - pLeft.y
  );

  const baseScale = referenceWidth * 0.1;

  return {
    x: pRight.x,
    y: pRight.y + referenceWidth * 0.05,
    scale: baseScale * (accessory.scale || 1),
    rotation,
    zIndex: Z_LAYERS[accessory.type] || 1,
    width: baseScale * (accessory.scale || 1),
    height: baseScale * (accessory.scale || 1),
  };
};