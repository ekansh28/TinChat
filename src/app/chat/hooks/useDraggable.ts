// src/app/chat/hooks/useDraggable.ts - Constrained to parent container
import { useState, useCallback, useRef, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  disabled?: boolean;
  containerRef?: React.RefObject<HTMLElement>; // Reference to the container to constrain within
}

export const useDraggable = (options: UseDraggableOptions = {}) => {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLElement>(null);
  const dragState = useRef({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    isDragging: false
  });

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (options.disabled) {
      return;
    }
    
    // Only start dragging if clicking on the handle
    if (handleRef.current && !handleRef.current.contains(e.target as Node)) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();

    const rect = dragRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      isDragging: true
    };

    setIsDragging(true);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, [position, options.disabled]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.current.isDragging) return;
    
    e.preventDefault();

    const deltaX = e.clientX - dragState.current.startX;
    const deltaY = e.clientY - dragState.current.startY;

    let newX = dragState.current.initialX + deltaX;
    let newY = dragState.current.initialY + deltaY;

    // Get container bounds if containerRef is provided
    if (options.containerRef && options.containerRef.current && dragRef.current) {
      const containerRect = options.containerRef.current.getBoundingClientRect();
      const elementRect = dragRef.current.getBoundingClientRect();
      
      // Calculate the maximum positions to keep element within container
      const maxX = containerRect.width - elementRect.width;
      const maxY = containerRect.height - elementRect.height;
      
      // Constrain to container bounds
      newX = Math.max(0, Math.min(maxX, newX));
      newY = Math.max(0, Math.min(maxY, newY));
    }

    setPosition({ x: newX, y: newY });
  }, [options.containerRef]);

  const handleMouseUp = useCallback(() => {
    if (dragState.current.isDragging) {
      dragState.current.isDragging = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, []);

  // Set up event listeners
  useEffect(() => {
    const handleElement = handleRef.current;
    
    if (!handleElement || options.disabled) return;

    handleElement.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      handleElement.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, options.disabled]);

  const reset = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  // Center the element within its container
  const centerInContainer = useCallback(() => {
    if (options.containerRef && options.containerRef.current && dragRef.current) {
      const containerRect = options.containerRef.current.getBoundingClientRect();
      const elementRect = dragRef.current.getBoundingClientRect();
      
      // Ensure we have valid dimensions
      if (containerRect.width > 0 && containerRect.height > 0 && elementRect.width > 0 && elementRect.height > 0) {
        const centerX = Math.max(0, (containerRect.width - elementRect.width) / 2);
        const centerY = Math.max(0, (containerRect.height - elementRect.height) / 2);
        
        // Ensure position is within bounds
        const maxX = Math.max(0, containerRect.width - elementRect.width);
        const maxY = Math.max(0, containerRect.height - elementRect.height);
        
        const finalX = Math.max(0, Math.min(centerX, maxX));
        const finalY = Math.max(0, Math.min(centerY, maxY));
        
        setPosition({ x: finalX, y: finalY });
        setIsInitialized(true);
      }
    }
  }, [options.containerRef]);

  // Reset to center position
  const resetToCenter = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    // Keep initialized true to prevent opacity flash
    // Center will be called from the parent component
  }, []);

  return {
    position,
    isDragging,
    dragRef,
    handleRef,
    reset,
    setPosition,
    centerInContainer,
    resetToCenter,
    isInitialized
  };
};