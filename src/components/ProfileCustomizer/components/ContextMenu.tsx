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

  const addBackground = () => {
    const textElements = ['profile-pronouns', 'profile-bio'];
    if (textElements.includes(contextMenu.element)) {
      setEasyCustomization(prev => ({
        ...prev,
        elements: {
          ...prev.elements,
          [contextMenu.element]: {
            ...prev.elements[contextMenu.element],
            background: 'rgba(47, 49, 54, 0.7)',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }
        }
      }));
    }
    setContextMenu(null);
  };

  const removeBackground = () => {
    const textElements = ['profile-pronouns', 'profile-bio'];
    if (textElements.includes(contextMenu.element)) {
      setEasyCustomization(prev => ({
        ...prev,
        elements: {
          ...prev.elements,
          [contextMenu.element]: {
            ...prev.elements[contextMenu.element],
            background: 'none',
            padding: '0',
            borderRadius: '0',
            border: 'none'
          }
        }
      }));
    }
    setContextMenu(null);
  };

  const bringToFront = () => {
    setEasyCustomization(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [contextMenu.element]: {
          ...prev.elements[contextMenu.element],
          zIndex: 10
        }
      }
    }));
    setContextMenu(null);
  };

  const sendToBack = () => {
    setEasyCustomization(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [contextMenu.element]: {
          ...prev.elements[contextMenu.element],
          zIndex: 1
        }
      }
    }));
    setContextMenu(null);
  };

  const duplicateElement = () => {
    const newElement = {
      ...element,
      x: element.x + 20,
      y: element.y + 20
    };
    
    setEasyCustomization(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [`${contextMenu.element}-copy`]: newElement
      }
    }));
    setContextMenu(null);
  };

  const isTextElement = ['profile-pronouns', 'profile-bio'].includes(contextMenu.element);
  const hasBackground = element.background && element.background !== 'none';
  const elementName = contextMenu.element
    .replace('profile-', '')
    .replace('-', ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div
      className={cn(
        "fixed z-[10000] min-w-[180px] py-1 shadow-lg border",
        isTheme98 
          ? "raised-panel bg-gray-200" 
          : "bg-white dark:bg-gray-800 rounded-md"
      )}
      style={{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col">
        {/* Element Info Header */}
        <div className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
          {elementName}
        </div>

        {/* Visibility Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleVisibility}
          className={cn(
            "justify-start px-3 py-2 h-8 rounded-none text-sm",
            isTheme98 && "hover:bg-blue-500 hover:text-white"
          )}
        >
          <span className="mr-2">{element.visible ? '👁️' : '🙈'}</span>
          {element.visible ? 'Hide Element' : 'Show Element'}
        </Button>
        
        {/* Position Controls */}
        <Button
          variant="ghost"
          size="sm"
          onClick={resetPosition}
          className={cn(
            "justify-start px-3 py-2 h-8 rounded-none text-sm",
            isTheme98 && "hover:bg-blue-500 hover:text-white"
          )}
        >
          <span className="mr-2">🎯</span>
          Reset Position
        </Button>

        {/* Layering Controls */}
        <Button
          variant="ghost"
          size="sm"
          onClick={bringToFront}
          className={cn(
            "justify-start px-3 py-2 h-8 rounded-none text-sm",
            isTheme98 && "hover:bg-blue-500 hover:text-white"
          )}
        >
          <span className="mr-2">⬆️</span>
          Bring to Front
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={sendToBack}
          className={cn(
            "justify-start px-3 py-2 h-8 rounded-none text-sm",
            isTheme98 && "hover:bg-blue-500 hover:text-white"
          )}
        >
          <span className="mr-2">⬇️</span>
          Send to Back
        </Button>

        {/* Background Controls for Text Elements */}
        {isTextElement && (
          <>
            <hr className={cn(
              "my-1",
              isTheme98 ? "border-gray-400" : "border-gray-200 dark:border-gray-600"
            )} />
            
            {hasBackground ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={removeBackground}
                className={cn(
                  "justify-start px-3 py-2 h-8 rounded-none text-sm",
                  isTheme98 && "hover:bg-blue-500 hover:text-white"
                )}
              >
                <span className="mr-2">🚫</span>
                Remove Background
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={addBackground}
                className={cn(
                  "justify-start px-3 py-2 h-8 rounded-none text-sm",
                  isTheme98 && "hover:bg-blue-500 hover:text-white"
                )}
              >
                <span className="mr-2">🎨</span>
                Add Background
              </Button>
            )}
          </>
        )}

        {/* Advanced Options */}
        <hr className={cn(
          "my-1",
          isTheme98 ? "border-gray-400" : "border-gray-200 dark:border-gray-600"
        )} />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={duplicateElement}
          className={cn(
            "justify-start px-3 py-2 h-8 rounded-none text-sm",
            isTheme98 && "hover:bg-blue-500 hover:text-white"
          )}
        >
          <span className="mr-2">📋</span>
          Duplicate
        </Button>

        {/* Element Details Footer */}
        <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-600">
          <div>Position: {element.x}, {element.y}</div>
          <div>Scale: {Math.round((element.scale || 1) * 100)}%</div>
          <div>Visible: {element.visible ? 'Yes' : 'No'}</div>
        </div>
      </div>
    </div>
  );
};