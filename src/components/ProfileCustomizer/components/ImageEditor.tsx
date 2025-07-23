// src/components/ProfileCustomizer/components/ImageEditor.tsx - UPDATED FOR 680x240 BANNER
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface ImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (croppedImageData: string) => void;
  imageFile: File;
  title?: string;
  cropType?: 'circle' | 'banner';
}

interface ImageState {
  x: number;
  y: number;
  scale: number;
  naturalWidth: number;
  naturalHeight: number;
  minScale: number;
  sliderValue: number;
}

interface ContainerSize {
  width: number;
  height: number;
}

// ✅ PERFORMANCE: Memoized constants
const CONTAINER_WIDTH = 600; // Increased for better banner editing
const CONTAINER_HEIGHT = 400;
const CIRCLE_RADIUS_FACTOR = 0.7;
const BANNER_WIDTH_FACTOR = 0.95;
const BANNER_HEIGHT_FACTOR = 0.45;
const OUTPUT_SIZE = 200;
const MAX_SCALE = 3;
const MIN_IMAGE_SIZE = 32;
const MAX_IMAGE_SIZE = 4096;

// ✅ UPDATED: New banner output dimensions (300x140)
const BANNER_OUTPUT_WIDTH = 300;
const BANNER_OUTPUT_HEIGHT = 140;

// ✅ PERFORMANCE: Enhanced image validation with WebP and AVIF support
const validateImageFile = (file: File): Promise<{valid: boolean, error?: string}> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ valid: false, error: 'File must be an image' });
      return;
    }

    const maxSize = 50 * 1024 * 1024; // 50MB limit for better UX
    if (file.size > maxSize) {
      resolve({ valid: false, error: 'File size must be under 50MB' });
      return;
    }

    // ✅ PERFORMANCE: Use createImageBitmap for better performance if available
    if ('createImageBitmap' in window) {
      createImageBitmap(file)
        .then((bitmap) => {
          if (bitmap.width < MIN_IMAGE_SIZE || bitmap.height < MIN_IMAGE_SIZE) {
            resolve({ valid: false, error: `Image must be at least ${MIN_IMAGE_SIZE}x${MIN_IMAGE_SIZE} pixels` });
            return;
          }
          
          if (bitmap.width > MAX_IMAGE_SIZE || bitmap.height > MAX_IMAGE_SIZE) {
            resolve({ valid: false, error: `Image must be smaller than ${MAX_IMAGE_SIZE}x${MAX_IMAGE_SIZE} pixels` });
            return;
          }
          
          bitmap.close(); // Clean up memory
          resolve({ valid: true });
        })
        .catch(() => {
          resolve({ valid: false, error: 'Invalid or corrupted image file' });
        });
    } else {
      // Fallback to traditional Image method
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      const cleanup = () => URL.revokeObjectURL(url);
      
      const timeout = setTimeout(() => {
        cleanup();
        resolve({ valid: false, error: 'Image validation timeout' });
      }, 10000); // Increased timeout for large files
      
      img.onload = () => {
        clearTimeout(timeout);
        cleanup();
        
        if (img.width < MIN_IMAGE_SIZE || img.height < MIN_IMAGE_SIZE) {
          resolve({ valid: false, error: `Image must be at least ${MIN_IMAGE_SIZE}x${MIN_IMAGE_SIZE} pixels` });
          return;
        }
        
        if (img.width > MAX_IMAGE_SIZE || img.height > MAX_IMAGE_SIZE) {
          resolve({ valid: false, error: `Image must be smaller than ${MAX_IMAGE_SIZE}x${MAX_IMAGE_SIZE} pixels` });
          return;
        }
        
        resolve({ valid: true });
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        resolve({ valid: false, error: 'Invalid or corrupted image file' });
      };
      
      img.src = url;
    }
  });
};

export const ImageEditor: React.FC<ImageEditorProps> = ({
  isOpen,
  onClose,
  onApply,
  imageFile,
  title = "Edit Image",
  cropType = "circle"
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageState, setImageState] = useState<ImageState>({
    x: 0,
    y: 0,
    scale: 1,
    naturalWidth: 0,
    naturalHeight: 0,
    minScale: 1,
    sliderValue: 0
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // ✅ PERFORMANCE: Memoized container size
  const containerSize = useMemo<ContainerSize>(() => ({
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT
  }), []);

  // ✅ UPDATED: Memoized crop dimensions with FIXED 680x240 banner aspect ratio
  const cropDimensions = useMemo(() => {
    if (cropType === 'circle') {
      const radius = ((Math.min(containerSize.width, containerSize.height) / 2) - 10) * CIRCLE_RADIUS_FACTOR;
      return {
        width: radius * 2,
        height: radius * 2,
        radius,
        centerX: containerSize.width / 2,
        centerY: containerSize.height / 2
      };
    } else {
      // ✅ UPDATED: Banner crop should match actual 300x140 banner aspect ratio
      // Scale down to fit in the editor container while maintaining 300:140 ratio
      const aspectRatio = BANNER_OUTPUT_WIDTH / BANNER_OUTPUT_HEIGHT; // 300/140 ≈ 2.14
      
      let bannerWidth = containerSize.width * BANNER_WIDTH_FACTOR; // 570px
      let bannerHeight = bannerWidth / aspectRatio; // 201px
      
      // If height is too tall for container, scale based on height instead
      if (bannerHeight > containerSize.height * 0.6) {
        bannerHeight = containerSize.height * 0.6; // 240px max
        bannerWidth = bannerHeight * aspectRatio; // 300px scaled
      }
      
      return {
        width: bannerWidth,
        height: bannerHeight,
        radius: 0,
        centerX: containerSize.width / 2,
        centerY: containerSize.height / 2
      };
    }
  }, [cropType, containerSize]);

  // ✅ PERFORMANCE: Enhanced image loading with validation
  useEffect(() => {
    if (!imageFile || !isOpen) return;

    const loadImage = async () => {
      setIsLoading(true);
      setValidationError(null);

      try {
        // Validate file first
        const validation = await validateImageFile(imageFile);
        if (!validation.valid) {
          setValidationError(validation.error || 'Invalid image');
          setIsLoading(false);
          return;
        }

        const url = URL.createObjectURL(imageFile);
        setImageUrl(url);

        // ✅ PERFORMANCE: Use createImageBitmap if available for faster loading
        if ('createImageBitmap' in window) {
          try {
            const bitmap = await createImageBitmap(imageFile);
            
            // Calculate initial state
            const initialState = calculateInitialState(bitmap.width, bitmap.height);
            setImageState(initialState);
            
            bitmap.close(); // Clean up memory
          } catch (error) {
            console.error('createImageBitmap failed, falling back to Image:', error);
            // Fallback to traditional method
            loadWithImageElement(url);
          }
        } else {
          loadWithImageElement(url);
        }

        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (error) {
        console.error('Image loading error:', error);
        setValidationError('Failed to load image');
      } finally {
        setIsLoading(false);
      }
    };

    const loadWithImageElement = (url: string) => {
      const img = new Image();
      img.onload = () => {
        const initialState = calculateInitialState(img.naturalWidth, img.naturalHeight);
        setImageState(initialState);
      };
      img.onerror = () => {
        setValidationError('Failed to load image');
      };
      img.src = url;
    };

    loadImage();
  }, [imageFile, isOpen, cropDimensions]);

  // ✅ PERFORMANCE: Memoized initial state calculation
  const calculateInitialState = useCallback((naturalWidth: number, naturalHeight: number): ImageState => {
    const minScaleForCropX = cropDimensions.width / naturalWidth;
    const minScaleForCropY = cropDimensions.height / naturalHeight;
    const minScaleForCrop = Math.max(minScaleForCropX, minScaleForCropY);
    
    const scaleToFitWidth = containerSize.width / naturalWidth;
    const scaleToFitHeight = containerSize.height / naturalHeight;
    const scaleToFitContainer = Math.min(scaleToFitWidth, scaleToFitHeight);
    
    const actualMinScale = Math.max(minScaleForCrop, Math.min(scaleToFitContainer, 1));
    const initialScale = actualMinScale;
    
    const scaledWidth = naturalWidth * initialScale;
    const scaledHeight = naturalHeight * initialScale;
    let initialX = (containerSize.width - scaledWidth) / 2;
    let initialY = (containerSize.height - scaledHeight) / 2;
    
    // Apply bounds checking
    const bounds = calculateBounds(initialX, initialY, scaledWidth, scaledHeight);
    
    return {
      naturalWidth,
      naturalHeight,
      x: bounds.x,
      y: bounds.y,
      scale: initialScale,
      minScale: actualMinScale,
      sliderValue: 0
    };
  }, [cropDimensions, containerSize]);

  // ✅ PERFORMANCE: Optimized bounds calculation
  const calculateBounds = useCallback((x: number, y: number, scaledWidth: number, scaledHeight: number) => {
    const { centerX, centerY, width, height } = cropDimensions;
    
    const cropLeft = centerX - x - width / 2;
    const cropRight = centerX - x + width / 2;
    const cropTop = centerY - y - height / 2;
    const cropBottom = centerY - y + height / 2;
    
    let newX = x;
    let newY = y;
    
    if (cropLeft < 0) {
      newX = centerX - width / 2;
    } else if (cropRight > scaledWidth) {
      newX = centerX + width / 2 - scaledWidth;
    }
    
    if (cropTop < 0) {
      newY = centerY - height / 2;
    } else if (cropBottom > scaledHeight) {
      newY = centerY + height / 2 - scaledHeight;
    }
    
    return { x: newX, y: newY };
  }, [cropDimensions]);

  // ✅ PERFORMANCE: Throttled mouse move with RAF
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      let newX = e.clientX - dragStart.x;
      let newY = e.clientY - dragStart.y;
      
      const scaledWidth = imageState.naturalWidth * imageState.scale;
      const scaledHeight = imageState.naturalHeight * imageState.scale;
      
      const bounds = calculateBounds(newX, newY, scaledWidth, scaledHeight);
      
      setImageState(prev => ({
        ...prev,
        x: bounds.x,
        y: bounds.y
      }));
    });
  }, [isDragging, dragStart, imageState.naturalWidth, imageState.scale, calculateBounds]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - imageState.x,
      y: e.clientY - imageState.y
    });
  }, [imageState.x, imageState.y]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  // ✅ PERFORMANCE: Optimized scale change with debouncing
  const handleScaleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseFloat(e.target.value);
    const minScale = imageState.minScale;
    const actualScale = minScale + (sliderValue / 100) * (MAX_SCALE - minScale);
    
    const oldScale = imageState.scale;
    if (oldScale === 0) return;
    
    const { centerX, centerY } = cropDimensions;
    
    // Calculate the point in the image that the crop center is currently viewing
    const imagePointX = (centerX - imageState.x) / oldScale;
    const imagePointY = (centerY - imageState.y) / oldScale;
    
    // Calculate new position to keep the same image point at crop center
    let newX = centerX - (imagePointX * actualScale);
    let newY = centerY - (imagePointY * actualScale);
    
    const newImageWidth = imageState.naturalWidth * actualScale;
    const newImageHeight = imageState.naturalHeight * actualScale;
    
    const bounds = calculateBounds(newX, newY, newImageWidth, newImageHeight);
    
    setImageState(prev => ({ 
      ...prev, 
      scale: actualScale,
      sliderValue: sliderValue,
      x: bounds.x,
      y: bounds.y
    }));
  }, [imageState, cropDimensions, calculateBounds]);

  const handleReset = useCallback(() => {
    if (imageState.naturalWidth && imageState.naturalHeight) {
      const resetState = calculateInitialState(imageState.naturalWidth, imageState.naturalHeight);
      setImageState(resetState);
    }
  }, [imageState.naturalWidth, imageState.naturalHeight, calculateInitialState]);

  // ✅ UPDATED: Optimized canvas rendering with proper 680x240 banner output
  const generateCroppedImage = useCallback((): string | null => {
    if (!imageRef.current) return null;

    try {
      // ✅ PERFORMANCE: Use OffscreenCanvas if available
      const useOffscreenCanvas = 'OffscreenCanvas' in window;
      let canvas: HTMLCanvasElement | OffscreenCanvas;
      let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

      if (cropType === 'circle') {
        // Circle output - square canvas
        if (useOffscreenCanvas) {
          canvas = new OffscreenCanvas(OUTPUT_SIZE, OUTPUT_SIZE);
          ctx = canvas.getContext('2d');
        } else {
          if (!canvasRef.current) return null;
          canvas = canvasRef.current;
          canvas.width = OUTPUT_SIZE;
          canvas.height = OUTPUT_SIZE;
          ctx = canvas.getContext('2d');
        }
      } else {
        // ✅ UPDATED: Banner output with exact 680x240 dimensions
        if (useOffscreenCanvas) {
          canvas = new OffscreenCanvas(BANNER_OUTPUT_WIDTH, BANNER_OUTPUT_HEIGHT);
          ctx = canvas.getContext('2d');
        } else {
          if (!canvasRef.current) return null;
          canvas = canvasRef.current;
          canvas.width = BANNER_OUTPUT_WIDTH;
          canvas.height = BANNER_OUTPUT_HEIGHT;
          ctx = canvas.getContext('2d');
        }
      }

      if (!ctx) return null;

      // Set high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (cropType === 'circle') {
        // Create circular clip
        ctx.beginPath();
        ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, 2 * Math.PI);
        ctx.clip();
      }

      // Calculate source area
      const { centerX, centerY, width, height } = cropDimensions;
      const sourceX = (centerX - imageState.x - width / 2) / imageState.scale;
      const sourceY = (centerY - imageState.y - height / 2) / imageState.scale;
      const sourceWidth = width / imageState.scale;
      const sourceHeight = height / imageState.scale;

      // Draw the cropped image
      if (cropType === 'circle') {
        const sourceSize = Math.min(sourceWidth, sourceHeight);
        ctx.drawImage(
          imageRef.current,
          sourceX, sourceY, sourceSize, sourceSize,
          0, 0, OUTPUT_SIZE, OUTPUT_SIZE
        );
      } else {
        // ✅ UPDATED: Banner with exact 300x140 output dimensions
        ctx.drawImage(
          imageRef.current,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, BANNER_OUTPUT_WIDTH, BANNER_OUTPUT_HEIGHT
        );
      }

      // Convert to data URL
      if (useOffscreenCanvas) {
        return (canvas as OffscreenCanvas).convertToBlob({ type: 'image/png', quality: 0.95 })
          .then(blob => {
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }) as any; // Type assertion for simplicity
      } else {
        return (canvas as HTMLCanvasElement).toDataURL('image/png', 0.95);
      }
    } catch (error) {
      console.error('Error generating cropped image:', error);
      return null;
    }
  }, [imageState, cropDimensions, cropType]);

  const handleApply = useCallback(async () => {
    try {
      const croppedImage = await generateCroppedImage();
      if (croppedImage) {
        onApply(croppedImage);
      }
    } catch (error) {
      console.error('Error applying crop:', error);
    }
    onClose();
  }, [generateCroppedImage, onApply, onClose]);

  // Event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  // ✅ PERFORMANCE: Memoized image style
  const imageStyle = useMemo((): React.CSSProperties => ({
    transform: `translate(${imageState.x}px, ${imageState.y}px) scale(${imageState.scale})`,
    transformOrigin: 'top left',
    width: imageState.naturalWidth ? `${imageState.naturalWidth}px` : 'auto',
    height: imageState.naturalHeight ? `${imageState.naturalHeight}px` : 'auto',
    maxWidth: 'none',
    maxHeight: 'none',
    willChange: isDragging ? 'transform' : 'auto', // Optimize for dragging
  }), [imageState, isDragging]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div className="window" style={{ width: '700px', height: '600px' }}>
        <div className="title-bar">
          <div className="title-bar-text">{title}</div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={onClose}></button>
          </div>
        </div>
        
        <div className="window-body" style={{ height: 'calc(100% - 33px)', display: 'flex', flexDirection: 'column' }}>
          {/* Loading State */}
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <div className="text-sm text-gray-600">Loading image...</div>
              </div>
            </div>
          )}

          {/* Error State */}
          {validationError && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-red-600">
                <div className="text-lg mb-2">⚠️</div>
                <div className="text-sm">{validationError}</div>
                <button className="btn mt-2" onClick={onClose}>Close</button>
              </div>
            </div>
          )}

          {/* Image Container */}
          {!isLoading && !validationError && imageUrl && (
            <>
              <div className="flex-1 flex items-center justify-center p-4">
                <div 
                  ref={containerRef}
                  className="relative border-2 border-gray-400 overflow-hidden"
                  style={{ 
                    width: `${containerSize.width}px`, 
                    height: `${containerSize.height}px`,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    backgroundColor: '#000000'
                  }}
                  onMouseDown={handleMouseDown}
                >
                  {/* Image */}
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Edit"
                    className="absolute top-0 left-0 select-none"
                    style={imageStyle}
                    onDragStart={(e) => e.preventDefault()}
                  />
                  
                  {/* Crop overlay */}
                  {cropType === 'circle' ? (
                    <>
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(circle at center, transparent ${cropDimensions.radius}px, rgba(0,0,0,0.6) ${cropDimensions.radius + 5}px)`
                        }}
                      />
                      <div 
                        className="absolute border-4 border-white rounded-full pointer-events-none"
                        style={{
                          width: `${cropDimensions.width}px`,
                          height: `${cropDimensions.height}px`,
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                    </>
                  ) : (
                    <>
                      {/* ✅ UPDATED: Banner overlay with 300:140 aspect ratio */}
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `linear-gradient(
                            to bottom,
                            rgba(0,0,0,0.6) 0%,
                            rgba(0,0,0,0.6) ${50 - (cropDimensions.height / containerSize.height) * 50}%,
                            transparent ${50 - (cropDimensions.height / containerSize.height) * 50}%,
                            transparent ${50 + (cropDimensions.height / containerSize.height) * 50}%,
                            rgba(0,0,0,0.6) ${50 + (cropDimensions.height / containerSize.height) * 50}%,
                            rgba(0,0,0,0.6) 100%
                          )`
                        }}
                      />
                      <div 
                        className="absolute border-4 border-white pointer-events-none"
                        style={{
                          width: `${cropDimensions.width}px`,
                          height: `${cropDimensions.height}px`,
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                      {/* ✅ UPDATED: Banner crop info with 300x140 dimensions */}
                      <div 
                        className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded pointer-events-none"
                      >
                        Banner: 300×140 (Output: {BANNER_OUTPUT_WIDTH}×{BANNER_OUTPUT_HEIGHT})
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Size Slider */}
              <div className="p-4 border-t border-gray-400">
                <div className="field-row" style={{ width: '100%', maxWidth: '300px', margin: '0 auto' }}>
                  <label htmlFor="size-slider">Size:</label>
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-xs">Small</label>
                    <input 
                      id="size-slider"
                      type="range" 
                      min="0"
                      max="100" 
                      step="1"
                      value={imageState.sliderValue}
                      onChange={handleScaleChange}
                      className="flex-1"
                    />
                    <label className="text-xs">Large</label>
                  </div>
                  <div className="text-xs text-gray-600 mt-1 text-center">
                    Zoom: {Math.round(imageState.scale * 100)}% • Quality: High • Output: {cropType === 'banner' ? '300×140' : '200×200'}
                  </div>
                </div>
              </div>
              
              {/* Buttons */}
              <div className="flex justify-between items-center p-4 border-t border-gray-400">
                <button className="btn" onClick={handleReset}>
                  Reset
                </button>
                
                <div className="flex gap-2">
                  <button className="btn" onClick={onClose}>
                    Cancel
                  </button>
                  <button 
                    className="btn" 
                    onClick={handleApply}
                    style={{ fontWeight: 'bold' }}
                    disabled={!imageState.naturalWidth}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .field-row {
          margin-bottom: 8px;
        }
        
        .field-row label {
          display: block;
          font-size: 11px;
          font-weight: bold;
        }
        
        .field-row input[type="range"] {
          width: 100%;
        }
        
        .btn {
          padding: 4px 12px;
          font-size: 11px;
        }
        
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .flex {
          display: flex;
        }
        
        .flex-1 {
          flex: 1 1 0%;
        }
        
        .items-center {
          align-items: center;
        }
        
        .justify-center {
          justify-content: center;
        }
        
        .justify-between {
          justify-content: space-between;
        }
        
        .gap-2 {
          gap: 8px;
        }
        
        .p-4 {
          padding: 16px;
        }
        
        .mt-2 {
          margin-top: 8px;
        }
        
        .mb-2 {
          margin-bottom: 8px;
        }
        
        .mx-auto {
          margin-left: auto;
          margin-right: auto;
        }
        
        .border-t {
          border-top-width: 1px;
        }
        
        .border-2 {
          border-width: 2px;
        }
        
        .border-4 {
          border-width: 4px;
        }
        
        .border-gray-400 {
          border-color: #9ca3af;
        }
        
        .border-white {
          border-color: white;
        }
        
        .rounded-full {
          border-radius: 9999px;
        }
        
        .overflow-hidden {
          overflow: hidden;
        }
        
        .absolute {
          position: absolute;
        }
        
        .relative {
          position: relative;
        }
        
        .inset-0 {
          inset: 0;
        }
        
        .top-0 {
          top: 0;
        }
        
        .left-0 {
          left: 0;
        }
        
        .pointer-events-none {
          pointer-events: none;
        }
        
        .select-none {
          user-select: none;
        }
        
        .text-xs {
          font-size: 10px;
        }
        
        .text-sm {
          font-size: 12px;
        }
        
        .text-lg {
          font-size: 18px;
        }
        
        .text-center {
          text-align: center;
        }
        
        .text-gray-600 {
          color: #4b5563;
        }
        
        .text-red-600 {
          color: #dc2626;
        }
        
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 20px;
          background: #c0c0c0;
          border: 2px inset #c0c0c0;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: #c0c0c0;
          border: 2px outset #c0c0c0;
          cursor: pointer;
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #c0c0c0;
          border: 2px outset #c0c0c0;
          cursor: pointer;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Performance optimizations */
        img {
          transform-origin: top left;
          backface-visibility: hidden;
          perspective: 1000px;
        }

        /* Smooth dragging */
        .absolute img {
          will-change: transform;
        }
      `}</style>
    </div>
  );
};