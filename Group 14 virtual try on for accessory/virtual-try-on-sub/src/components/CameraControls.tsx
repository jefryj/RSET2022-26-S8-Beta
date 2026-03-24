import React from 'react';
import { Camera, Square, Play, Pause, RotateCcw, Image } from 'lucide-react';

interface CameraControlsProps {
  isActive: boolean;
  isRecording?: boolean;
  onToggleCamera: () => void;
  onCapture: () => void;
  onToggleRecording?: () => void;
  onReset: () => void;
  onOpenGallery: () => void;
  snapshotCount: number;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  isActive,
  isRecording = false,
  onToggleCamera,
  onCapture,
  onToggleRecording,
  onReset,
  onOpenGallery,
  snapshotCount
}) => {
  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
      <div className=" bg-gray-900/90 backdrop-blur-sm rounded-full px-6 py-3 flex items-center space-x-4 shadow-lg border dark:border-gray-700 transition-colors duration-300">
        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`p-3 rounded-full transition-all duration-200 ${
            isActive
              ? 'bg-green-500 hover:bg-green-600 text-white shadow-md'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          {isActive ? <Pause size={20} /> : <Play size={20} />}
        </button>

        {/* Capture */}
        {isActive && (
          <button
            onClick={onCapture}
            className="p-4 bg-blue-900 text-white rounded-full hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 shadow-md"
          >
            <Camera size={24} />
          </button>
        )}

        {/* Gallery */}
        <button
          onClick={onOpenGallery}
          className="relative p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors"
        >
          <Image size={20} />
          {snapshotCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {snapshotCount > 99 ? '99+' : snapshotCount}
            </span>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors"
        >
          <RotateCcw size={20} />
        </button>

        {/* Recording Toggle (if available) */}
        {onToggleRecording && (
          <button
            onClick={onToggleRecording}
            className={`p-3 rounded-full transition-colors ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                : 'bg-gray-700 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-white'
            }`}
          >
            <Square size={20} />
          </button>
        )}
      </div>
    </div>
  );
};