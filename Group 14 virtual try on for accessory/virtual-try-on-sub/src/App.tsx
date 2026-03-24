import { useState, useCallback, useEffect, useRef } from 'react';
import { useCamera } from './hooks/useCamera';
import { useFaceDetection } from './hooks/useFaceDetection';
import { useImageFaceDetection } from './hooks/useImageFaceDetection';
import { useAccessories } from './hooks/useAccessories';
import { AccessoryRenderer } from './components/AccessoryRenderer';
import { AccessorySelector } from './components/AccessorySelector';
import { CameraControls } from './components/CameraControls';
import { SnapshotGallery } from './components/SnapshotGallery';
import { StyleRecommender } from './components/StyleRecommender';
import { ImageUpload } from './components/ImageUpload';
import { LandingPage } from './components/LandingPage';
import MagicCursor from './components/MagicCursor';
import { AccessoryItem, FaceDetectionState } from './types';
import { wrapAccessory, getSecondaryAnchorTransform } from './utils/faceGeometry';
import { Sparkles, Zap, Split, Camera as CameraIcon, Loader2 } from 'lucide-react';

interface Snapshot {
  id: string;
  imageData: string;
  timestamp: number;
  accessories: string[];
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  const [cornerOffsets, setCornerOffsets] = useState<number[] | null>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      console.log('Theme changed to:', next);
      return next;
    });
  };

  const [showLanding, setShowLanding] = useState(true);
  const { isActive, error, videoRef, startCamera, stopCamera } = useCamera();
  const [inputMode, setInputMode] = useState<'camera' | 'image'>('camera');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageRefRight = useRef<HTMLImageElement>(null);
  const videoRefRight = useRef<HTMLVideoElement>(null);

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
    if (videoRef) {
      // @ts-ignore
      videoRef.current = node;
    }
    setVideoElement(node);
  }, [videoRef]);

  const faceStateCamera = useFaceDetection(
    isActive && inputMode === 'camera' ? videoElement : null
  );

  const faceStateImage = useImageFaceDetection(
    inputMode === 'image' ? uploadedImage : null
  );

  const faceState = inputMode === 'camera' ? faceStateCamera : faceStateImage;

  const { accessories: allAccessories, loading: accessoriesLoading } = useAccessories();

  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [selectedAccessoriesRight, setSelectedAccessoriesRight] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [activeView, setActiveView] = useState<'left' | 'right'>('left');

  const loadImageElement = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  const canvasToBase64 = useCallback((canvas: HTMLCanvasElement, mime = 'image/png') => {
    return canvas.toDataURL(mime).split(',')[1];
  }, []);

  const captureCurrentFaceFrame = useCallback(async (): Promise<{
    base64: string;
    width: number;
    height: number;
  } | null> => {
    const video = videoRef.current;
    const img = imageRef.current;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    if (inputMode === 'camera' && video) {
      if (!video.videoWidth || !video.videoHeight) return null;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Raw frame, NOT mirrored
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      return {
        base64: canvasToBase64(canvas, 'image/jpeg'),
        width: canvas.width,
        height: canvas.height,
      };
    }

    if (inputMode === 'image' && img) {
      if (!img.naturalWidth || !img.naturalHeight) return null;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      return {
        base64: canvasToBase64(canvas, 'image/jpeg'),
        width: canvas.width,
        height: canvas.height,
      };
    }

    return null;
  }, [inputMode, videoRef, canvasToBase64]);

  const renderAccessoryOverlayFrame = useCallback(async (
    accessory: AccessoryItem,
    faceStateValue: FaceDetectionState,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<string | null> => {
    if (!faceStateValue.isDetected || !faceStateValue.landmarks[0]) return null;

    const landmarks = faceStateValue.landmarks[0];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // IMPORTANT:
    // We want coordinates in the RAW captured frame coordinate space.
    // So we pass isImageMode=true to avoid the camera mirror flip.
    const transform = wrapAccessory(accessory, landmarks, true, null);
    if (!transform) return null;

    const img = await loadImageElement(accessory.preview);

    const drawSingle = (
      t: { x: number; y: number; width: number; rotation: number }
    ) => {
      const centerX = t.x * canvasWidth;
      const centerY = t.y * canvasHeight;
      const drawW = t.width * canvasWidth;
      const aspect = img.height && img.width ? img.height / img.width : 1;
      const drawH = drawW * aspect;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(t.rotation);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    };

    if (accessory.type === 'earrings') {
      drawSingle(transform);
      const transformRight = getSecondaryAnchorTransform(accessory, landmarks, true);
      if (transformRight) {
        drawSingle(transformRight);
      }
    } else {
      drawSingle(transform);
    }

    return canvasToBase64(canvas, 'image/png');
  }, [loadImageElement, canvasToBase64]);

  useEffect(() => {
    if (
      !faceState.isDetected ||
      selectedAccessories.length === 0 ||
      allAccessories.length === 0
    ) {
      setCornerOffsets(null);
      return;
    }

    let interval: NodeJS.Timeout;

    const refine = async () => {
      try {
        const selectedAccessory = allAccessories.find(
          a => a.id === selectedAccessories[0]
        );

        if (!selectedAccessory) {
          setCornerOffsets(null);
          return;
        }

        // For now, refine glasses only.
        // This keeps the pipeline stable while we validate it.
        if (selectedAccessory.type !== 'glasses') {
          setCornerOffsets(null);
          return;
        }

        const faceFrame = await captureCurrentFaceFrame();
        if (!faceFrame) return;

        const accessoryOverlayBase64 = await renderAccessoryOverlayFrame(
          selectedAccessory,
          faceState,
          faceFrame.width,
          faceFrame.height
        );

        if (!accessoryOverlayBase64) return;

        const response = await fetch(
          'http://127.0.0.1:8000/predict-correction',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              face_image: faceFrame.base64,
              accessory_image: accessoryOverlayBase64,
              accessory_is_prewarped: true,
            }),
          }
        );

        if (!response.ok) {
          console.error('Backend error:', response.status);
          const errText = await response.text();
          console.error('Backend response:', errText);
          return;
        }

        const data = await response.json();

        if (data.status === 'success') {
          const offsets = data.corner_offsets ?? null;

          setCornerOffsets(prev => {
            if (!prev || !offsets) return offsets;

            const smoothed = offsets.map((v: number, i: number) => (
              0.7 * prev[i] + 0.3 * v
            ));

            return smoothed;
          });
        }
      } catch (err) {
        console.warn('Refinement failed', err);
      }
    };

    refine();
    interval = setInterval(refine, 2000);

    return () => clearInterval(interval);
  }, [
    faceState,
    selectedAccessories,
    allAccessories,
    captureCurrentFaceFrame,
    renderAccessoryOverlayFrame,
  ]);

  useEffect(() => {
    console.log('Corner Offsets:', cornerOffsets);
  }, [cornerOffsets]);

  useEffect(() => {
    setCornerOffsets(null);
  }, [selectedAccessories]);

  useEffect(() => {
    if (!showLanding && inputMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [inputMode, showLanding, startCamera, stopCamera]);

  useEffect(() => {
    if (isCompareMode && videoRefRight.current && videoRef.current?.srcObject) {
      videoRefRight.current.srcObject = videoRef.current.srcObject;
      videoRefRight.current.play().catch(() => {});
    }
  }, [isCompareMode, isActive, videoRef]);

  const getSelectedAccessoryObjects = useCallback((
    view: 'left' | 'right' = 'left'
  ): AccessoryItem[] => {
    const selectedIds = view === 'left' ? selectedAccessories : selectedAccessoriesRight;

    return selectedIds
      .map(id => allAccessories.find(accessory => accessory.id === id))
      .filter(Boolean) as AccessoryItem[];
  }, [selectedAccessories, selectedAccessoriesRight, allAccessories]);

  const drawAccessoriesOnCanvas = useCallback(async (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    accessories: AccessoryItem[],
    faceState: FaceDetectionState
  ) => {
    if (!faceState.landmarks[0]) return;

    const landmarks = faceState.landmarks[0];
    const isImageMode = inputMode === 'image';

    for (const accessory of accessories) {
      const shouldRefine =
        !!cornerOffsets && accessory.type === 'glasses';

      const transform = wrapAccessory(
        accessory,
        landmarks,
        isImageMode,
        shouldRefine ? cornerOffsets : null
      );

      if (!transform) continue;

      const centerX = transform.x * canvasWidth;
      const centerY = transform.y * canvasHeight;
      const w = transform.width * canvasWidth;

      const img = await loadImageElement(accessory.preview);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(transform.rotation);

      if (accessory.type === 'earrings') {
        const size = w;
        const aspect = img.height && img.width ? img.height / img.width : 1;
        ctx.drawImage(img, -size / 2, -size / 2, size, size * aspect);
        ctx.restore();

        const transformR = getSecondaryAnchorTransform(
          accessory,
          landmarks,
          isImageMode
        );

        if (transformR) {
          ctx.save();
          const centerX2 = transformR.x * canvasWidth;
          const centerY2 = transformR.y * canvasHeight;
          ctx.translate(centerX2, centerY2);
          ctx.rotate(transformR.rotation);
          ctx.drawImage(img, -size / 2, -size / 2, size, size * aspect);
          ctx.restore();
        }
      } else {
        const aspect = img.height && img.width ? img.height / img.width : 1;
        const h = w * aspect;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }
  }, [inputMode, cornerOffsets, loadImageElement]);

  const handleCapture = useCallback(async () => {
    if (inputMode === 'camera' && !videoRef.current) return;
    if (inputMode === 'image' && !uploadedImage) return;

    setIsLoading(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      if (inputMode === 'camera') {
        const video = videoRef.current!;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        const img = imageRef.current!;
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 480;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      if (faceState.isDetected && faceState.landmarks[0]) {
        await drawAccessoriesOnCanvas(
          ctx,
          canvas.width,
          canvas.height,
          getSelectedAccessoryObjects(activeView),
          faceState
        );
      }

      const imageData = canvas.toDataURL('image/png', 0.9);

      const newSnapshot: Snapshot = {
        id: `snapshot-${Date.now()}`,
        imageData,
        timestamp: Date.now(),
        accessories: activeView === 'left'
          ? [...selectedAccessories]
          : [...selectedAccessoriesRight],
      };

      setSnapshots(prev => [newSnapshot, ...prev]);
    } catch (error) {
      console.error('Failed to capture snapshot:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedAccessories,
    selectedAccessoriesRight,
    faceState,
    getSelectedAccessoryObjects,
    activeView,
    inputMode,
    uploadedImage,
    drawAccessoriesOnCanvas,
    videoRef,
  ]);

  const handleDeleteSnapshot = useCallback((id: string) => {
    setSnapshots(prev => prev.filter(snapshot => snapshot.id !== id));
  }, []);

  const handleDownloadSnapshot = useCallback((snapshot: Snapshot) => {
    const link = document.createElement('a');
    link.download = `virtual-tryaon-${snapshot.timestamp}.png`;
    link.href = snapshot.imageData;
    link.click();
  }, []);

  const handleReset = useCallback(() => {
    if (isCompareMode) {
      if (activeView === 'left') {
        setSelectedAccessories([]);
      } else {
        setSelectedAccessoriesRight([]);
      }
    } else {
      setSelectedAccessories([]);
    }
  }, [isCompareMode, activeView]);

  const handleToggleCamera = useCallback(() => {
    if (isActive) {
      stopCamera();
    } else {
      startCamera();
    }
  }, [isActive, startCamera, stopCamera]);

  const handleImageSelect = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      setUploadedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleClearImage = useCallback(() => {
    setUploadedImage(null);
  }, []);

  const handleModeToggle = useCallback(() => {
    setInputMode(prev => prev === 'camera' ? 'image' : 'camera');
  }, []);

  if (showLanding) {
    return (
      <>
        <MagicCursor />
        <LandingPage onStart={() => setShowLanding(false)} />
      </>
    );
  }

  return (
    <>
      <MagicCursor />
      <div
        key={theme}
        className={
          theme === 'dark'
            ? 'min-h-screen transition-colors duration-500 bg-gradient-to-br from-[#1e0b3a] via-[#1a1447] to-[#0a1a3a]'
            : 'min-h-screen transition-colors duration-500 bg-gradient-to-br from-pink-300 to-indigo-300'
        }
      >
        <div className="relative z-10 p-4">
          <div className="flex items-center justify-between mb-4 w-full">
            <div className="flex items-center space-x-3 mr-6">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg">
                <Sparkles className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  Virtual Try-On Studio
                </h1>
                <p className="text-gray-400 text-sm">AI-Powered Accessory Fitting</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {faceState.isModelLoading && (
                <div className="flex items-center space-x-2 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm animate-pulse">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Loading Model...</span>
                </div>
              )}

              {faceState.isDetected && !faceState.isModelLoading && (
                <div className="flex items-center space-x-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                  <Zap size={14} />
                  <span>Face Detected</span>
                </div>
              )}

              <button
                onClick={handleModeToggle}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <CameraIcon size={16} />
                <span>{inputMode === 'camera' ? 'Use Image' : 'Use Camera'}</span>
              </button>

              <button
                onClick={() => {
                  console.log('BUTTON CLICKED');
                  toggleTheme();
                }}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition"
              >
                Mode
              </button>
            </div>
          </div>

          {inputMode === 'image' && (
            <div className="max-w-md mx-auto">
              <ImageUpload
                onImageSelect={handleImageSelect}
                onClear={handleClearImage}
                hasImage={!!uploadedImage}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 p-4">
          <div className="flex-1 relative ml-28 scale-[1.02]">
            <div className="mb-10 flex justify-center">
              <button
                onClick={() => {
                  const newCompareMode = !isCompareMode;
                  setIsCompareMode(newCompareMode);
                  if (!newCompareMode) {
                    setActiveView('left');
                  }
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  isCompareMode
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Split size={18} />
                <span>Compare Mode</span>
              </button>
            </div>

            <div className={`grid ${isCompareMode ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
              <div className="relative">
                {isCompareMode && (
                  <div
                    className={`absolute -top-8 left-0 right-0 text-center z-30 text-sm font-semibold px-3 py-1 rounded-t-lg cursor-pointer transition-colors ${
                      activeView === 'left'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    onClick={() => setActiveView('left')}
                  >
                    Look A
                  </div>
                )}

                <div className="camera-container glow-card relative bg-gray-800/80 dark:bg-gray-800 rounded-xl overflow-hidden aspect-video max-h-[75vh]">
                  {inputMode === 'camera' ? (
                    <video
                      ref={videoRefCallback}
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                      playsInline
                      muted
                    />
                  ) : (
                    uploadedImage && (
                      <img
                        ref={imageRef}
                        src={uploadedImage}
                        alt="Uploaded face"
                        className="w-full h-full object-contain"
                      />
                    )
                  )}

                  {((inputMode === 'camera' && isActive) || (inputMode === 'image' && uploadedImage)) && (
                    <AccessoryRenderer
                      accessories={getSelectedAccessoryObjects('left')}
                      faceState={faceState}
                      isImageMode={inputMode === 'image'}
                      cornerOffsets={cornerOffsets}
                    />
                  )}

                  {inputMode === 'camera' && error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                      <div className="text-center p-6">
                        <p className="text-red-400 mb-2">Camera Error</p>
                        <p className="text-gray-400 text-sm">{error}</p>
                        <button
                          onClick={startCamera}
                          className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                          Retry
                        </button>
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

                  {!faceState.isDetected &&
                    !faceState.isModelLoading &&
                    ((inputMode === 'camera' && isActive) || (inputMode === 'image' && uploadedImage)) && (
                      <div className="absolute top-4 left-4 bg-yellow-500/90 text-yellow-900 px-3 py-1 rounded-full text-sm">
                        {inputMode === 'camera'
                          ? 'Position your face in the camera'
                          : 'No face detected in image'}
                      </div>
                    )}

                  {faceState.isModelLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
                      <div className="flex flex-col items-center">
                        <Loader2 className="animate-spin text-white mb-2" size={32} />
                        <p className="text-white font-medium">Initializing AI Model...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isCompareMode && (
                <div className="relative">
                  <div
                    className={`absolute -top-8 left-0 right-0 text-center z-30 text-sm font-semibold px-3 py-1 rounded-t-lg cursor-pointer transition-colors ${
                      activeView === 'right'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    onClick={() => setActiveView('right')}
                  >
                    Look B
                  </div>

                  <div className="camera-container glow-card relative bg-gray-800/80 dark:bg-gray-800 rounded-xl overflow-hidden aspect-video max-h-[75vh]">
                    {inputMode === 'camera' ? (
                      <video
                        ref={videoRefRight}
                        className="w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                        playsInline
                        muted
                        autoPlay
                      />
                    ) : (
                      uploadedImage && (
                        <img
                          ref={imageRefRight}
                          src={uploadedImage}
                          alt="Uploaded face"
                          className="w-full h-full object-contain"
                        />
                      )
                    )}

                    {((inputMode === 'camera' && isActive) || (inputMode === 'image' && uploadedImage)) && (
                      <AccessoryRenderer
                        accessories={getSelectedAccessoryObjects('right')}
                        faceState={faceState}
                        isImageMode={inputMode === 'image'}
                        cornerOffsets={cornerOffsets}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {inputMode === 'camera' && (
              <CameraControls
                isActive={isActive}
                onToggleCamera={handleToggleCamera}
                onCapture={handleCapture}
                onReset={handleReset}
                onOpenGallery={() => setIsGalleryOpen(true)}
                snapshotCount={snapshots.length}
              />
            )}

            {inputMode === 'image' && uploadedImage && (
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-10">
                <div className="bg-gray-900/90 backdrop-blur-sm rounded-full px-6 py-3 flex items-center space-x-4">
                  <button
                    onClick={handleCapture}
                    className="p-4 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-all duration-200 transform hover:scale-105"
                  >
                    <CameraIcon size={24} />
                  </button>

                  <button
                    onClick={() => setIsGalleryOpen(true)}
                    className="relative p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors"
                  >
                    <img
                      className="lucide"
                      width="20"
                      height="20"
                      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'/%3E%3Ccircle cx='9' cy='9' r='2'/%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/%3E%3C/svg%3E"
                      alt="Gallery"
                    />
                    {snapshots.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {snapshots.length > 99 ? '99+' : snapshots.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={handleReset}
                    className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors"
                  >
                    <img
                      className="lucide"
                      width="20"
                      height="20"
                      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'/%3E%3Cpath d='M21 3v5h-5'/%3E%3Cpath d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'/%3E%3Cpath d='M8 16H3v5'/%3E%3C/svg%3E"
                      alt="Reset"
                    />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:w-80 space-y-4">
            {isCompareMode && (
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-3 text-white text-center">
                <p className="text-sm font-semibold">
                  Editing: {activeView === 'left' ? 'Look A' : 'Look B'}
                </p>
                <p className="text-xs opacity-90 mt-1">Click on a view above to switch</p>
              </div>
            )}

            <StyleRecommender
              currentAccessories={
                activeView === 'left' ? selectedAccessories : selectedAccessoriesRight
              }
              allAccessories={allAccessories}
              onRecommendationSelect={
                activeView === 'left' ? setSelectedAccessories : setSelectedAccessoriesRight
              }
              faceState={faceState}
            />

            <div className="glow-card bg-gray-900/80 backdrop-blur-sm rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-400">
                    {(activeView === 'left' ? selectedAccessories : selectedAccessoriesRight).length}
                  </div>
                  <div className="text-xs text-gray-400">Active Items</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{snapshots.length}</div>
                  <div className="text-xs text-gray-400">Snapshots</div>
                </div>
              </div>
            </div>

            <div className="glow-card bg-gray-900/80 backdrop-blur-sm rounded-xl py-0 px-4 space-y-4">
              <div className="text-lg font-semibold text-white mb-2">Accessories</div>
              <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-2 scrollbar-hide">
                {accessoriesLoading ? (
                  <div className="flex items-center justify-center p-8 text-gray-400">
                    <Loader2 className="animate-spin mr-2" size={24} />
                    <span>Loading Accessories...</span>
                  </div>
                ) : (
                  (['glasses', 'hat', 'earrings'] as const).map(type => (
                    <AccessorySelector
                      key={type}
                      type={type}
                      accessories={allAccessories.filter(a => a.type === type)}
                      allAccessories={allAccessories}
                      selectedIds={
                        activeView === 'left'
                          ? selectedAccessories
                          : selectedAccessoriesRight
                      }
                      onSelectionChange={
                        activeView === 'left'
                          ? setSelectedAccessories
                          : setSelectedAccessoriesRight
                      }
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <SnapshotGallery
          snapshots={snapshots}
          onDeleteSnapshot={handleDeleteSnapshot}
          onDownloadSnapshot={handleDownloadSnapshot}
          isOpen={isGalleryOpen}
          onClose={() => setIsGalleryOpen(false)}
        />
      </div>
    </>
  );
}

export default App;