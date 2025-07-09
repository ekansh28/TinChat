// src/components/ProfileCustomizer/components/ImageEditor.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (croppedImageData: string) => void;
  imageFile: File;
  title?: string;
}

interface ImageState {
  x: number;
  y: number;
  scale: number;
  naturalWidth: number;
  naturalHeight: number;
  minScale: number; // Add minimum scale for this image
  sliderValue: number; // Add slider value (0-100)
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  isOpen,
  onClose,
  onApply,
  imageFile,
  title = "Edit Image"
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
  const [containerSize, setContainerSize] = useState({ width: 400, height: 400 });
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize image URL and calculate container size
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageUrl(url);
      
      // Load image to get natural dimensions
      const img = new Image();
      img.onload = () => {
        // Calculate container size - always 400x400 for consistent circle size
        const containerWidth = 400;
        const containerHeight = 400;
        
        // Circle properties (30% smaller)
        const circleRadius = ((Math.min(containerWidth, containerHeight) / 2) - 10) * 0.7;
        
        // Calculate minimum scale needed for circle to fit in image
        const minScaleForCircleX = (circleRadius * 2) / img.naturalWidth;
        const minScaleForCircleY = (circleRadius * 2) / img.naturalHeight;
        const minScaleForCircle = Math.max(minScaleForCircleX, minScaleForCircleY);
        
        // Calculate scale to fit entire image in container  
        const scaleToFitWidth = containerWidth / img.naturalWidth;
        const scaleToFitHeight = containerHeight / img.naturalHeight;
        const scaleToFitContainer = Math.min(scaleToFitWidth, scaleToFitHeight);
        
        // The minimum scale we'll actually use (for the image to work properly)
        const actualMinScale = Math.max(minScaleForCircle, Math.min(scaleToFitContainer, 1));
        
        // Always start with slider at 0, but use the actual minimum scale for the image
        const initialScale = actualMinScale;
        
        // Calculate initial position to center the scaled image
        const scaledWidth = img.naturalWidth * initialScale;
        const scaledHeight = img.naturalHeight * initialScale;
        let initialX = (containerWidth - scaledWidth) / 2;
        let initialY = (containerHeight - scaledHeight) / 2;
        
        // Apply bounds checking for circle (but allow movement if image is larger)
        const circleCenterX = containerWidth / 2;
        const circleCenterY = containerHeight / 2;
        
        // Only constrain position if the image at minimum scale would put circle out of bounds
        const circleLeft = circleCenterX - initialX - circleRadius;
        const circleRight = circleCenterX - initialX + circleRadius;
        const circleTop = circleCenterY - initialY - circleRadius;
        const circleBottom = circleCenterY - initialY + circleRadius;
        
        // Check if we need to adjust position
        let needsXAdjustment = circleLeft < 0 || circleRight > scaledWidth;
        let needsYAdjustment = circleTop < 0 || circleBottom > scaledHeight;
        
        // Only adjust if necessary, and allow movement room when possible
        if (needsXAdjustment) {
          if (circleLeft < 0) {
            initialX = circleCenterX - circleRadius;
          } else if (circleRight > scaledWidth) {
            initialX = circleCenterX + circleRadius - scaledWidth;
          }
        }
        
        if (needsYAdjustment) {
          if (circleTop < 0) {
            initialY = circleCenterY - circleRadius;
          } else if (circleBottom > scaledHeight) {
            initialY = circleCenterY + circleRadius - scaledHeight;
          }
        }
        
        setContainerSize({ width: containerWidth, height: containerHeight });
        setImageState({
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          x: initialX,
          y: initialY,
          scale: initialScale,
          minScale: actualMinScale,
          sliderValue: 0 // Always start slider at 0
        });
      };
      img.src = url;
      
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      const { naturalWidth, naturalHeight } = imageRef.current;
      setImageState(prev => ({
        ...prev,
        naturalWidth,
        naturalHeight
      }));
    }
  }, []);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - imageState.x,
      y: e.clientY - imageState.y
    });
  }, [imageState.x, imageState.y]);

  // Handle mouse move for dragging - simplified bounds checking
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    let newX = e.clientX - dragStart.x;
    let newY = e.clientY - dragStart.y;
    
    // Calculate image dimensions at current scale
    const scaledWidth = imageState.naturalWidth * imageState.scale;
    const scaledHeight = imageState.naturalHeight * imageState.scale;
    
    // Circle properties
    const circleCenterX = containerSize.width / 2;
    const circleCenterY = containerSize.height / 2;
    const circleRadius = ((Math.min(containerSize.width, containerSize.height) / 2) - 10) * 0.7;
    
    // Simple bounds checking - only ensure circle stays within image
    const circleLeft = circleCenterX - newX - circleRadius;
    const circleRight = circleCenterX - newX + circleRadius;
    const circleTop = circleCenterY - newY - circleRadius;
    const circleBottom = circleCenterY - newY + circleRadius;
    
    // Constrain only if circle goes outside image bounds
    if (circleLeft < 0) {
      newX = circleCenterX - circleRadius;
    } else if (circleRight > scaledWidth) {
      newX = circleCenterX + circleRadius - scaledWidth;
    }
    
    if (circleTop < 0) {
      newY = circleCenterY - circleRadius;
    } else if (circleBottom > scaledHeight) {
      newY = circleCenterY + circleRadius - scaledHeight;
    }
    
    setImageState(prev => ({
      ...prev,
      x: newX,
      y: newY
    }));
  }, [isDragging, dragStart, imageState.naturalWidth, imageState.scale, containerSize]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add event listeners for mouse events
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle scale change with slider mapping
  const handleScaleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseFloat(e.target.value);
    
    // Map slider value (0-100) to actual scale range (minScale to 3x)
    const minScale = imageState.minScale;
    const maxScale = 3;
    const actualScale = minScale + (sliderValue / 100) * (maxScale - minScale);
    
    // Use the existing zoom-from-circle logic
    const oldScale = imageState.scale;
    
    if (oldScale === 0) return;
    
    // Fixed circle center (always at container center)
    const circleCenterX = containerSize.width / 2;
    const circleCenterY = containerSize.height / 2;
    const circleRadius = ((Math.min(containerSize.width, containerSize.height) / 2) - 10) * 0.7;
    
    // Calculate the point in the image that the circle center is currently viewing
    const imagePointX = (circleCenterX - imageState.x) / oldScale;
    const imagePointY = (circleCenterY - imageState.y) / oldScale;
    
    // Calculate new position to keep the same image point at circle center
    let newX = circleCenterX - (imagePointX * actualScale);
    let newY = circleCenterY - (imagePointY * actualScale);
    
    // Calculate new image dimensions
    const newImageWidth = imageState.naturalWidth * actualScale;
    const newImageHeight = imageState.naturalHeight * actualScale;
    
    // Apply bounds checking (but less restrictive than before)
    const circleLeft = circleCenterX - newX - circleRadius;
    const circleRight = circleCenterX - newX + circleRadius;
    const circleTop = circleCenterY - newY - circleRadius;
    const circleBottom = circleCenterY - newY + circleRadius;
    
    // Only constrain if circle actually goes outside image
    if (circleLeft < 0) {
      newX = circleCenterX - circleRadius;
    } else if (circleRight > newImageWidth) {
      newX = circleCenterX + circleRadius - newImageWidth;
    }
    
    if (circleTop < 0) {
      newY = circleCenterY - circleRadius;
    } else if (circleBottom > newImageHeight) {
      newY = circleCenterY + circleRadius - newImageHeight;
    }
    
    setImageState(prev => ({ 
      ...prev, 
      scale: actualScale,
      sliderValue: sliderValue,
      x: newX,
      y: newY
    }));
  }, [imageState, containerSize]);

  // Reset to default position and scale
  const handleReset = useCallback(() => {
    if (imageState.naturalWidth && imageState.naturalHeight) {
      // Reset to original minimum scale and centered position
      const minScale = imageState.minScale;
      
      const scaledWidth = imageState.naturalWidth * minScale;
      const scaledHeight = imageState.naturalHeight * minScale;
      const initialX = (containerSize.width - scaledWidth) / 2;
      const initialY = (containerSize.height - scaledHeight) / 2;
      
      setImageState(prev => ({
        ...prev,
        x: initialX,
        y: initialY,
        scale: minScale,
        sliderValue: 0 // Reset slider to 0
      }));
    }
  }, [imageState.naturalWidth, imageState.naturalHeight, imageState.minScale, containerSize]);

  // Generate cropped image
  const generateCroppedImage = useCallback(() => {
    if (!canvasRef.current || !imageRef.current) return null;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Set canvas size to desired output size (circular crop)
    const outputSize = 200; // Final avatar size
    canvas.width = outputSize;
    canvas.height = outputSize;
    
    // Fixed circle radius (30% smaller than before)
    const originalRadius = (Math.min(containerSize.width, containerSize.height) / 2) - 10;
    const circleRadius = originalRadius * 0.7; // 30% smaller
    const circleCenterX = containerSize.width / 2;
    const circleCenterY = containerSize.height / 2;
    
    // Calculate the source area (what's visible in the circle) in image coordinates
    const sourceX = (circleCenterX - imageState.x - circleRadius) / imageState.scale;
    const sourceY = (circleCenterY - imageState.y - circleRadius) / imageState.scale;
    const sourceSize = (circleRadius * 2) / imageState.scale;
    
    // Fill with black background first
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, outputSize, outputSize);
    
    // Create circular clip
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, 2 * Math.PI);
    ctx.clip();
    
    // Clear the circle area (removes black background in circle)
    ctx.clearRect(0, 0, outputSize, outputSize);
    
    // Draw the cropped image
    ctx.drawImage(
      imageRef.current,
      sourceX, sourceY, sourceSize, sourceSize,
      0, 0, outputSize, outputSize
    );
    
    return canvas.toDataURL('image/png');
  }, [imageState, containerSize]);

  // Handle apply button
  const handleApply = useCallback(() => {
    const croppedImage = generateCroppedImage();
    if (croppedImage) {
      onApply(croppedImage);
    }
    onClose();
  }, [generateCroppedImage, onApply, onClose]);

  // Calculate image style
  const imageStyle = {
    transform: `translate(${imageState.x}px, ${imageState.y}px) scale(${imageState.scale})`,
    transformOrigin: 'top left',
    width: imageState.naturalWidth ? `${imageState.naturalWidth}px` : 'auto',
    height: imageState.naturalHeight ? `${imageState.naturalHeight}px` : 'auto',
    maxWidth: 'none',
    maxHeight: 'none'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div className="window" style={{ width: '500px', height: '600px' }}>
        <div className="title-bar">
          <div className="title-bar-text">{title}</div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={onClose}></button>
          </div>
        </div>
        
        <div className="window-body" style={{ height: 'calc(100% - 33px)', display: 'flex', flexDirection: 'column' }}>
          {/* Image Container */}
          <div className="flex-1 flex items-center justify-center p-4">
            <div 
              ref={containerRef}
              className="relative border-2 border-gray-400 overflow-hidden"
              style={{ 
                width: `${containerSize.width}px`, 
                height: `${containerSize.height}px`,
                cursor: isDragging ? 'grabbing' : 'grab',
                backgroundColor: '#000000' // Black background for out-of-bounds areas
              }}
              onMouseDown={handleMouseDown}
            >
              {/* Image */}
              {imageUrl && (
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Edit"
                  className="absolute top-0 left-0 select-none"
                  style={imageStyle}
                  onLoad={handleImageLoad}
                  onDragStart={(e) => e.preventDefault()}
                />
              )}
              
              {/* Fixed Circle Overlay - never changes size or position - 30% smaller */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at center, transparent ${((Math.min(containerSize.width, containerSize.height) / 2) - 10) * 0.7}px, rgba(0,0,0,0.6) ${(((Math.min(containerSize.width, containerSize.height) / 2) - 10) * 0.7) + 5}px)`
                }}
              />
              
              {/* Fixed Circle Border - never changes size or position - 30% smaller */}
              <div 
                className="absolute border-4 border-white rounded-full pointer-events-none"
                style={{
                  width: `${(Math.min(containerSize.width, containerSize.height) - 20) * 0.7}px`,
                  height: `${(Math.min(containerSize.width, containerSize.height) - 20) * 0.7}px`,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              />
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
                Zoom: {Math.round(imageState.scale * 100)}% (Slider: {Math.round(imageState.sliderValue)})
              </div>
            </div>
          </div>
          
          {/* Buttons */}
          <div className="flex justify-between items-center p-4 border-t border-gray-400">
            <button 
              className="btn" 
              onClick={handleReset}
            >
              Reset
            </button>
            
            <div className="flex gap-2">
              <button 
                className="btn" 
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                onClick={handleApply}
                style={{ fontWeight: 'bold' }}
              >
                Apply
              </button>
            </div>
          </div>
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
      `}</style>
    </div>
  );
};