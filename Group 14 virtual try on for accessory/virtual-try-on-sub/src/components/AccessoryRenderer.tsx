import React from "react";
import { AccessoryItem, FaceDetectionState } from "../types";
import { wrapAccessory, getSecondaryAnchorTransform } from "../utils/faceGeometry";

interface AccessoryRendererProps {
  accessories: AccessoryItem[];
  faceState: FaceDetectionState;
  className?: string;
  isImageMode?: boolean;
  cornerOffsets?: number[] | null;
}

export const AccessoryRenderer: React.FC<AccessoryRendererProps> = ({
  accessories,
  faceState,
  isImageMode = false,
  cornerOffsets = null,
}) => {

  if (!faceState.isDetected || !faceState.landmarks[0]) return null;

  const landmarks = faceState.landmarks[0];

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden rounded-xl">
      {accessories.map((accessory) => {

        const shouldRefine =
          cornerOffsets &&
          (accessory.type === "glasses" || accessory.type === "hat");

        const transform = wrapAccessory(
          accessory,
          landmarks,
          isImageMode,
          shouldRefine ? cornerOffsets : null
        );

        if (!transform) return null;

        const baseStyle: React.CSSProperties = {
          position: "absolute",
          pointerEvents: "none",
          transformOrigin: "center center",
        };

        // --------------------------
        // 🎧 Earrings
        // --------------------------
        if (accessory.type === "earrings") {

          const rightTransform = getSecondaryAnchorTransform(
            accessory,
            landmarks,
            isImageMode
          );

          return (
            <React.Fragment key={accessory.id}>
              <img
                src={accessory.preview}
                alt={accessory.name}
                crossOrigin="anonymous"
                className="object-contain"
                style={{
                  ...baseStyle,
                  left: `${transform.x * 100}%`,
                  top: `${transform.y * 100}%`,
                  width: `${transform.width * 100}%`,
                  height: "auto",
                  transform: `translate(-50%, -50%) rotate(${transform.rotation}rad)`,
                  zIndex: transform.zIndex,
                }}
              />

              {rightTransform && (
                <img
                  src={accessory.preview}
                  alt={accessory.name}
                  crossOrigin="anonymous"
                  className="object-contain"
                  style={{
                    ...baseStyle,
                    left: `${rightTransform.x * 100}%`,
                    top: `${rightTransform.y * 100}%`,
                    width: `${rightTransform.width * 100}%`,
                    height: "auto",
                    transform: `translate(-50%, -50%) rotate(${rightTransform.rotation}rad)`,
                    zIndex: rightTransform.zIndex,
                  }}
                />
              )}
            </React.Fragment>
          );
        }

        // --------------------------
        // 👓 🧢 Glasses & Hat
        // --------------------------
        return (
          <img
            key={accessory.id}
            src={accessory.preview}
            alt={accessory.name}
            crossOrigin="anonymous"
            className="object-contain"
            style={{
              ...baseStyle,
              left: `${transform.x * 100}%`,
              top: `${transform.y * 100}%`,
              width: `${transform.width * 100}%`,
              height: "auto",
              transform: `translate(-50%, -50%) rotate(${transform.rotation}rad)`,
              zIndex: transform.zIndex,
            }}
          />
        );
      })}
    </div>
  );
};