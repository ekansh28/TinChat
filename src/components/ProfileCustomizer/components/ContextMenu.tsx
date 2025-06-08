// src/components/ProfileCustomizer/components/ContextMenu.tsx
import React from 'react';
import { Button } from '@/components/ui/button-themed';
import { cn } from '@/lib/utils';
import type { ContextMenuState, EasyCustomization } from '../types';

interface ContextMenuProps {
  contextMenu: ContextMenuState | null;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  easyCustomization: EasyCustomization;
  setEasyCustomization: React.Dispatch<React.SetStateAction<EasyCustomization>>;
  isTheme98: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  contextMenu,
  setContextMenu,
  easyCustomization,
  setEasyCustomization,
  isTheme98
}) => {
  if (!contextMenu) return null;

  const element = easyCustomization.elements[contextMenu.element];
  if (!element) return null;

  const toggleVisibility = () => {
    setEasyCustomization(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [contextMenu.element]: {
          ...prev.elements[contextMenu.element],
          visible: !prev.elements[contextMenu.element].visible
        }
      }
    }));
    setContextMenu(null);
  };

  const resetPosition = () => {
    setEasyCustomization(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [contextMenu.element]: {
          ...prev.elements[contextMenu.element],
          x: 0,
          y: 0,
          scale: 1
        }
      }
    }));
    setContextMenu(null);
  };

  const bringToFront = () => {
    // This would require z-index management in the CSS
    setContextMenu(null);
  };

  return (
    <div
      className={cn(
        "fixed z-[10000] min-w-[150px] py-1 shadow-lg border",
        isTheme98 
          ? "raised-panel bg-gray-200" 
          : "bg-white dark:bg-gray-800 rounded"
      )}
      style={{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`
      }}
    >
      <div className="flex flex-col">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleVisibility}
          className={cn(
            "justify-start px-3 py-1 h-8 rounded-none",
            isTheme98 && "hover:bg-blue-500 hover:text-white"
          )}
        >
          {element.visible ? 'Hide Element' : 'Show Element'}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={resetPosition}
          className={cn(
            "justify-start px-3 py-1 h-8 rounded-none",
            isTheme98 && "hover:bg-blue-500 hover:text-white"
          )}
        >
          Reset Position
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={bringToFront}
          className={cn(
            "justify-start px-3 py-1 h-8 rounded-none",
            isTheme98 && "hover:bg-blue-500 hover:text-white"
          )}
        >
          Bring to Front
        </Button>
        
        <hr className={cn(
          "my-1",
          isTheme98 ? "border-gray-400" : "border-gray-200 dark:border-gray-600"
        )} />
        
        <div className="px-3 py-1 text-xs text-gray-500">
          {contextMenu.element.replace('profile-', '').replace('-', ' ')}
        </div>
      </div>
    </div>
  );
};