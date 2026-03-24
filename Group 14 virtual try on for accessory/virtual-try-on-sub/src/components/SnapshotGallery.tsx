import React from 'react';
import { Camera, Download, X } from 'lucide-react';

interface Snapshot {
  id: string;
  imageData: string;
  timestamp: number;
  accessories: string[];
}

interface SnapshotGalleryProps {
  snapshots: Snapshot[];
  onDeleteSnapshot: (id: string) => void;
  onDownloadSnapshot: (snapshot: Snapshot) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SnapshotGallery: React.FC<SnapshotGalleryProps> = ({
  snapshots,
  onDeleteSnapshot,
  onDownloadSnapshot,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-4xl max-h-[80vh] overflow-y-auto w-full shadow-2xl transition-colors duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Camera className="mr-2" size={24} />
            Snapshots ({snapshots.length})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {snapshots.length === 0 ? (
          <div className="text-center py-12">
            <Camera size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No snapshots yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">Click the camera button to capture your virtual try-on!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden group border border-gray-200 dark:border-gray-700"
              >
                <div className="relative">
                  <img
                    src={snapshot.imageData}
                    alt={`Virtual try-on snapshot from ${new Date(snapshot.timestamp).toLocaleDateString()}`}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2">
                    <button
                      onClick={() => onDownloadSnapshot(snapshot)}
                      className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full transition-colors shadow-lg"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => onDeleteSnapshot(snapshot.id)}
                      className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors shadow-lg"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(snapshot.timestamp).toLocaleString()}
                  </p>
                  {snapshot.accessories.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {snapshot.accessories.length} accessory{snapshot.accessories.length !== 1 ? 'ies' : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};