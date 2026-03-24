import React, { forwardRef } from 'react';
import { AccessoryItem, FaceDetectionState } from '../types';
import { AccessoryRenderer } from './AccessoryRenderer';
import { Loader2 } from 'lucide-react';

interface MediaContainerProps {
  inputMode: 'camera' | 'image';
  uploadedImage: string | null;
  isActive: boolean;
  error: string | null;
  isLoading: boolean;
  faceState: FaceDetectionState;
  accessories: AccessoryItem[];
  label?: string;
  isActiveView?: boolean;
  onViewSelect?: () => void;
  imageRef?: React.Ref<HTMLImageElement>;
  onRetry?: () => void;
}

export const MediaContainer = forwardRef<HTMLVideoElement, MediaContainerProps>(({
  inputMode,
  uploadedImage,
  isActive,
  error,
  isLoading,
  faceState,
  accessories,
  label,
  isActiveView,
  onViewSelect,
  imageRef,
  onRetry
}, ref) => {
  return (
    <div className="relative">
      {label && (
        <div
          className={`absolute -top-8 left-0 right-0 text-center z-30 text-sm font-semibold px-3 py-1 rounded-t-lg cursor-pointer transition-colors ${
            isActiveView
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          onClick={onViewSelect}
        >
          {label}
        </div>
      )}
      <div className="camera-container relative bg-black rounded-xl overflow-hidden aspect-video max-h-[70vh] flex items-center justify-center">
        {inputMode === 'camera' ? (
          <video
            ref={ref}
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
            playsInline
            muted
            autoPlay
          />
        ) : (
          uploadedImage && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                ref={imageRef}
                src={uploadedImage}
                alt="Uploaded face"
                className="w-full h-full object-cover"
              />
              <AccessoryRenderer
                accessories={accessories}
                faceState={faceState}
                isImageMode={true}
              />
            </div>
          )
        )}

        {inputMode === 'camera' && isActive && (
          <AccessoryRenderer
            accessories={accessories}
            faceState={faceState}
            isImageMode={false}
          />
        )}

        {inputMode === 'camera' && error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="text-center p-6">
              <p className="text-red-400 mb-2">Camera Error</p>
              <p className="text-gray-400 text-sm">{error}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
            <div className="bg-white text-gray-900 px-4 py-2 rounded-lg">
              Capturing...
            </div>
          </div>
        )}

        {!faceState.isDetected && !faceState.isModelLoading && ((inputMode === 'camera' && isActive) || (inputMode === 'image' && uploadedImage)) && (
          <div className="absolute top-4 left-4 bg-yellow-500/90 text-yellow-900 px-3 py-1 rounded-full text-sm z-30">
            {inputMode === 'camera' ? 'Position your face in the camera' : 'No face detected in image'}
          </div>
        )}
        
        {faceState.isModelLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-40">
             <div className="flex flex-col items-center">
                <Loader2 className="animate-spin text-white mb-2" size={32} />
                <p className="text-white font-medium">Initializing AI Model...</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
});

MediaContainer.displayName = 'MediaContainer';