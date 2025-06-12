// src/components/ProfileCustomizer/hooks/useEasyMode.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { GRID_SIZE } from '../utils/constants';
import type { 
  EasyCustomization,
  ContextMenuState,
  TypographyPopupState,
  DragState,
  ResizeHandle,
  TypographyOptions
} from '../types';

interface UseEasyModeProps {
  cssMode: 'custom' | 'easy';
  easyCustomization: EasyCustomization;
  setEasyCustomization: React.Dispatch<React.SetStateAction<EasyCustomization>>;
  positionMode: 'normal' | 'grid';
}

export const useEasyMode = ({ 
  cssMode, 
  easyCustomization, 
  setEasyCustomization,
  positionMode 
}: UseEasyModeProps) => {
  // Selection and interaction states
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [dragStart, setDragStart] = useState<DragState>({ 
    x: 0, y: 0, elementX: 0, elementY: 0, elementWidth: 0, elementHeight: 0 
  });
  
  // UI states
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [typographyPopup, setTypographyPopup] = useState<TypographyPopupState | null>(null);
  
  // Refs for stable references and performance
  const typographyPopupRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const lastMouseMoveRef = useRef<number>(0);
  const previewRef = useRef<HTMLDivElement>(null);

  // Grid snap helper function
  const snapToGrid = useCallback((value: number) => {
    if (positionMode === 'grid') {
      return Math.round(value / GRID_SIZE) * GRID_SIZE;
    }
    return value;
  }, [positionMode]);

  // Multi-select helper functions
  const isElementSelected = useCallback((element: string) => {
    return selectedElements.includes(element);
  }, [selectedElements]);

  const toggleElementSelection = useCallback((element: string, shiftKey: boolean) => {
    if (shiftKey) {
      if (isElementSelected(element)) {
        setSelectedElements(prev => prev.filter(el => el !== element));
      } else {
        setSelectedElements(prev => [...prev, element]);
      }
    } else {
      setSelectedElements([element]);
      setSelectedElement(element);
    }
  }, [isElementSelected]);

  // Dynamic constraint calculation
  const calculateConstraints = useCallback((containerRef?: React.RefObject<HTMLElement>) => {
    let bounds = {
      minX: -50,
      maxX: 250,
      minY: -50,
      maxY: 450
    };
    
    if (containerRef?.current) {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      
      // Calculate dynamic bounds based on container size
      bounds = {
        minX: -Math.min(50, rect.width * 0.1),
        maxX: rect.width - 50,
        minY: -Math.min(50, rect.height * 0.1),
        maxY: rect.height - 50
      };
    }
    
    return bounds;
  }, []);

  // Enhanced position constraint
  const constrainPosition = useCallback((
    x: number, 
    y: number, 
    containerRef?: React.RefObject<HTMLElement>
  ) => {
    const bounds = calculateConstraints(containerRef);
    
    const constrainedX = Math.max(bounds.minX, Math.min(bounds.maxX, x));
    const constrainedY = Math.max(bounds.minY, Math.min(bounds.maxY, y));
    
    return { x: constrainedX, y: constrainedY };
  }, [calculateConstraints]);

  // Separate resize and drag handlers for better performance
  const handleResize = useCallback((e: React.MouseEvent, dragState: DragState) => {
    if (!selectedElement || !resizeHandle) return;

    const deltaX = e.clientX - dragState.x;
    const deltaY = e.clientY - dragState.y;
    
    const element = easyCustomization.elements[selectedElement];
    if (!element) return;

    let newScale = element.scale || 1;
    let scaleChange = 0;
    
    // Calculate scale change based on resize handle
    switch (resizeHandle) {
      case 'e':
      case 'w':
        scaleChange = deltaX / 200;
        break;
      case 'n':
      case 's':
        scaleChange = deltaY / 200;
        break;
      case 'nw':
        scaleChange = -(deltaX + deltaY) / 400;
        break;
      case 'ne':
        scaleChange = (-deltaX + deltaY) / 400;
        break;
      case 'sw':
        scaleChange = (deltaX - deltaY) / 400;
        break;
      case 'se':
        scaleChange = (deltaX + deltaY) / 400;
        break;
    }
    
    newScale = Math.max(0.1, Math.min(3, element.scale + scaleChange));
    
    setEasyCustomization(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [selectedElement]: {
          ...prev.elements[selectedElement],
          scale: newScale
        }
      }
    }));
  }, [selectedElement, resizeHandle, easyCustomization.elements, setEasyCustomization]);

  const handleDrag = useCallback((e: React.MouseEvent, dragState: DragState) => {
    const deltaX = e.clientX - dragState.x;
    const deltaY = e.clientY - dragState.y;
    
    const elementsToUpdate = selectedElements.length > 0 ? selectedElements : [selectedElement!];
    
    setEasyCustomization(prev => {
      const newElements = { ...prev.elements };
      
      elementsToUpdate.forEach(element => {
        if (element && newElements[element]) {
          const currentElement = newElements[element];
          const newX = snapToGrid(dragState.elementX + deltaX);
          const newY = snapToGrid(dragState.elementY + deltaY);
          
          // Use dynamic constraints
          const constrained = constrainPosition(newX, newY, previewRef);
          
          newElements[element] = {
            ...currentElement,
            x: constrained.x,
            y: constrained.y,
          };
        }
      });
      
      return {
        ...prev,
        elements: newElements
      };
    });
  }, [selectedElement, selectedElements, snapToGrid, constrainPosition, setEasyCustomization]);

  // Enhanced mouse move handler with performance optimization
  const handlePreviewMouseMove = useCallback((e: React.MouseEvent) => {
    if (cssMode !== 'easy' || (!isDraggingRef.current && !isResizingRef.current)) return;

    // Throttle mouse move events for performance (~60fps)
    if (Date.now() - (lastMouseMoveRef.current || 0) < 16) return;
    lastMouseMoveRef.current = Date.now();

    e.preventDefault();
    
    const currentDragState = dragStateRef.current;
    if (!currentDragState) return;

    if (isResizingRef.current && selectedElement && resizeHandle) {
      handleResize(e, currentDragState);
    } else if (isDraggingRef.current) {
      handleDrag(e, currentDragState);
    }
  }, [cssMode, selectedElement, resizeHandle, handleResize, handleDrag]);

  // Mouse event handlers
  const handlePreviewMouseDown = useCallback((e: React.MouseEvent, element: string) => {
    if (cssMode !== 'easy') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    // Check if clicking on resize handle
    const target = e.target as HTMLElement;
    if (target.classList.contains('resize-handle')) {
      const handle = target.dataset.handle as ResizeHandle;
      setIsResizing(true);
      setResizeHandle(handle);
      setSelectedElement(element);
      isResizingRef.current = true;
      
      const currentElement = easyCustomization.elements[element] || { 
        x: 0, y: 0, scale: 1, width: 0, height: 0, visible: true 
      };
      
      const initialDragState = { 
        x: clientX, 
        y: clientY,
        elementX: currentElement.x,
        elementY: currentElement.y,
        elementWidth: currentElement.width || rect.width,
        elementHeight: currentElement.height || rect.height
      };
      
      setDragStart(initialDragState);
      dragStateRef.current = initialDragState;
      return;
    }

    // Handle regular drag
    toggleElementSelection(element, e.shiftKey);
    setIsDragging(true);
    isDraggingRef.current = true;
    
    const currentElement = easyCustomization.elements[element] || { 
      x: 0, y: 0, scale: 1, visible: true 
    };
    
    const initialDragState = { 
      x: clientX, 
      y: clientY,
      elementX: currentElement.x,
      elementY: currentElement.y,
      elementWidth: currentElement.width || 0,
      elementHeight: currentElement.height || 0
    };
    
    setDragStart(initialDragState);
    dragStateRef.current = initialDragState;
  }, [cssMode, easyCustomization.elements, toggleElementSelection]);

  const handlePreviewMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    isDraggingRef.current = false;
    isResizingRef.current = false;
    dragStateRef.current = null;
  }, []);

  // Context menu handler
  const handlePreviewContextMenu = useCallback((e: React.MouseEvent, element: string) => {
    if (cssMode !== 'easy') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 150);
    
    setContextMenu({ x, y, element });
  }, [cssMode]);

  // Typography popup handler
  const handleTextElementRightClick = useCallback((e: React.MouseEvent, element: string) => {
    if (cssMode !== 'easy') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const textElements = ['profile-display-name', 'profile-username', 'profile-bio', 'profile-pronouns'];
    if (textElements.includes(element)) {
      const currentElement = easyCustomization.elements[element];
      
      const x = Math.min(e.clientX + 10, window.innerWidth - 300);
      const y = Math.min(e.clientY + 10, window.innerHeight - 400);
      
      setTypographyPopup({
        x,
        y,
        element,
        options: {
          textAlign: 'left',
          fontFamily: currentElement?.fontFamily || 'default',
          fontSize: currentElement?.fontSize || 16,
          borderWidth: 0,
          borderColor: '#000000',
          bold: false,
          italic: false,
          underline: false,
          textColor: currentElement?.color || '#ffffff',
          lineSpacing: 1.5,
          paragraphSpacing: 16
        }
      });
    } else {
      handlePreviewContextMenu(e, element);
    }
  }, [cssMode, easyCustomization.elements, handlePreviewContextMenu]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't close if clicking on color picker or typography popup
      if (target.closest('input[type="color"]') || target.closest('.typography-popup')) {
        return;
      }
      
      setContextMenu(null);
      
      if (typographyPopupRef.current && !typographyPopupRef.current.contains(target)) {
        setTypographyPopup(null);
      }
    };

    if (contextMenu || typographyPopup) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu, typographyPopup]);

  // Global mouse up handler for better drag experience
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current || isResizingRef.current) {
        handlePreviewMouseUp();
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current || isResizingRef.current) {
        // Convert native mouse event to React mouse event format
        const syntheticEvent = {
          clientX: e.clientX,
          clientY: e.clientY,
          preventDefault: () => e.preventDefault()
        } as React.MouseEvent;
        handlePreviewMouseMove(syntheticEvent);
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseleave', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseleave', handleGlobalMouseUp);
      };
    }
  }, [isDragging, isResizing, handlePreviewMouseUp, handlePreviewMouseMove]);

  // Keyboard handlers for better UX
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (cssMode !== 'easy') return;

      // Escape key to deselect
      if (e.key === 'Escape') {
        setSelectedElement(null);
        setSelectedElements([]);
        setContextMenu(null);
        setTypographyPopup(null);
      }

      // Delete key to hide elements
      if (e.key === 'Delete' && (selectedElement || selectedElements.length > 0)) {
        const elementsToHide = selectedElements.length > 0 ? selectedElements : [selectedElement!];
        
        setEasyCustomization(prev => {
          const newElements = { ...prev.elements };
          elementsToHide.forEach(element => {
            if (element && newElements[element]) {
              newElements[element] = {
                ...newElements[element],
                visible: false
              };
            }
          });
          return {
            ...prev,
            elements: newElements
          };
        });
      }

      // Arrow keys for fine positioning
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && 
          (selectedElement || selectedElements.length > 0)) {
        e.preventDefault();
        
        const step = e.shiftKey ? GRID_SIZE : 1;
        const elementsToMove = selectedElements.length > 0 ? selectedElements : [selectedElement!];
        
        setEasyCustomization(prev => {
          const newElements = { ...prev.elements };
          
          elementsToMove.forEach(element => {
            if (element && newElements[element]) {
              const currentElement = newElements[element];
              let newX = currentElement.x;
              let newY = currentElement.y;
              
              switch (e.key) {
                case 'ArrowLeft':
                  newX = currentElement.x - step;
                  break;
                case 'ArrowRight':
                  newX = currentElement.x + step;
                  break;
                case 'ArrowUp':
                  newY = currentElement.y - step;
                  break;
                case 'ArrowDown':
                  newY = currentElement.y + step;
                  break;
              }
              
              // Constrain position within bounds
              const constrained = constrainPosition(snapToGrid(newX), snapToGrid(newY), previewRef);
              
              newElements[element] = {
                ...currentElement,
                x: constrained.x,
                y: constrained.y
              };
            }
          });
          
          return {
            ...prev,
            elements: newElements
          };
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [cssMode, selectedElement, selectedElements, setEasyCustomization, snapToGrid, constrainPosition]);

  return {
    // Selection states
    selectedElement,
    setSelectedElement,
    selectedElements,
    setSelectedElements,
    
    // Interaction states
    isDragging,
    isResizing,
    resizeHandle,
    
    // UI states
    contextMenu,
    setContextMenu,
    typographyPopup,
    setTypographyPopup,
    
    // Refs
    typographyPopupRef,
    previewRef,
    
    // Handlers
    handlePreviewMouseDown,
    handlePreviewMouseMove,
    handlePreviewMouseUp,
    handlePreviewContextMenu,
    handleTextElementRightClick,
    
    // Utilities
    snapToGrid,
    isElementSelected,
    toggleElementSelection,
    constrainPosition,
    calculateConstraints,
  };
};