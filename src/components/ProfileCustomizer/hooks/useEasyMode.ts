// src/components/ProfileCustomizer/hooks/useEasyMode.ts
import { useState, useRef, useEffect } from 'react';
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
  
  // Refs
  const typographyPopupRef = useRef<HTMLDivElement>(null);

  // Grid snap helper function
  const snapToGrid = (value: number) => {
    if (positionMode === 'grid') {
      return Math.round(value / GRID_SIZE) * GRID_SIZE;
    }
    return value;
  };

  // Multi-select helper functions
  const isElementSelected = (element: string) => {
    return selectedElements.includes(element);
  };

  const toggleElementSelection = (element: string, shiftKey: boolean) => {
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
  };

  // Mouse event handlers
  const handlePreviewMouseDown = (e: React.MouseEvent, element: string) => {
    if (cssMode !== 'easy') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Check if clicking on resize handle
    const target = e.target as HTMLElement;
    if (target.classList.contains('resize-handle')) {
      const handle = target.dataset.handle as ResizeHandle;
      setIsResizing(true);
      setResizeHandle(handle);
      setSelectedElement(element);
      
      const currentElement = easyCustomization.elements[element] || { 
        x: 0, y: 0, scale: 1, width: 0, height: 0, visible: true 
      };
      setDragStart({ 
        x: e.clientX, 
        y: e.clientY,
        elementX: currentElement.x,
        elementY: currentElement.y,
        elementWidth: currentElement.width || 0,
        elementHeight: currentElement.height || 0
      });
      return;
    }

    toggleElementSelection(element, e.shiftKey);
    setIsDragging(true);
    
    const currentElement = easyCustomization.elements[element] || { 
      x: 0, y: 0, scale: 1, visible: true 
    };
    setDragStart({ 
      x: e.clientX, 
      y: e.clientY,
      elementX: currentElement.x,
      elementY: currentElement.y,
      elementWidth: currentElement.width || 0,
      elementHeight: currentElement.height || 0
    });
  };

  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    if (cssMode !== 'easy') return;

    if (isResizing && selectedElement && resizeHandle) {
      e.preventDefault();
      
      const element = easyCustomization.elements[selectedElement];
      if (!element) return;

      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      let newWidth = dragStart.elementWidth;
      let newHeight = dragStart.elementHeight;
      let scaleChange = 0;
      
      // Handle different resize modes
      if (resizeHandle.includes('e')) {
        if (newWidth > 0) {
          newWidth = Math.max(20, snapToGrid(dragStart.elementWidth + deltaX));
        } else {
          scaleChange += deltaX / 100;
        }
      }
      if (resizeHandle.includes('w')) {
        if (newWidth > 0) {
          newWidth = Math.max(20, snapToGrid(dragStart.elementWidth - deltaX));
        } else {
          scaleChange -= deltaX / 100;
        }
      }
      if (resizeHandle.includes('s')) {
        if (newHeight > 0) {
          newHeight = Math.max(20, snapToGrid(dragStart.elementHeight + deltaY));
        } else {
          scaleChange += deltaY / 100;
        }
      }
      if (resizeHandle.includes('n')) {
        if (newHeight > 0) {
          newHeight = Math.max(20, snapToGrid(dragStart.elementHeight - deltaY));
        } else {
          scaleChange -= deltaY / 100;
        }
      }
      
      // For corner handles, use both directions
      if (['nw', 'ne', 'sw', 'se'].includes(resizeHandle)) {
        scaleChange = (deltaX + deltaY) / 200;
      }
      
      const newScale = Math.max(0.3, Math.min(3, element.scale + scaleChange));
      
      setEasyCustomization(prev => ({
        ...prev,
        elements: {
          ...prev.elements,
          [selectedElement]: {
            ...prev.elements[selectedElement],
            scale: newWidth > 0 || newHeight > 0 ? element.scale : newScale,
            width: newWidth > 0 ? newWidth : undefined,
            height: newHeight > 0 ? newHeight : undefined,
          }
        }
      }));
    } else if (isDragging && (selectedElement || selectedElements.length > 0)) {
      e.preventDefault();
      
      const deltaX = snapToGrid(e.clientX - dragStart.x);
      const deltaY = snapToGrid(e.clientY - dragStart.y);
      
      const elementsToUpdate = selectedElements.length > 0 ? selectedElements : [selectedElement!];
      
      setEasyCustomization(prev => {
        const newElements = { ...prev.elements };
        
        elementsToUpdate.forEach(element => {
          if (element && newElements[element]) {
            const currentElement = newElements[element];
            newElements[element] = {
              ...currentElement,
              x: snapToGrid(dragStart.elementX + deltaX),
              y: snapToGrid(dragStart.elementY + deltaY),
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

  const handlePreviewMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

  // Context menu handler
  const handlePreviewContextMenu = (e: React.MouseEvent, element: string) => {
    if (cssMode !== 'easy') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 150);
    
    setContextMenu({ x, y, element });
  };

  // Typography popup handler
  const handleTextElementRightClick = (e: React.MouseEvent, element: string) => {
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
          fontFamily: 'default',
          fontSize: 16,
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
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
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
  };
};