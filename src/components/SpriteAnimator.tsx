'use client';
import React, { useState, useEffect, useRef } from 'react';

export const SimpleSpriteAnimator: React.FC<{
  src: string;
  frameCount: number;
  progress: number;
  columns: number;
  rows: number;
  frameWidth: number;   // Width of a single frame (e.g. 272)
  frameHeight: number;  // Height of a single frame (e.g. 60)
  pixelated?: boolean;
  className?: string;
  animationSpeed?: number; // frames per second for smooth transitions
}> = ({
  src,
  frameCount,
  progress,
  columns,
  rows,
  frameWidth,
  frameHeight,
  pixelated = true,
  className,
  animationSpeed = 30, // default 30 fps
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<NodeJS.Timeout>();
  const lastProgressRef = useRef(progress);

  // Compute full sprite sheet dimensions
  const sheetWidth = frameWidth * columns;
  const sheetHeight = frameHeight * rows;

  // Clamp progress between 0–100
  const safeProgress = Math.max(0, Math.min(100, progress));

  // Convert progress to target frame index
  const targetFrame = Math.min(
    Math.floor((safeProgress / 100) * frameCount),
    frameCount - 1
  );

  useEffect(() => {
    const lastProgress = lastProgressRef.current;
    const lastTargetFrame = Math.min(
      Math.floor((lastProgress / 100) * frameCount),
      frameCount - 1
    );

    // If target frame is different from current, animate to it
    if (targetFrame !== lastTargetFrame && targetFrame !== currentFrame) {
      setIsAnimating(true);
      
      const startFrame = currentFrame;
      const endFrame = targetFrame;
      const totalFrames = Math.abs(endFrame - startFrame);
      const direction = endFrame > startFrame ? 1 : -1;
      
      let frameIndex = 0;
      const frameInterval = 1000 / animationSpeed; // milliseconds per frame
      
      const animate = () => {
        if (frameIndex <= totalFrames) {
          const newFrame = startFrame + (frameIndex * direction);
          setCurrentFrame(newFrame);
          frameIndex++;
          
          animationRef.current = setTimeout(animate, frameInterval);
        } else {
          setIsAnimating(false);
          setCurrentFrame(endFrame);
        }
      };
      
      animate();
    } else if (!isAnimating && targetFrame !== currentFrame) {
      // Direct jump if no animation is needed or for initial load
      setCurrentFrame(targetFrame);
    }

    lastProgressRef.current = safeProgress;

    // Cleanup animation on unmount or when effect re-runs
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [targetFrame, frameCount, animationSpeed, currentFrame, isAnimating, safeProgress]);

  // Vertical offset based on current frame
  const offsetY = -(currentFrame * frameHeight);

  return (
    <div
      className={className}
      style={{
        width: `${frameWidth}px`,
        height: `${frameHeight}px`,
        backgroundImage: `url(${src})`,
        backgroundPosition: `0px ${offsetY}px`,
        imageRendering: pixelated ? 'pixelated' : 'auto',
        overflow: 'hidden',
        display: 'block',
        position: 'relative',
      }}
      title={`Progress: ${safeProgress}% | Frame: ${currentFrame} of ${frameCount }`}
    />
  );
};

export default SimpleSpriteAnimator;