// src/components/ProfileCustomizer/components/ColorPicker.tsx
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Predefined color palette
  const predefinedColors = [
    '#ff0000', '#ff8000', '#ffff00', '#00ff00', '#00ffff', '#0080ff', '#8000ff', '#ff00ff',
    '#ff6b6b', '#ffa726', '#ffee58', '#66bb6a', '#26c6da', '#42a5f5', '#ab47bc', '#ec407a',
    '#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#00bcd4', '#2196f3', '#9c27b0', '#e91e63',
    '#d32f2f', '#f57c00', '#fbc02d', '#388e3c', '#0097a7', '#1976d2', '#7b1fa2', '#c2185b',
    '#000000', '#424242', '#616161', '#757575', '#9e9e9e', '#bdbdbd', '#e0e0e0', '#ffffff'
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleColorSelect = (selectedColor: string) => {
    onChange(selectedColor);
    setIsOpen(false);
  };

  const handleNativeColorPicker = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div className="relative" ref={pickerRef}>
      {/* Color preview button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-10 h-10 rounded border-2 border-gray-300 dark:border-gray-600 cursor-pointer",
          "hover:border-gray-400 dark:hover:border-gray-500 transition-colors",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{ backgroundColor: color }}
        title={`Current color: ${color}`}
      />

      {/* Hidden native color input */}
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="absolute opacity-0 w-0 h-0"
        disabled={disabled}
      />

      {/* Color picker dropdown */}
      {isOpen && (
        <div className="absolute top-12 left-0 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 min-w-[240px]">
          {/* Predefined colors grid */}
          <div className="mb-4">
            <div className="text-sm font-medium mb-2">Quick Colors</div>
            <div className="grid grid-cols-8 gap-1">
              {predefinedColors.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => handleColorSelect(presetColor)}
                  className={cn(
                    "w-6 h-6 rounded border border-gray-300 dark:border-gray-600",
                    "hover:scale-110 transition-transform cursor-pointer",
                    color === presetColor && "ring-2 ring-blue-500 ring-offset-1"
                  )}
                  style={{ backgroundColor: presetColor }}
                  title={presetColor}
                />
              ))}
            </div>
          </div>

          {/* Custom color picker button */}
          <button
            type="button"
            onClick={handleNativeColorPicker}
            className="w-full py-2 px-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm font-medium transition-colors"
          >
            🎨 Custom Color Picker
          </button>

          {/* Current color display */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Current:</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-mono">{color}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};