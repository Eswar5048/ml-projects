import React, { useState, useRef, useEffect } from 'react';
import { AppMode, ClassificationResult, DetectionResult, GestureResult } from '../types';
import { classifyImage, detectObjects, detectHandGestures } from '../services/geminiService';
import { Upload, X, Loader2, Image as ImageIcon, CheckCircle, Search, Camera, Zap, ZapOff, RefreshCw, SwitchCamera, Hand, Maximize2, Minimize2 } from 'lucide-react';

interface VisionPanelProps {
  mode: AppMode;
}

type InputSource = 'upload' | 'camera';

const SUPPORTED_GESTURES = [
  "👍 Thumbs Up", "👎 Thumbs Down", "✌️ Peace", "👌 OK Sign", 
  "✋ Stop / Palm", "🙌 High Five", "👊 Fist Bump", "👏 Clapping",
  "✊ Fist", "🤟 Love (ASL)", "🤘 Rock On", "🫶 Finger Heart", 
  "🤙 Shaka", "🤞 Crossed Fingers", "👋 Waving", "🤙 Call Me"
];

const VisionPanel: React.FC<VisionPanelProps> = ({ mode }) => {
  const [source, setSource] = useState<InputSource>('upload');
  
  // Upload State
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAutoAnalyze, setIsAutoAnalyze] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Common State
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ClassificationResult | DetectionResult | GestureResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset state when mode changes
  useEffect(() => {
    setResult(null);
    setError(null);
    setIsAutoAnalyze(false); // Stop auto analyze on mode switch
  }, [mode]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Restart camera if facing mode changes while streaming
  useEffect(() => {
    if (isStreaming) {
      stopCamera();
      startCamera();
    }
  }, [facingMode]);

  // Handle Fullscreen changes (e.g. via ESC key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // --- Upload Handlers ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setSelectedImage(file);
        setPreviewUrl(URL.createObjectURL(file));
        setResult(null);
        setError(null);
      }
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // --- Camera Handlers ---

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
    } catch (err) {
      console.error(err);
      setCameraError("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setIsAutoAnalyze(false);
  };

  const toggleCameraFlip = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const captureFrame = async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Match canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
    });
  };

  // --- Processing Logic ---

  const processImage = async (image: Blob) => {
    setIsLoading(true);
    // Don't clear result immediately in auto mode to prevent flickering
    if (!isAutoAnalyze) {
        setResult(null);
    }
    setError(null);

    try {
      if (mode === AppMode.CLASSIFICATION) {
        const data = await classifyImage(image);
        setResult(data);
      } else if (mode === AppMode.OBJECT_DETECTION) {
        const data = await detectObjects(image);
        setResult(data);
      } else if (mode === AppMode.HAND_GESTURES) {
        const data = await detectHandGestures(image);
        setResult(data);
      }
    } catch (err) {
      // Only show error in manual mode or if it's not a cancellation
      if (!isAutoAnalyze) {
          setError("Failed to process image.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto Analyze Loop
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const analyzeLoop = async () => {
      if (!isAutoAnalyze || !mounted || !isStreaming) return;
      
      // If already loading, wait and try again shortly
      if (isLoading) {
        timeoutId = setTimeout(analyzeLoop, 200);
        return;
      }

      const blob = await captureFrame();
      if (blob) {
        await processImage(blob);
      }

      if (mounted && isAutoAnalyze) {
        // Schedule next capture. 
        // Use a faster interval for Hand Gestures to feel "live"
        const delay = mode === AppMode.HAND_GESTURES ? 500 : 2500;
        timeoutId = setTimeout(analyzeLoop, delay);
      }
    };

    if (isAutoAnalyze) {
      analyzeLoop();
    }

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [isAutoAnalyze, isStreaming, isLoading, mode]);

  const handleManualCapture = async () => {
    const blob = await captureFrame();
    if (blob) {
      processImage(blob);
    }
  };


  // --- Render Helpers ---
  const getButtonLabel = () => {
      if (isLoading) return 'Analyzing...';
      switch (mode) {
          case AppMode.CLASSIFICATION: return 'Identify Image';
          case AppMode.OBJECT_DETECTION: return 'Detect Objects';
          case AppMode.HAND_GESTURES: return 'Recognize Gesture';
          default: return 'Analyze';
      }
  };

  const getHeaderInfo = () => {
      switch (mode) {
          case AppMode.CLASSIFICATION: 
             return { title: 'Image Classification', desc: 'Identify contents with multimodal vision.' };
          case AppMode.OBJECT_DETECTION: 
             return { title: 'Object Detection', desc: 'Find and describe objects in the scene.' };
          case AppMode.HAND_GESTURES: 
             return { title: 'Hand Gesture Recognition', desc: 'Detect and interpret hand signs.' };
          default: return { title: '', desc: '' };
      }
  };

  const renderClassificationResult = (data: ClassificationResult) => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 shadow-sm border border-slate-100/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Prediction
          </h3>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            {data.confidence}
          </span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-2 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          {data.label}
        </div>
        <p className="text-slate-600 leading-relaxed">{data.details}</p>
      </div>
    </div>
  );

  const renderDetectionResult = (data: DetectionResult) => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 shadow-sm border border-slate-100/50">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-blue-500" />
          Detected Objects ({data.objects?.length || 0})
        </h3>
        <div className="grid gap-3">
          {data.objects?.map((obj, idx) => (
            <div key={idx} className="flex items-start p-3 bg-white rounded-lg border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="bg-slate-100 w-8 h-8 flex items-center justify-center rounded-md mr-4 text-sm font-bold text-slate-600">
                {idx + 1}
              </div>
              <div>
                <div className="font-bold text-slate-800">{obj.name}</div>
                <div className="text-sm text-slate-500">{obj.description}</div>
              </div>
            </div>
          ))}
          {(!data.objects || data.objects.length === 0) && (
            <div className="text-center text-slate-500 py-4 italic">No objects detected clearly.</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderGestureResult = (data: GestureResult) => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 shadow-sm border border-slate-100/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Hand className="w-5 h-5 text-purple-500" />
            Gesture Recognized
          </h3>
          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
            {data.confidence}
          </span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-2 bg-gradient-to-r from-purple-900 to-indigo-700 bg-clip-text text-transparent">
          {data.gesture}
        </div>
        <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-100">
            <div className="text-xs font-bold text-purple-400 uppercase tracking-wide mb-1">Meaning / Action</div>
            <p className="text-slate-700 font-medium">{data.meaning}</p>
        </div>
      </div>
    </div>
  );

  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl animate-in fade-in duration-300">
      <Loader2 className="w-12 h-12 text-white animate-spin mb-3" />
      <div className="text-white font-medium tracking-wide animate-pulse">Analyzing Scene...</div>
    </div>
  );

  const header = getHeaderInfo();

  return (
    <div className="w-full h-full p-4 md:p-6 flex flex-col">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1">
            {header.title}
          </h2>
          <p className="text-slate-500">
            {header.desc}
          </p>
        </div>

        <div className="flex items-center gap-2">
           {/* Fullscreen Toggle */}
           <button
             onClick={toggleFullScreen}
             className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all bg-white shadow-sm"
             title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
           >
             {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
           </button>

           {/* Source Toggle */}
           <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
             <button
               onClick={() => setSource('upload')}
               className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                 source === 'upload' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
               }`}
             >
               <Upload className="w-4 h-4" />
               Upload
             </button>
             <button
               onClick={() => {
                 setSource('camera');
                 startCamera();
               }}
               className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                 source === 'camera' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
               }`}
             >
               <Camera className="w-4 h-4" />
               Camera
             </button>
           </div>
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 gap-6 min-h-0">
        {/* Left Column: Input */}
        <div className="flex flex-col gap-4 min-h-[400px]">
          {source === 'upload' ? (
            <div className="relative group flex-1">
              {!previewUrl ? (
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="h-full border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 transition-all cursor-pointer min-h-[400px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileSelect}
                  />
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Upload Image</h3>
                  <p className="text-slate-500 text-sm max-w-[240px]">Drag & drop or click to browse</p>
                </div>
              ) : (
                <div className="relative h-full rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-black flex items-center justify-center group">
                  <img src={previewUrl} alt="Preview" className="max-w-full max-h-[600px] object-contain" />
                  
                  {isLoading && !isAutoAnalyze && <LoadingOverlay />}

                  <button 
                    onClick={clearImage}
                    className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            // --- Camera View ---
            <div className="relative h-full rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-black flex items-center justify-center min-h-[400px]">
               {!isStreaming && !cameraError && (
                 <div className="text-center text-slate-400 p-8">
                   <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Camera className="w-8 h-8 text-slate-500" />
                   </div>
                   <p className="font-medium">Camera is inactive</p>
                   <button 
                    onClick={startCamera}
                    className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                   >
                     Activate Camera
                   </button>
                 </div>
               )}
               
               {cameraError && (
                 <div className="text-center text-red-400 p-8 max-w-sm">
                   <p className="mb-4">{cameraError}</p>
                   <button 
                    onClick={startCamera}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium"
                   >
                     Try Again
                   </button>
                 </div>
               )}

               <video 
                 ref={videoRef} 
                 autoPlay 
                 playsInline 
                 muted 
                 className={`max-w-full max-h-full object-contain ${!isStreaming ? 'hidden' : 'block'}`}
               />
               <canvas ref={canvasRef} className="hidden" />
               
               {isLoading && !isAutoAnalyze && <LoadingOverlay />}
               
               {isStreaming && (
                 <>
                   <div className="absolute top-4 left-4">
                     {isAutoAnalyze && (
                        <div className="px-3 py-1.5 bg-red-500/90 text-white text-xs font-bold rounded-full flex items-center gap-1.5 backdrop-blur-sm shadow-lg animate-pulse">
                          <Zap className="w-3 h-3 fill-current" />
                          LIVE ANALYZE
                        </div>
                      )}
                   </div>
                   <div className="absolute top-4 right-4">
                      <button 
                        onClick={toggleCameraFlip}
                        className="p-2.5 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all"
                        title="Flip Camera"
                      >
                        <SwitchCamera className="w-5 h-5" />
                      </button>
                   </div>
                   
                   {/* Live Gesture Overlay */}
                   {mode === AppMode.HAND_GESTURES && result && (
                     <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md text-white px-6 py-3 rounded-full border border-white/20 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-20 transition-all">
                        <Hand className="w-6 h-6 text-purple-400" />
                        <span className="font-bold text-xl tracking-tight">{(result as GestureResult).gesture}</span>
                        <span className="text-sm text-white/60 pl-2 border-l border-white/20 font-mono">{(result as GestureResult).confidence}</span>
                     </div>
                   )}
                 </>
               )}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3">
             {source === 'upload' && previewUrl && (
                <button
                  onClick={() => selectedImage && processImage(selectedImage)}
                  disabled={isLoading}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform hover:translate-y-[-1px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      {mode === AppMode.HAND_GESTURES ? <Hand className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                      {getButtonLabel()}
                    </>
                  )}
                </button>
             )}

             {source === 'camera' && isStreaming && (
                <>
                  <button
                    onClick={handleManualCapture}
                    disabled={isLoading || isAutoAnalyze}
                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    {isLoading && !isAutoAnalyze ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    Capture & Analyze
                  </button>
                  
                  <button
                    onClick={() => setIsAutoAnalyze(!isAutoAnalyze)}
                    className={`px-6 py-3.5 rounded-xl font-bold shadow-sm flex items-center justify-center gap-2 transition-colors border ${
                      isAutoAnalyze 
                        ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isAutoAnalyze ? (
                       <ZapOff className="w-5 h-5" />
                    ) : (
                       <RefreshCw className="w-5 h-5" />
                    )}
                  </button>
                </>
             )}
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="flex flex-col h-full bg-slate-50/50 rounded-2xl border border-slate-200/50 p-6 overflow-y-auto max-h-[800px]">
          {error && (
             <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-start gap-3 mb-4 animate-in slide-in-from-top-2">
               <div className="mt-0.5 min-w-[1.25rem]">⚠️</div>
               {error}
             </div>
          )}

          {!result && !isLoading && !error ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
              {source === 'camera' && isAutoAnalyze ? (
                 <div className="text-center space-y-4">
                   <div className="relative w-16 h-16 mx-auto">
                      <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full animate-ping"></div>
                      <div className="absolute inset-0 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
                   </div>
                   <p className="font-medium text-slate-600">Processing live feed...</p>
                 </div>
              ) : (
                <>
                  {mode === AppMode.HAND_GESTURES ? (
                    <div className="w-full">
                       <div className="flex flex-col items-center mb-6">
                         <Hand className="w-16 h-16 mb-4 text-purple-200" />
                         <p className="text-lg font-medium text-slate-600">Try these gestures!</p>
                         <p className="text-sm text-slate-400">Perform a gesture clearly in front of the camera</p>
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full max-w-md mx-auto">
                          {SUPPORTED_GESTURES.map(gesture => (
                            <div key={gesture} className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs md:text-sm font-medium text-slate-600 text-center shadow-sm">
                              {gesture}
                            </div>
                          ))}
                       </div>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="w-16 h-16 mb-4" />
                      <p className="text-lg font-medium">No results yet</p>
                      <p className="text-sm">Capture or upload an image to begin</p>
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Analysis Results</h3>
                 {result && (
                   <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                     {new Date().toLocaleTimeString()}
                   </span>
                 )}
               </div>
               
               {result && mode === AppMode.CLASSIFICATION && renderClassificationResult(result as ClassificationResult)}
               {result && mode === AppMode.OBJECT_DETECTION && renderDetectionResult(result as DetectionResult)}
               {result && mode === AppMode.HAND_GESTURES && renderGestureResult(result as GestureResult)}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisionPanel;