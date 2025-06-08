// src/components/ProfileCustomizer/components/TypographyPopup.tsx
import React from 'react';
import { Button } from '@/components/ui/button-themed';
import { Label } from '@/components/ui/label-themed';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-themed';
import { cn } from '@/lib/utils';
import { FONT_FAMILIES } from '../utils/constants';
import type { TypographyPopupState, EasyCustomization } from '../types';

interface TypographyPopupProps {
  typographyPopup: TypographyPopupState | null;
  setTypographyPopup: React.Dispatch<React.SetStateAction<TypographyPopupState | null>>;
  easyCustomization: EasyCustomization;
  setEasyCustomization: React.Dispatch<React.SetStateAction<EasyCustomization>>;
  typographyPopupRef: React.RefObject<HTMLDivElement>;
  isTheme98: boolean;
}

export const TypographyPopup: React.FC<TypographyPopupProps> = ({
  typographyPopup,
  setTypographyPopup,
  easyCustomization,
  setEasyCustomization,
  typographyPopupRef,
  isTheme98
}) => {
  if (!typographyPopup) return null;

  const updateElementColor = (color: string) => {
    setEasyCustomization(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [typographyPopup.element]: {
          ...prev.elements[typographyPopup.element],
          color
        }
      }
    }));
  };

  const updateElementFont = (fontFamily: string) => {
    setEasyCustomization(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [typographyPopup.element]: {
          ...prev.elements[typographyPopup.element],
          fontFamily
        }
      }
    }));
  };

  const updateElementFontSize = (fontSize: number) => {
    setEasyCustomization(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [typographyPopup.element]: {
          ...prev.elements[typographyPopup.element],
          fontSize
        }
      }
    }));
  };

  const resetTypography = () => {
    setEasyCustomization(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [typographyPopup.element]: {
          ...prev.elements[typographyPopup.element],
          color: undefined,
          fontFamily: undefined,
          fontSize: undefined
        }
      }
    }));
  };

  const currentElement = easyCustomization.elements[typographyPopup.element];
  const currentColor = currentElement?.color || '#ffffff';
  const currentFontFamily = currentElement?.fontFamily || 'default';
  const currentFontSize = currentElement?.fontSize || 16;

  return (
    <div
      ref={typographyPopupRef}
      className={cn(
        "typography-popup fixed z-[10001] w-80 p-4 shadow-lg border space-y-4",
        isTheme98 
          ? "raised-panel bg-gray-200" 
          : "bg-white dark:bg-gray-800 rounded-lg"
      )}
      style={{
        left: `${typographyPopup.x}px`,
        top: `${typographyPopup.y}px`
      }}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Text Styling</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTypographyPopup(null)}
          className="w-6 h-6 p-0"
        >
          ×
        </Button>
      </div>

      {/* Color Picker */}
      <div>
        <Label htmlFor="text-color">Text Color</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            id="text-color"
            type="color"
            value={currentColor}
            onChange={(e) => updateElementColor(e.target.value)}
            className={cn(
              "w-10 h-8 rounded border cursor-pointer",
              isTheme98 ? "sunken-panel" : "border-gray-300"
            )}
          />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {currentColor.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Font Family */}
      <div>
        <Label htmlFor="font-family">Font Family</Label>
        <Select 
          value={currentFontFamily} 
          onValueChange={updateElementFont}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map(font => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value === 'default' ? 'inherit' : font.value }}>
                  {font.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Font Size */}
      <div>
        <Label htmlFor="font-size">Font Size</Label>
        <div className="mt-1 px-2">
          <input
            id="font-size"
            type="range"
            value={currentFontSize}
            onChange={(e) => updateElementFontSize(parseInt(e.target.value))}
            min="8"
            max="48"
            step="1"
            className={cn(
              "w-full h-2 rounded-lg appearance-none cursor-pointer",
              isTheme98 
                ? "bg-gray-300" 
                : "bg-gray-200 dark:bg-gray-700"
            )}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>8px</span>
            <span className="font-medium">{currentFontSize}px</span>
            <span>48px</span>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div>
        <Label>Preview</Label>
        <div className={cn(
          "mt-1 p-3 rounded border bg-gray-900 text-center",
          isTheme98 ? "sunken-panel" : ""
        )}>
          <span
            style={{
              color: currentColor,
              fontFamily: currentFontFamily === 'default' ? 'inherit' : currentFontFamily,
              fontSize: `${currentFontSize}px`
            }}
          >
            Sample Text
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={resetTypography}
          className="flex-1"
        >
          Reset
        </Button>
        <Button
          size="sm"
          onClick={() => setTypographyPopup(null)}
          className="flex-1"
        >
          Apply
        </Button>
      </div>

      <div className="text-xs text-gray-500">
        <p className="font-medium mb-1">Element: {typographyPopup.element.replace('profile-', '').replace('-', ' ')}</p>
        <p>Right-click text elements to customize their appearance.</p>
      </div>
    </div>
  );
};

// Ensure the component is properly exported
export default TypographyPopup;